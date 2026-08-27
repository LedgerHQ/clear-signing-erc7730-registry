#!/usr/bin/env node
/**
 * Finds deployments that a descriptor should probably list but does not.
 *
 * Idea: a descriptor is bound to a contract through (chainId, address) pairs.
 * The same contract is usually deployed on more chains (testnets in
 * particular) than the descriptor lists. Sourcify stores, for every verified
 * deployment, the *compilation* it was matched against, and deduplicates
 * compilations: two deployments of byte-identical compiled code share one
 * compilation row. So "other deployments of the same compilation" is a
 * precise way to find the same contract elsewhere.
 *
 * Pipeline:
 *   1. Collect every (chainId, address) bound by a descriptor (calldata or
 *      EIP-712), remembering which file physically holds the deployments
 *      array (the descriptor itself or a file in its "includes" chain).
 *   2. Ask Sourcify (Postgres, via psql) for the compilation of each target,
 *      plus deployer, constructor arguments and the size of the compilation's
 *      deployment set.
 *   3. Classify targets:
 *        singleton — project-specific code, few deployments
 *        proxy     — generic proxy bytecode (thousands of unrelated twins);
 *                    resolved to its implementation through the Sourcify API
 *        clone     — project code with many instances (vaults, safes);
 *                    reported only, never applied
 *   4. Fetch sibling deployments (same compilation) for singletons and for the
 *      implementations behind proxies. For proxies, find candidate proxies
 *      that point to a sibling implementation and confirm each one through
 *      the Sourcify API (which reads the EIP-1967 slot on chain).
 *   5. Score each candidate: same compilation is necessary but not
 *      sufficient (USDT and WETH9 have copycat deployments on mainnet itself),
 *      so we grade by "same project" evidence:
 *        high   — same address on another chain (the only signal that
 *                 identifies the same *instance*; deterministic deployments)
 *        medium — another chain, same deployer or identical constructor
 *                 arguments, or a confirmed proxy at a different address
 *        low    — anything else, including every same-chain sibling (those
 *                 are old versions or copies: "same deployer" over-matches for
 *                 per-asset contracts such as bridged tokens and vaults)
 *   6. Write a JSON + Markdown report; with --apply, add the chosen
 *      confidence levels to the descriptor files.
 *
 * Usage:
 *   node tools/scripts/find-missing-deployments.js [options]
 *     --out <dir>          report directory (default: ./missing-deployments)
 *     --apply <level>      write candidates of this confidence or better
 *                          (high | medium) into the descriptor files
 *     --only <substr>      restrict to holder files whose path contains substr
 *     --pg "<conn>"        psql connection args
 *                          (default: -h 35.205.24.190 -U agent_readonly -d sourcify)
 *     --cache <dir>        cache dir for Sourcify API answers (default: <out>/cache)
 *     --report <file>      skip discovery; apply from an existing report.json
 *                          (use with --apply, optionally --only)
 *
 * Requires: psql on PATH with credentials in ~/.pgpass, network access to
 * sourcify.dev. The repo's js-sha3 is used for address checksums.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { keccak_256 } = require('js-sha3');

const REPO_ROOT = path.resolve(__dirname, '../..');
const REGISTRY_DIR = path.join(REPO_ROOT, 'registry');
const EXCLUDED_DIRS = new Set(['tests', 'testsv2', 'sigs']);

/** Chains whose state is a fork of Ethereum mainnet: every mainnet contract
 *  "exists" there without anyone deploying it. Never suggested. */
const EXCLUDED_CHAINS = new Set([
  369, 943, // PulseChain mainnet / testnet
  3, 4, 5, 42, 420, 421613, 84531, 59140, 80001, 1442, 2221, 4002, // dead testnets: Ropsten, Rinkeby, Goerli, Kovan, OP Goerli, Arb Goerli, Base Goerli, Linea Goerli, Mumbai, zkEVM testnet, Kava testnet, Fantom testnet
]);
/** Above this many deployments a compilation is generic proxy bytecode. */
const GENERIC_THRESHOLD = 3000;
/** Above this many deployments a non-proxy compilation is clone/factory code. */
const CLONE_THRESHOLD = 200;
const SOURCIFY_API = 'https://sourcify.dev/server';

