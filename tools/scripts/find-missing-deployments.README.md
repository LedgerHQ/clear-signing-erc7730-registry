# find-missing-deployments

Finds deployments that a descriptor should probably list but does not, and
optionally adds them.

## Why

A descriptor binds to a contract through `context.contract.deployments` (or
`context.eip712.deployments`): a list of `(chainId, address)` pairs. Authors
often list the mainnet deployment and forget the testnets, or the newer L2s.

Sourcify stores, for every verified deployment, the *compilation* it was
matched against, and deduplicates compilations. Two deployments of
byte-identical compiled code share one compilation row. So "other verified
deployments of the same compilation" is a precise list of "the same contract
elsewhere".

## What it does

1. Reads every descriptor under `registry/`, resolves `includes`, and collects
   every bound `(chainId, address)`. It remembers which file physically holds
   the `deployments` array, because that is the file to edit.
2. Looks each pair up in the Sourcify Postgres database (through `psql`) to get
   its compilation, deployer, and constructor arguments.
3. Classifies each target:
   - **singleton** — project-specific code with few deployments.
   - **proxy** — generic proxy bytecode (`TransparentUpgradeableProxy`,
     `ERC1967Proxy`, …) shared by tens of thousands of unrelated contracts.
     The script reads the EIP-1967 implementation slot over RPC and works with
     the implementation's compilation instead.
   - **clone** — project code with more than 200 instances (vaults, safes).
     Reported only, never added.
4. Collects sibling deployments of the same compilation. For proxies, it looks
   for proxies whose constructor arguments point to a sibling implementation
   and confirms the current implementation on chain.
5. Scores each candidate. Same compilation is necessary but not sufficient:
   USDT and WETH9 have copycat deployments on mainnet itself, and one deployer
   account often creates many different tokens or vaults from the same code.
   - **high** — same address on a *different* chain. Deterministic
     deployments (CREATE2, same deployer nonce) are the only signal that
     identifies the same *instance*.
   - **medium** — different chain, with the same deployer or identical
     constructor arguments, or a confirmed proxy at a different address.
     Needs a human check.
   - **low** — everything else, including every same-chain sibling.
6. Writes `report.json` and `report.md`. With `--apply high` it inserts the
   high-confidence pairs into the holder files.

PulseChain (369, 943) is never suggested: it is a fork of mainnet, so every
mainnet contract "exists" there. Dead testnets (Goerli, Mumbai, …) are skipped
too.

## Usage

```
node tools/scripts/find-missing-deployments.js --out /tmp/missing
node tools/scripts/find-missing-deployments.js --out /tmp/missing --apply high --only registry/safe/
node tools/scripts/find-missing-deployments.js --report /tmp/missing/report.json --apply high --only registry/safe/
```

After `--apply`, run `erc7730 format` on the changed files and
`node tools/scripts/generate-index.js --validate`.

## Requirements

- `psql` on `PATH` with read access to the Sourcify database (`~/.pgpass`).
  Override the connection with `--pg "-h host -U user -d db"`.
- Network access to `sourcify.dev` (chain list, API fallback) and to public
  RPC endpoints. Set `DRPC_API_KEY` to use the DRPC endpoints from the
  Sourcify chain list; otherwise the public endpoints from chainid.network
  are used.