// ---------------------------------------------------------------- CLI args
function parseArgs(argv) {
  const o = { out: 'missing-deployments', apply: null, only: null, pg: null, cache: null, report: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') o.out = argv[++i];
    else if (a === '--apply') o.apply = argv[++i];
    else if (a === '--only') o.only = argv[++i];
    else if (a === '--pg') o.pg = argv[++i];
    else if (a === '--cache') o.cache = argv[++i];
    else if (a === '--report') o.report = argv[++i];
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (o.apply && !['high', 'medium'].includes(o.apply)) throw new Error('--apply must be high or medium');
  o.pg = o.pg ? o.pg.split(/\s+/) : ['-h', '35.205.24.190', '-U', 'agent_readonly', '-d', 'sourcify'];
  o.cache = o.cache || path.join(o.out, 'cache');
  return o;
}

// ------------------------------------------------------------- utilities
function toChecksum(addr) {
  const hex = addr.toLowerCase().replace(/^0x/, '');
  const hash = keccak_256(hex);
  let out = '0x';
  for (let i = 0; i < hex.length; i++) out += parseInt(hash[i], 16) >= 8 ? hex[i].toUpperCase() : hex[i];
  return out;
}
const key = (chainId, addr) => `${chainId}:${addr.toLowerCase()}`;

/** Minimal CSV parser for psql `\copy ... csv header` output. */
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift();
  return rows.filter((r) => r.length === header.length).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

function runSql(pgArgs, sql, workDir) {
  const file = path.join(workDir, `query-${Date.now()}.sql`);
  fs.writeFileSync(file, sql);
  execFileSync('psql', [...pgArgs, '-v', 'ON_ERROR_STOP=1', '-q', '-f', file], {
    stdio: ['ignore', 'inherit', 'inherit'],
    env: { ...process.env, PGCONNECT_TIMEOUT: '15' },
    maxBuffer: 1 << 28,
  });
}

function valuesList(pairs) {
  return pairs.map(([c, a]) => `(${Number(c)},decode('${a.toLowerCase().replace(/^0x/, '')}','hex'))`).join(',\n');
}

async function fetchJson(url, cacheDir, cacheKey) {
  const cacheFile = path.join(cacheDir, cacheKey.replace(/[^a-z0-9_.-]/gi, '_') + '.json');
  if (fs.existsSync(cacheFile)) return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(url);
    if (res.status === 404) { fs.writeFileSync(cacheFile, 'null'); return null; }
    if (res.ok) { const j = await res.json(); fs.writeFileSync(cacheFile, JSON.stringify(j)); return j; }
    if (res.status === 429 || res.status >= 500) {
      const wait = Number(res.headers.get('retry-after')) * 1000 || 3000 * 2 ** attempt;
      await new Promise((r) => setTimeout(r, Math.min(wait, 60000))); continue;
    }
    throw new Error(`${url} -> HTTP ${res.status}`);
  }
  throw new Error(`${url} -> gave up after retries`);
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: limit }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx], idx); }
  }));
  return out;
}

// ----------------------------------------------------- step 1: targets
function findDescriptors(dir, found = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (!EXCLUDED_DIRS.has(entry.name)) findDescriptors(abs, found); }
    else if (/^(calldata|eip712)-.*\.json$/.test(entry.name) && !entry.name.endsWith('.tests.json')) found.push(abs);
  }
  return found.sort();
}

/**
 * Walks a descriptor's include chain and returns the first file that
 * physically holds context.<contract|eip712>.deployments, plus that array.
 * That is the file --apply must edit; the descriptor itself may hold nothing
 * but display formats.
 */
function findDeploymentHolder(file) {
  const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  const ctx = doc.context || {};
  for (const kind of ['contract', 'eip712']) {
    const deps = ctx[kind] && ctx[kind].deployments;
    if (Array.isArray(deps) && deps.length) return { holder: file, kind, deployments: deps, factory: !!(ctx.contract && ctx.contract.factory) };
  }
  if (doc.includes) return findDeploymentHolder(path.resolve(path.dirname(file), doc.includes));
  return null;
}

function collectHolders(only) {
  const holders = new Map(); // holder path -> {kind, deployments Map(key->{chainId,address}), descriptors[]}
  for (const desc of findDescriptors(REGISTRY_DIR)) {
    const rel = path.relative(REPO_ROOT, desc);
    const h = findDeploymentHolder(desc);
    if (!h) continue;
    const hrel = path.relative(REPO_ROOT, h.holder);
    if (only && !hrel.includes(only)) continue;
    if (!holders.has(hrel)) {
      const deployments = new Map();
      for (const d of h.deployments) deployments.set(key(d.chainId, d.address), { chainId: d.chainId, address: d.address });
      holders.set(hrel, { kind: h.kind, deployments, descriptors: [] });
    }
    holders.get(hrel).descriptors.push(rel);
  }
  return holders;
}

/** Every (chain, address) bound anywhere in the registry: a candidate that is
 *  already bound by another file would create an index collision. */
function collectAllBound() {
  const bound = new Map();
  for (const desc of findDescriptors(REGISTRY_DIR)) {
    const h = findDeploymentHolder(desc);
    if (!h) continue;
    for (const d of h.deployments) bound.set(key(d.chainId, d.address), path.relative(REPO_ROOT, h.holder));
  }
  return bound;
}

// -------------------------------------------------------------- SQL text
const SQL_TARGETS = (pairs, out) => `
create temp table t(chain_id bigint, address bytea);
insert into t values ${valuesList(pairs)};
create temp table tv as
select t.chain_id, '0x'||encode(t.address,'hex') address, vc.compilation_id, cc.name,
       '0x'||encode(cd.deployer,'hex') deployer,
       coalesce(vc.creation_values->>'constructorArguments','') ctor,
       vc.runtime_match, vc.creation_match,
       coalesce(vc.runtime_metadata_match, vc.creation_metadata_match) exact
from t
join contract_deployments cd on cd.chain_id=t.chain_id and cd.address=t.address
join verified_contracts vc on vc.deployment_id=cd.id
join compiled_contracts cc on cc.id=vc.compilation_id;
create temp table cn as
select c.compilation_id, (select count(*) from verified_contracts v where v.compilation_id=c.compilation_id) n
from (select distinct compilation_id from tv) c;
\\copy (select tv.*, cn.n from tv join cn using(compilation_id) order by chain_id, address) to '${out}' csv header
`;

const SQL_SIBLINGS = (compilationIds, out) => `
create temp table c(compilation_id uuid);
insert into c values ${compilationIds.map((id) => `('${id}')`).join(',')};
create temp table result as
  select c.compilation_id, cd.chain_id, '0x'||encode(cd.address,'hex') address,
         '0x'||encode(cd.deployer,'hex') deployer,
         coalesce(vc.creation_values->>'constructorArguments','') ctor,
         vc.runtime_match, vc.creation_match,
         coalesce(vc.runtime_metadata_match, vc.creation_metadata_match) exact
  from c join verified_contracts vc on vc.compilation_id=c.compilation_id
  join contract_deployments cd on cd.id=vc.deployment_id;
\\copy result to '${out}' csv header
`;

/** Proxy candidates: (a) same address as a target proxy on any chain;
 *  (b) any verified contract whose compilation is one of the generic proxy
 *  compilations seen among the targets and whose constructor arguments
 *  mention a sibling implementation address. */
const SQL_PROXY_CANDIDATES = (proxyAddrs, genericCompilations, specificCompilations, implAddrs, out) => `
create temp table pa(address bytea);
insert into pa values ${proxyAddrs.map((a) => `(decode('${a.slice(2)}','hex'))`).join(',')};
create temp table pg(compilation_id uuid);
insert into pg values ${genericCompilations.map((id) => `('${id}')`).join(',') || "('00000000-0000-0000-0000-000000000000')"};
create temp table ps(compilation_id uuid);
insert into ps values ${specificCompilations.map((id) => `('${id}')`).join(',') || "('00000000-0000-0000-0000-000000000000')"};
create temp table ia(addr text);
insert into ia values ${implAddrs.map((a) => `('${a.slice(2).toLowerCase()}')`).join(',')};
create temp table result as
  select distinct * from (
    select cd.chain_id, '0x'||encode(cd.address,'hex') address, '0x'||encode(cd.deployer,'hex') deployer, 'same-address' via
    from pa join contract_deployments cd on cd.address=pa.address
    join verified_contracts vc on vc.deployment_id=cd.id
    union all
    -- generic OZ proxies: the implementation is the first constructor word (hash join, fast)
    select cd.chain_id, '0x'||encode(cd.address,'hex'), '0x'||encode(cd.deployer,'hex'), 'ctor-first-word'
    from pg join verified_contracts vc on vc.compilation_id=pg.compilation_id
    join ia on ia.addr = substr(lower(vc.creation_values->>'constructorArguments'), 27, 40)
    join contract_deployments cd on cd.id=vc.deployment_id
    union all
    -- project-specific proxies: implementation may sit anywhere in the arguments (few rows, substring search)
    select cd.chain_id, '0x'||encode(cd.address,'hex'), '0x'||encode(cd.deployer,'hex'), 'ctor-substring'
    from ps join verified_contracts vc on vc.compilation_id=ps.compilation_id
    join contract_deployments cd on cd.id=vc.deployment_id
    join ia on position(ia.addr in lower(vc.creation_values->>'constructorArguments'))>0
  ) x;
\\copy result to '${out}' csv header
`;

// ------------------------------------------------ proxy resolution
const IMPL_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
const BEACON_SLOT = '0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50';
const ZERO = '0x' + '0'.repeat(40);
let chainList = null;

async function loadChains(cacheDir) {
  if (!chainList) chainList = new Map((await fetchJson(`${SOURCIFY_API}/chains`, cacheDir, 'chains')).map((c) => [c.chainId, c]));
  return chainList;
}

async function rpcCall(url, method, params) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: ctrl.signal });
    if (!res.ok) return null;
    const j = await res.json();
    return typeof j.result === 'string' ? j.result : null;
  } catch { return null; } finally { clearTimeout(timer); }
}
/** RPC endpoints for a chain: the DRPC entry from Sourcify's chain list with
 *  DRPC_API_KEY filled in (set it in the environment), then public endpoints
 *  from chainid.network. Placeholder URLs we cannot fill are skipped. */
let publicChains = null;
async function rpcUrls(chainId, cacheDir) {
  const out = [];
  const chain = (await loadChains(cacheDir)).get(chainId);
  for (const u of (chain && chain.rpc) || []) {
    if (typeof u !== 'string' || !u.startsWith('http')) continue;
    if (u.includes('{API_KEY}') && u.includes('drpc.org') && process.env.DRPC_API_KEY) out.push(u.replace('{API_KEY}', process.env.DRPC_API_KEY));
    else if (!u.includes('{')) out.push(u);
  }
  if (!publicChains) {
    const list = await fetchJson('https://chainid.network/chains.json', cacheDir, 'chainid-network').catch(() => []);
    publicChains = new Map((list || []).map((c) => [c.chainId, c.rpc || []]));
  }
  for (const u of publicChains.get(chainId) || []) if (u.startsWith('https://') && !u.includes('${')) out.push(u);
  return out;
}
const wordToAddr = (w) => (w && /^0x[0-9a-f]{64}$/i.test(w) ? '0x' + w.slice(-40).toLowerCase() : null);

/** Reads the EIP-1967 implementation (or beacon) slot through a public RPC
 *  from the Sourcify chain list. Returns {type, implementations} or null
 *  when the contract is not an EIP-1967 proxy, undefined when no RPC answered. */
async function proxyViaRpc(chainId, address, cacheDir) {
  const urls = await rpcUrls(chainId, cacheDir);
  for (const url of urls.slice(0, 5)) {
    const impl = wordToAddr(await rpcCall(url, 'eth_getStorageAt', [address, IMPL_SLOT, 'latest']));
    if (impl === null) continue; // RPC failed, try next
    if (impl !== ZERO) return { type: 'EIP1967Proxy', implementations: [impl] };
    const beacon = wordToAddr(await rpcCall(url, 'eth_getStorageAt', [address, BEACON_SLOT, 'latest']));
    if (beacon && beacon !== ZERO) {
      const bi = wordToAddr(await rpcCall(url, 'eth_call', [{ to: beacon, data: '0x5c60da1b' }, 'latest']));
      if (bi && bi !== ZERO) return { type: 'BeaconProxy', implementations: [bi] };
    }
    return null;
  }
  return undefined;
}

/** Resolve a proxy: RPC first (no rate limit), Sourcify API as fallback. Cached. */
async function proxyResolution(chainId, address, cacheDir) {
  const cacheFile = path.join(cacheDir, `impl-${chainId}-${address.toLowerCase()}.json`);
  if (fs.existsSync(cacheFile)) return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
  let r = await proxyViaRpc(chainId, address, cacheDir);
  if (r === undefined) {
    const j = await fetchJson(`${SOURCIFY_API}/v2/contract/${chainId}/${address}?fields=proxyResolution`, cacheDir, `proxy-${chainId}-${address.toLowerCase()}`).catch(() => null);
    const pr = j && j.proxyResolution;
    r = pr && pr.isProxy ? { type: pr.proxyType, implementations: (pr.implementations || []).map((i) => i.address.toLowerCase()) } : null;
  }
  fs.writeFileSync(cacheFile, JSON.stringify(r));
  return r;
}

async function chainNames(cacheDir) {
  const m = new Map();
  for (const [id, c] of await loadChains(cacheDir)) m.set(id, c.name);
  return m;
}
const isTestnet = (name) => /test|sepolia|holesky|hoodi|goerli|devnet/i.test(name || '');

// ------------------------------------------------------------------ main
async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.report) {
    const saved = JSON.parse(fs.readFileSync(opts.report, 'utf8')).filter((e) => !opts.only || e.holder.includes(opts.only));
    if (!opts.apply) throw new Error('--report needs --apply');
    applyCandidates(saved, opts.apply, (m) => process.stderr.write(m + '\n'));
    return;
  }
  fs.mkdirSync(opts.out, { recursive: true });
  fs.mkdirSync(opts.cache, { recursive: true });
  const outAbs = path.resolve(opts.out);
  const log = (m) => process.stderr.write(m + '\n');

  const holders = collectHolders(opts.only);
  const allBound = collectAllBound();
  const targets = new Map(); // key -> {chainId,address, holders:Set}
  for (const [h, info] of holders) for (const [k, d] of info.deployments) {
    if (!targets.has(k)) targets.set(k, { ...d, holders: new Set() });
    targets.get(k).holders.add(h);
  }
  log(`${holders.size} deployment-holding files, ${targets.size} distinct (chain, address) targets`);

  // step 2: targets -> compilations
  const tvCsv = path.join(outAbs, 'targets.csv');
  runSql(opts.pg, SQL_TARGETS([...targets.values()].map((t) => [t.chainId, t.address]), tvCsv), outAbs);
  const tv = parseCsv(fs.readFileSync(tvCsv, 'utf8')).map((r) => ({
    key: key(r.chain_id, r.address), chainId: Number(r.chain_id), address: r.address, compilationId: r.compilation_id,
    name: r.name, deployer: r.deployer === '0x' ? null : r.deployer, ctor: r.ctor, n: Number(r.n), exact: r.exact === 't',
  }));
  const byTarget = new Map();
  for (const r of tv) { if (!byTarget.has(r.key)) byTarget.set(r.key, []); byTarget.get(r.key).push(r); }
  log(`${byTarget.size} targets verified in Sourcify, ${new Set(tv.map((r) => r.compilationId)).size} compilations`);

  // step 3: classify + resolve proxies
  const names = await chainNames(opts.cache);
  const classified = new Map(); // key -> {class, rows, impl?}
  await mapLimit([...byTarget.entries()], 6, async ([k, rows]) => {
    const r = rows[0];
    const t = targets.get(k);
    const looksProxy = /proxy/i.test(r.name) || r.n > GENERIC_THRESHOLD;
    const pr = looksProxy ? await proxyResolution(t.chainId, t.address, opts.cache) : null;
    if (pr && pr.implementations.length === 1) classified.set(k, { class: 'proxy', rows, proxyType: pr.type, impl: pr.implementations[0] });
    else if (r.n > GENERIC_THRESHOLD) classified.set(k, { class: 'unresolved-proxy', rows });
    else if (r.n > CLONE_THRESHOLD) classified.set(k, { class: 'clone', rows });
    else classified.set(k, { class: 'singleton', rows });
  });
  const counts = {};
  for (const c of classified.values()) counts[c.class] = (counts[c.class] || 0) + 1;
  log(`classes: ${JSON.stringify(counts)}`);

  // implementations behind proxies -> their compilations
  const implPairs = [...classified.values()].filter((c) => c.class === 'proxy').map((c) => [c.rows[0].chainId, c.impl]);
  let implRows = [];
  if (implPairs.length) {
    const implCsv = path.join(outAbs, 'impls.csv');
    runSql(opts.pg, SQL_TARGETS(implPairs, implCsv), outAbs);
    implRows = parseCsv(fs.readFileSync(implCsv, 'utf8')).map((r) => ({
      key: key(r.chain_id, r.address), compilationId: r.compilation_id, name: r.name, n: Number(r.n),
    }));
  }
  const implByKey = new Map();
  for (const r of implRows) { if (!implByKey.has(r.key)) implByKey.set(r.key, []); implByKey.get(r.key).push(r); }
  for (const [k, c] of classified) if (c.class === 'proxy') {
    const rows = implByKey.get(key(c.rows[0].chainId, c.impl)) || [];
    c.implRows = rows;
    if (!rows.length) c.class = 'proxy-impl-unverified';
    else if (rows[0].n > CLONE_THRESHOLD) c.class = 'proxy-impl-generic';
  }

  // step 4: siblings of singleton compilations and of implementation compilations
  const sibCompilations = new Set();
  for (const c of classified.values()) {
    if (c.class === 'singleton') c.rows.forEach((r) => sibCompilations.add(r.compilationId));
    if (c.class === 'proxy') c.implRows.forEach((r) => sibCompilations.add(r.compilationId));
  }
  const sibCsv = path.join(outAbs, 'siblings.csv');
  runSql(opts.pg, SQL_SIBLINGS([...sibCompilations], sibCsv), outAbs);
  const sibByComp = new Map();
  for (const r of parseCsv(fs.readFileSync(sibCsv, 'utf8'))) {
    const row = { chainId: Number(r.chain_id), address: r.address, deployer: r.deployer === '0x' ? null : r.deployer, ctor: r.ctor, exact: r.exact === 't' };
    if (!sibByComp.has(r.compilation_id)) sibByComp.set(r.compilation_id, []);
    sibByComp.get(r.compilation_id).push(row);
  }
  log(`${[...sibByComp.values()].reduce((a, b) => a + b.length, 0)} sibling rows over ${sibByComp.size} compilations`);

  // proxies: candidate proxies pointing at sibling implementations, confirmed on chain
  const proxyTargets = [...classified.entries()].filter(([, c]) => c.class === 'proxy');
  const siblingImplKeys = new Set(); // chain:addr of implementations that are siblings of a target's impl
  const implKeyToComp = new Map();
  const implCompToTargets = new Map();
  for (const [k, c] of proxyTargets) for (const ir of c.implRows) {
    for (const s of sibByComp.get(ir.compilationId) || []) { siblingImplKeys.add(key(s.chainId, s.address)); implKeyToComp.set(key(s.chainId, s.address), ir.compilationId); }
    if (!implCompToTargets.has(ir.compilationId)) implCompToTargets.set(ir.compilationId, new Set());
    implCompToTargets.get(ir.compilationId).add(k);
  }
  let confirmedProxies = []; // {targetKey, chainId, address, deployer, via}
  if (proxyTargets.length) {
    const candCsv = path.join(outAbs, 'proxy-candidates.csv');
    const proxyRows = proxyTargets.flatMap(([, c]) => c.rows);
    const genericComps = [...new Set(proxyRows.filter((r) => r.n > GENERIC_THRESHOLD).map((r) => r.compilationId))];
    const specificComps = [...new Set(proxyRows.filter((r) => r.n <= GENERIC_THRESHOLD).map((r) => r.compilationId))];
    const proxyAddrs = [...new Set(proxyTargets.map(([, c]) => c.rows[0].address))];
    const implAddrs = [...new Set([...siblingImplKeys].map((k) => k.split(':')[1]))];
    runSql(opts.pg, SQL_PROXY_CANDIDATES(proxyAddrs, genericComps, specificComps, implAddrs, candCsv), outAbs);
    const cands = parseCsv(fs.readFileSync(candCsv, 'utf8'))
      .map((r) => ({ chainId: Number(r.chain_id), address: r.address, deployer: r.deployer === '0x' ? null : r.deployer, via: r.via }))
      .filter((c) => !EXCLUDED_CHAINS.has(c.chainId) && !targets.has(key(c.chainId, c.address)));
    log(`${cands.length} proxy candidates to confirm on chain`);
    const impls = await mapLimit(cands, 6, (c) => proxyResolution(c.chainId, c.address, opts.cache).catch(() => null));
    cands.forEach((c, i) => {
      const pr = impls[i];
      if (!pr || pr.implementations.length !== 1) return;
      const implKey = key(c.chainId, pr.implementations[0]);
      if (!siblingImplKeys.has(implKey)) return;
      // which target(s) does this implementation compilation belong to?
      for (const tk of implCompToTargets.get(implKeyToComp.get(implKey)) || []) confirmedProxies.push({ targetKey: tk, ...c, impl: pr.implementations[0] });
    });
    log(`${confirmedProxies.length} proxy candidates confirmed`);
  }

  // step 5: score per holder file
  const report = [];
  for (const [h, info] of holders) {
    const entry = { holder: h, kind: info.kind, descriptors: info.descriptors, targets: [], candidates: [], notes: [] };
    const seen = new Map(); // candidate key -> candidate
    const consider = (cand, evidence) => {
      const ck = key(cand.chainId, cand.address);
      if (EXCLUDED_CHAINS.has(cand.chainId) || info.deployments.has(ck)) return;
      if (allBound.has(ck)) { entry.notes.push(`${ck} is already bound by ${allBound.get(ck)}`); return; }
      const prev = seen.get(ck);
      const rank = { high: 3, medium: 2, low: 1 };
      if (!prev || rank[evidence.confidence] > rank[prev.confidence]) seen.set(ck, { chainId: cand.chainId, address: toChecksum(cand.address), chain: names.get(cand.chainId) || String(cand.chainId), testnet: isTestnet(names.get(cand.chainId)), ...evidence });
    };
    const holderTargets = [...info.deployments.keys()].map((k) => ({ k, t: targets.get(k), c: classified.get(k) }));
    const tDeployers = new Set(holderTargets.flatMap(({ k }) => (byTarget.get(k) || []).map((r) => r.deployer)).filter(Boolean));
    const tAddrs = new Set(holderTargets.map(({ t }) => t.address.toLowerCase()));
    const tCtors = new Set(holderTargets.flatMap(({ k }) => (byTarget.get(k) || []).map((r) => r.ctor)));
    for (const { k, t, c } of holderTargets) {
      const row = (byTarget.get(k) || [])[0];
      entry.targets.push({ chainId: t.chainId, address: t.address, verified: !!row, class: c ? c.class : 'unverified', name: row && row.name, deployments: row && row.n, impl: c && c.impl });
      if (!c) continue;
      if (c.class === 'singleton') {
        for (const r of c.rows) for (const s of sibByComp.get(r.compilationId) || []) {
          const same = s.address.toLowerCase() === t.address.toLowerCase();
          const sameChain = s.chainId === t.chainId;
          const sameDeployer = s.deployer && tDeployers.has(s.deployer);
          const conf = sameChain ? 'low' : same ? 'high' : sameDeployer || tCtors.has(s.ctor) ? 'medium' : 'low';
          const why = sameChain ? 'same chain as the target (old version or copy?)' : same ? 'same address' : sameDeployer ? `same deployer ${s.deployer}` : tCtors.has(s.ctor) ? 'same constructor arguments' : 'constructor arguments differ';
          consider(s, { confidence: conf, reason: `${r.name}: same compilation as ${t.chainId}:${t.address}; ${why}`, exact: s.exact });
        }
      } else if (c.class === 'proxy') {
        for (const p of confirmedProxies.filter((p) => p.targetKey === k)) {
          const same = tAddrs.has(p.address.toLowerCase());
          const conf = p.chainId === t.chainId ? 'low' : same ? 'high' : 'medium';
          consider(p, { confidence: conf, reason: `proxy (${c.proxyType}) whose implementation ${p.impl} is the same compilation as the implementation of ${t.chainId}:${t.address}; ${same ? 'same address' : p.deployer && tDeployers.has(p.deployer) ? 'same deployer' : 'found via ' + p.via}` });
        }
      } else if (c.class === 'clone') {
        entry.notes.push(`${t.chainId}:${t.address} (${row.name}) is one of ${row.n} instances of the same code — factory/clone pattern, not expanded`);
      } else if (c.class === 'unresolved-proxy' || c.class === 'proxy-impl-unverified' || c.class === 'proxy-impl-generic') {
        entry.notes.push(`${t.chainId}:${t.address} (${row.name}, ${row.n} twins): ${c.class}${c.impl ? ' impl ' + c.impl : ''}`);
      }
    }
    entry.candidates = [...seen.values()].sort((a, b) => a.chainId - b.chainId || a.address.localeCompare(b.address));
    if (entry.candidates.length || entry.notes.length || entry.targets.some((t) => !t.verified)) report.push(entry);
  }

  fs.writeFileSync(path.join(outAbs, 'report.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(outAbs, 'report.md'), renderMarkdown(report));
  const totals = { high: 0, medium: 0, low: 0 };
  for (const e of report) for (const c of e.candidates) totals[c.confidence]++;
  log(`candidates: ${JSON.stringify(totals)} — report in ${outAbs}/report.md`);

  if (opts.apply) applyCandidates(report, opts.apply, log);
}

function renderMarkdown(report) {
  const lines = ['# Missing deployments report', ''];
  for (const e of report) {
    lines.push(`## ${e.holder}`, '');
    if (e.descriptors.length > 1 || e.descriptors[0] !== e.holder) lines.push(`Used by: ${e.descriptors.join(', ')}`, '');
    const unverified = e.targets.filter((t) => !t.verified);
    if (unverified.length) lines.push(`Not verified in Sourcify: ${unverified.map((t) => `${t.chainId}:${t.address}`).join(', ')}`, '');
    for (const conf of ['high', 'medium', 'low']) {
      const cs = e.candidates.filter((c) => c.confidence === conf);
      if (!cs.length) continue;
      lines.push(`### ${conf} (${cs.length})`, '', '| chain | address | reason |', '|---|---|---|');
      for (const c of cs) lines.push(`| ${c.chain} (${c.chainId})${c.testnet ? ' 🧪' : ''} | [${c.address}](https://repo.sourcify.dev/${c.chainId}/${c.address}) | ${c.reason} |`);
      lines.push('');
    }
    if (e.notes.length) lines.push('Notes:', ...e.notes.map((n) => `- ${n}`), '');
  }
  return lines.join('\n');
}

/** Inserts candidates into the holder file's deployments array. Keeps the
 *  array sorted by chainId when it already is; otherwise appends. */
function applyCandidates(report, level, log) {
  const ok = level === 'high' ? new Set(['high']) : new Set(['high', 'medium']);
  for (const e of report) {
    const adds = e.candidates.filter((c) => ok.has(c.confidence));
    if (!adds.length) continue;
    const file = path.join(REPO_ROOT, e.holder);
    const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    const deps = doc.context[e.kind].deployments;
    const sorted = deps.every((d, i) => i === 0 || deps[i - 1].chainId <= d.chainId);
    for (const c of adds) {
      const item = { chainId: c.chainId, address: c.address };
      if (sorted) {
        let i = deps.findIndex((d) => d.chainId > c.chainId || (d.chainId === c.chainId && d.address.toLowerCase() > c.address.toLowerCase()));
        if (i === -1) i = deps.length;
        deps.splice(i, 0, item);
      } else deps.push(item);
    }
    fs.writeFileSync(file, JSON.stringify(doc, null, 2) + '\n');
    log(`applied ${adds.length} deployments to ${e.holder}`);
  }
}

main().catch((e) => { process.stderr.write(`Error: ${e.stack || e}\n`); process.exit(1); });
