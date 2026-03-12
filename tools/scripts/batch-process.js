#!/usr/bin/env node
/**
 * ERC-7730 Batch Processor
 *
 * Processes a registry subfolder to:
 * - Generate missing test files
 * - Migrate v1 schema files to v2 (linting/validation is handled by migrate-v1-to-v2.js)
 * - Run clear-signing tests after migration
 * - Optionally create a PR with all changes
 *
 * Usage:
 *   node tools/scripts/batch-process.js <registry-subfolder> [options]
 *
 * Options:
 *   --dry-run               Preview changes without modifying files
 *   --verbose               Show detailed output
 *   --verbose-test-summary  Show detailed per-test summary output (implied by --verbose)
 *   --log <path>            Enable verbose logging and write to file
 *   -l                      Enable verbose logging to tools/scripts/logs/
 *   --skip-tests            Skip test generation
 *   --skip-lint             Skip linting during migration
 *   --skip-migration        Skip v1 to v2 migration
 *   --pr                    Create a branch and PR with changes
 *   --pr-draft              Create the PR in draft mode
 *   --pr-strict             Prevent PR creation if any step fails
 *   --pr-title <title>      Custom PR title
 *   --pr-branch <name>      Custom branch name
 *   --local-api             Auto-start local Flask API server for the tester
 *   --local-api-port <port> Port for the local API server (default: 5000)
 *   --include-external-deps Also migrate included files outside target folder
 *
 * Test generation options (cascaded to generate-tests.js):
 *   --depth <n>             Max transactions to search (default: 100)
 *   --max-tests <n>         Max tests to generate per function (default: 3)
 *   --chain <id>            Only process specific chain ID
 *   --compact               Only process one chain + one deployment address
 *   --backend <name>        LLM backend: openai, anthropic, cursor (default: openai)
 *   --model <model>         Model name (default depends on backend)
 *   --api-key <key>         API key (overrides env var for the selected backend)
 *   --api-url <url>         Custom API base URL (openai/anthropic backends only)
 *   --no-test               Skip running the clear signing tester after generation
 *   --force-test            Run tester even when test file already exists
 *   --device <device>       Tester device: flex, stax, nanosp, nanox (default: flex)
 *   --test-log-level <lvl>  Tester log level: none, error, warn, info, debug (default: info)
 *   --no-refine             Skip refining expectedTexts from tester screen output
 *   --help, -h              Show this help message
 *
 * Environment Variables:
 *   GITHUB_TOKEN        GitHub token for PR creation (required for --pr)
 *   ETHERSCAN_API_KEY   For test generation (fetching transactions)
 *   OPENAI_API_KEY      For EIP-712 test generation
 */

const fs = require("fs");
const path = require("path");
const http = require("http");
const { execSync, spawnSync, spawn } = require("child_process");

// =============================================================================
// Configuration
// =============================================================================

const LOGS_DIR = path.join(__dirname, "logs");
const DEFAULT_LOG_FILE = path.join(LOGS_DIR, `batch-process-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.verbose.log`);
const LOG_FILE_PATH = getLogFilePath();

const CONFIG = {
  dryRun: process.argv.includes("--dry-run"),
  verbose: process.argv.includes("--verbose"),
  verboseTestSummary: process.argv.includes("--verbose") || process.argv.includes("--verbose-test-summary"),
  logVerbose: Boolean(LOG_FILE_PATH),
  logFile: LOG_FILE_PATH,
  skipTests: process.argv.includes("--skip-tests"),
  skipLint: process.argv.includes("--skip-lint"),
  skipMigration: process.argv.includes("--skip-migration"),
  pr: process.argv.includes("--pr"),
  prDraft: process.argv.includes("--pr-draft"),
  prStrict: process.argv.includes("--pr-strict"),
  prTitle: getArgValue("--pr-title", null),
  prBranch: getArgValue("--pr-branch", null),
  localApi: process.argv.includes("--local-api"),
  localApiPort: getArgValue("--local-api-port", 5000),
  includeExternalDeps: process.argv.includes("--include-external-deps"),
  // Parameters cascaded to generate-tests.js
  depth: getArgValue("--depth", null),
  maxTests: getArgValue("--max-tests", null),
  chainFilter: getArgValue("--chain", null),
  compact: process.argv.includes("--compact"),
  backend: getArgValue("--backend", null),
  model: getArgValue("--model", null),
  apiKey: getArgValue("--api-key", null),
  apiUrl: getArgValue("--api-url", null),
  noTest: process.argv.includes("--no-test"),
  forceTest: process.argv.includes("--force-test"),
  testDevice: getArgValue("--device", null),
  testLogLevel: getArgValue("--test-log-level", null),
  noRefine: process.argv.includes("--no-refine"),
};

function getArgValue(flag, defaultValue) {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && process.argv[idx + 1] && !process.argv[idx + 1].startsWith("-")) {
    return process.argv[idx + 1];
  }
  return defaultValue;
}

function getLogFilePath() {
  const logFlagIndex = process.argv.indexOf("--log");
  if (logFlagIndex !== -1) {
    const provided = process.argv[logFlagIndex + 1];
    if (!provided || provided.startsWith("-")) {
      console.error("Missing log file path for --log");
      process.exit(1);
    }
    return path.resolve(provided);
  }

  if (process.argv.includes("-l")) {
    return DEFAULT_LOG_FILE;
  }

  return null;
}

function printHelp(exitCode = 0, errorMessage = null) {
  const write = exitCode === 0 ? console.log : console.error;
  if (errorMessage) {
    write(errorMessage);
    write("");
  }
  write("Usage: node tools/scripts/batch-process.js <registry-subfolder> [options]");
  write("\nOptions:");
  write("  --dry-run               Preview changes without modifying files");
  write("  --verbose               Show detailed output");
  write("  --verbose-test-summary  Show detailed per-test summary output (implied by --verbose)");
  write("  --log <path>            Enable verbose logging and write to file");
  write("  -l                      Enable verbose logging to tools/scripts/logs/");
  write("  --skip-tests            Skip test generation");
  write("  --skip-lint             Skip linting during migration");
  write("  --skip-migration        Skip v1 to v2 migration");
  write("  --pr                    Create a branch and PR with changes");
  write("  --pr-draft              Create the PR in draft mode");
  write("  --pr-strict             Prevent PR creation if any step fails");
  write("  --pr-title <title>      Custom PR title");
  write("  --pr-branch <name>      Custom branch name");
  write("  --local-api             Auto-start local Flask API server (patched erc7730)");
  write("  --local-api-port <port> Port for the local API server (default: 5000)");
  write("  --include-external-deps Also migrate included files outside target folder");
  write("  --help, -h              Show this help message");
  write("\nTest generation options (cascaded to generate-tests.js):");
  write("  --depth <n>             Max transactions to search (default: 100)");
  write("  --max-tests <n>         Max tests per function (default: 3)");
  write("  --chain <id>            Only process specific chain ID");
  write("  --compact               Only process one chain + one deployment address");
  write("  --backend <name>        LLM backend: openai, anthropic, cursor (default: openai)");
  write("  --model <model>         Model name (default: backend-specific)");
  write("  --api-key <key>         API key (overrides env var for the selected backend)");
  write("  --api-url <url>         Custom API base URL (openai/anthropic backends only)");
  write("  --no-test               Skip running the clear signing tester after generation");
  write("  --force-test            Run tester even when test file already exists");
  write("  --device <device>       Tester device: flex, stax, nanosp, nanox (default: flex)");
  write("  --test-log-level <lvl>  Tester log level: none, error, warn, info, debug (default: info)");
  write("  --no-refine             Skip refining expectedTexts from tester screen output");
  write("\nExamples:");
  write("  node tools/scripts/batch-process.js 1inch --dry-run");
  write("  node tools/scripts/batch-process.js registry/ethena --verbose");
  write("  node tools/scripts/batch-process.js morpho --pr");
  write("  node tools/scripts/batch-process.js figment --local-api --verbose");
  write("  node tools/scripts/batch-process.js ethena --device stax --no-refine");
  process.exit(exitCode);
}

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  printHelp(0);
}

// Paths
const ROOT_DIR = path.join(__dirname, "..", "..");
const REGISTRY_DIR = path.join(ROOT_DIR, "registry");
const MIGRATE_SCRIPT = path.join(__dirname, "migrate-v1-to-v2.js");
const GENERATE_TESTS_SCRIPT = path.join(__dirname, "generate-tests.js");
const TESTER_SCRIPT = path.join(ROOT_DIR, "tools", "tester", "run-test.sh");

// =============================================================================
// Logging
// =============================================================================

const INTERACTIVE_PROGRESS = !CONFIG.verbose && !!process.stdout.isTTY;
let _activeInlineProgress = false;

function ensureProgressLineBreak() {
  if (INTERACTIVE_PROGRESS && _activeInlineProgress) {
    process.stdout.write("\n");
    _activeInlineProgress = false;
  }
}

function renderInlineProgressLine(text, done, total) {
  if (!INTERACTIVE_PROGRESS) {
    console.log(text);
    return;
  }

  const prefix = _activeInlineProgress ? "\r\x1b[2K" : "";
  process.stdout.write(prefix + text);
  _activeInlineProgress = true;

  if (total !== null && total !== undefined && total > 0 && done >= total) {
    process.stdout.write("\n");
    _activeInlineProgress = false;
  }
}

function log(message, level = "info") {
  const prefix = {
    info: "ℹ️ ",
    success: "✅ ",
    warning: "⚠️ ",
    error: "❌ ",
    debug: "🔍 ",
  };
  if (level === "debug" && !CONFIG.verbose && !CONFIG.logVerbose) return;
  ensureProgressLineBreak();
  const rendered = `${prefix[level] || ""}${message}`;
  appendLogLine(level.toUpperCase(), rendered);
  if (level !== "debug" || CONFIG.verbose) {
    console.log(rendered);
  }
}

function logSection(title) {
  ensureProgressLineBreak();
  console.log(`\n${"=".repeat(60)}`);
  console.log(`📦 ${title}`);
  console.log(`${"=".repeat(60)}\n`);
}

function formatProgressBar(done, total, width = 20) {
  if (!total || total <= 0) {
    return `[${"-".repeat(width)}]`;
  }
  const ratio = Math.max(0, Math.min(1, done / total));
  const filled = Math.round(ratio * width);
  return `[${"#".repeat(filled)}${"-".repeat(width - filled)}]`;
}

function printPhaseProgress(label, done, total, suffix = "") {
  if (CONFIG.verbose || !total || total <= 0) return;
  ensureProgressLineBreak();
  console.log(`   ${label}: ${formatProgressBar(done, total)} ${done}/${total}${suffix}`);
}

function printPhaseStart(label, nextIndex, total, relPath) {
  if (CONFIG.verbose || !total || total <= 0) return;
  ensureProgressLineBreak();
  console.log(`   ${label}: starting ${nextIndex}/${total} (${relPath})`);
}

function stripAnsi(text) {
  return String(text || "").replace(/\x1B\[[0-9;]*m/g, "");
}

const TEST_EVENT_PREFIX = "@@TEST_EVENT@@";
const ANSI = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
};

function colorStatus(text, tone) {
  if (!process.stdout.isTTY) return text;
  const color = tone === "ok" ? ANSI.green : tone === "warn" ? ANSI.yellow : tone === "error" ? ANSI.red : null;
  if (!color) return text;
  return `${color}${text}${ANSI.reset}`;
}

function initLogFile() {
  if (!CONFIG.logFile) return;
  try {
    fs.mkdirSync(path.dirname(CONFIG.logFile), { recursive: true });
    fs.appendFileSync(
      CONFIG.logFile,
      `\n[${new Date().toISOString()}] batch-process start: ${process.argv.join(" ")}\n`
    );
  } catch (error) {
    console.error(`Failed to initialize log file ${CONFIG.logFile}: ${error.message}`);
    process.exit(1);
  }
}

function appendLogLine(level, message) {
  if (!CONFIG.logFile) return;
  const clean = stripAnsi(message);
  if (!clean) return;
  try {
    fs.appendFileSync(CONFIG.logFile, `[${new Date().toISOString()}] [${level}] ${clean}\n`);
  } catch {
    // Logging should not break migration flow.
  }
}

initLogFile();

function printCommandErrorOutput(label, stdout, stderr, maxLines = 20) {
  if (CONFIG.verbose) return;

  const clean = stripAnsi(`${stdout || ""}\n${stderr || ""}`).trim();
  if (!clean) return;

  const lines = clean
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) return;

  const errorLike = lines.filter((line) =>
    /(error|failed|failure|fatal|traceback|exception|keyboardinterrupt|^\s*\^C\s*$|^\s*❌)/i.test(line)
  );
  const picked = (errorLike.length > 0 ? errorLike : lines).slice(-maxLines);

  console.log(`   ${label} (last ${picked.length} line${picked.length > 1 ? "s" : ""}):`);
  for (const line of picked) {
    console.log(`     ${line}`);
  }
}

function printIndividualTestProgress(phaseLabel, relPath, done, total) {
  if (CONFIG.verbose) return;
  if (total === null || total === undefined || total <= 0) {
    // Total may be unknown during generation until the test file is written.
    renderInlineProgressLine(`      ${phaseLabel} tests: ${done}/? (${relPath})`, done, null);
    return;
  }
  renderInlineProgressLine(
    `      ${phaseLabel} tests: ${formatProgressBar(done, total, 16)} ${done}/${total} (${relPath})`,
    done,
    total
  );
}

function streamToLines(stream, onLine, onChunk) {
  let buffer = "";
  stream.on("data", (chunk) => {
    const text = chunk.toString();
    if (onChunk) onChunk(text);
    buffer += text;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";
    for (const line of lines) {
      onLine(line);
    }
  });
  stream.on("end", () => {
    if (buffer) onLine(buffer);
  });
}

function spawnAndCapture(command, args, options = {}) {
  const { cwd = ROOT_DIR, env = process.env, onStdoutLine, onStderrLine } = options;
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    streamToLines(
      child.stdout,
      (line) => {
        if (onStdoutLine) onStdoutLine(line);
      },
      (text) => {
        stdout += text;
        appendLogLine("STDOUT", text);
        if (CONFIG.verbose) process.stdout.write(text);
      }
    );

    streamToLines(
      child.stderr,
      (line) => {
        if (onStderrLine) onStderrLine(line);
      },
      (text) => {
        stderr += text;
        appendLogLine("STDERR", text);
        if (CONFIG.verbose) process.stderr.write(text);
      }
    );

    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ status: code ?? 1, stdout, stderr });
    });
  });
}

function parseTestEventLine(line) {
  const text = String(line || "").trim();
  if (!text.startsWith(TEST_EVENT_PREFIX)) return null;
  const payload = text.slice(TEST_EVENT_PREFIX.length);
  if (!payload) return null;
  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

function initGeneratePhaseMetrics() {
  return {
    generationTargets: [],
    generationSummary: { skippedFunctions: 0, generatedFunctions: 0, totalTestCases: 0 },
    refinementCases: [],
    refinementSummary: { refined: 0, failed: 0, total: 0 },
    testerProgress: { started: false, screenshots: 0, verified: 0, complete: false },
  };
}

function shortenText(text, maxLen = 72) {
  const clean = String(text || "").trim().replace(/\s+/g, " ");
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, Math.max(0, maxLen - 1))}…`;
}

function alignWithRightStatus(leftText, statusText, width = 108) {
  const left = String(leftText || "");
  const right = String(statusText || "");
  const pad = Math.max(1, width - stripAnsi(left).length - stripAnsi(right).length);
  return `${left}${" ".repeat(pad)}${right}`;
}

function renderStatusTag(tag, tone) {
  return colorStatus(`[${tag}]`, tone);
}

function parseFinalTestResultStatus(line) {
  const clean = stripAnsi(line);
  const resultMatch = clean.match(/Result:\s*(.+)$/);
  if (!resultMatch) return null;
  const text = resultMatch[1].toLowerCase();
  if (text.includes("clear signed")) return "clear";
  if (text.includes("partial")) return "partial";
  if (text.includes("blind")) return "blind";
  return "failed";
}

function formatTestCaseLabel(description) {
  const clean = String(description || "").trim();
  if (!clean) return "(no description)";
  const parts = clean.split(" - ");
  if (parts.length <= 1) return shortenText(clean, 68);
  const fn = shortenText(parts[0], 28);
  const rest = shortenText(parts.slice(1).join(" - "), 36);
  return `${fn} - ${rest}`;
}

// =============================================================================
// Report
// =============================================================================

class Report {
  constructor() {
    this.filesProcessed = 0;
    this.migrations = { attempted: 0, successful: 0, failed: [], skipped: 0 };
    this.testGeneration = { attempted: 0, successful: 0, failed: [], skipped: 0 };
    this.modifiedFiles = [];
    this.newFiles = [];
    this.prCreated = false;
    this.prUrl = null;
  }

  addModifiedFile(filePath) {
    if (!this.modifiedFiles.includes(filePath)) {
      this.modifiedFiles.push(filePath);
    }
  }

  addNewFile(filePath) {
    if (!this.newFiles.includes(filePath)) {
      this.newFiles.push(filePath);
    }
  }

  print() {
    console.log("\n" + "=".repeat(60));
    console.log("📊 BATCH PROCESSING SUMMARY");
    console.log("=".repeat(60));

    console.log(`\n📁 Files processed: ${this.filesProcessed}`);

    console.log("\n🔄 Migrations:");
    console.log(`   Attempted:  ${this.migrations.attempted}`);
    console.log(`   Successful: ${this.migrations.successful}`);
    console.log(`   Skipped:    ${this.migrations.skipped}`);
    if (this.migrations.failed.length > 0) {
      console.log(`   Failed:     ${this.migrations.failed.length}`);
      this.migrations.failed.forEach((f) => console.log(`     - ${f.file}: ${f.error}`));
    }

    console.log("\n🧪 Test Generation:");
    console.log(`   Attempted:  ${this.testGeneration.attempted}`);
    console.log(`   Successful: ${this.testGeneration.successful}`);
    console.log(`   Skipped:    ${this.testGeneration.skipped}`);
    if (this.testGeneration.failed.length > 0) {
      console.log(`   Failed:     ${this.testGeneration.failed.length}`);
      this.testGeneration.failed.forEach((f) => console.log(`     - ${f.file}: ${f.error}`));
    }

    console.log("\n📝 Changes:");
    console.log(`   Modified files: ${this.modifiedFiles.length}`);
    this.modifiedFiles.forEach((f) => console.log(`     - ${path.relative(ROOT_DIR, f)}`));
    console.log(`   New files:      ${this.newFiles.length}`);
    this.newFiles.forEach((f) => console.log(`     - ${path.relative(ROOT_DIR, f)}`));

    if (this.prCreated) {
      console.log(`\n🔗 PR Created: ${this.prUrl}`);
    }

    console.log("\n" + "=".repeat(60));
  }
}

// =============================================================================
// File Discovery
// =============================================================================

/**
 * Find all ERC-7730 JSON files in a directory (excluding test files)
 */
function findErc7730Files(dir) {
  const files = [];
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    return files;
  }

  function walk(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        // Skip tests directories and heavy/non-source folders
        if (
          entry.name !== "tests" &&
          entry.name !== ".git" &&
          entry.name !== "node_modules" &&
          entry.name !== ".cursor" &&
          entry.name !== "output"
        ) {
          walk(fullPath);
        }
      } else if (entry.isFile() && entry.name.endsWith(".json")) {
        // Skip test files, keep shared descriptor files (e.g. common-*.json)
        if (!entry.name.includes(".tests.") && isErc7730DescriptorFile(fullPath)) {
          files.push(fullPath);
        }
      }
    }
  }

  walk(dir);
  return files;
}

/**
 * Check if JSON file is an ERC-7730 descriptor (v1 or v2).
 */
function isErc7730DescriptorFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    const json = JSON.parse(content);
    return typeof json?.$schema === "string" && json.$schema.includes("erc7730-");
  } catch (e) {
    return false;
  }
}

/**
 * Read descriptor JSON if valid.
 */
function readDescriptorJson(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    const json = JSON.parse(content);
    if (typeof json?.$schema === "string" && json.$schema.includes("erc7730-")) {
      return json;
    }
  } catch (e) {
    // ignore parse errors
  }
  return null;
}

/**
 * Normalize includes to a list.
 */
function getIncludesList(descriptorJson) {
  if (typeof descriptorJson?.includes === "string") {
    return [descriptorJson.includes];
  }
  if (Array.isArray(descriptorJson?.includes)) {
    return descriptorJson.includes.filter((v) => typeof v === "string");
  }
  return [];
}

/**
 * Resolve include path relative to descriptor file.
 */
function resolveIncludePath(filePath, includeValue) {
  if (!includeValue || typeof includeValue !== "string") return null;
  if (/^[a-z]+:\/\//i.test(includeValue)) {
    // External URL include, not part of local repo graph
    return null;
  }
  return path.normalize(path.resolve(path.dirname(filePath), includeValue));
}

/**
 * Build repository-level dependency graph from all known descriptor files.
 *
 * Edge direction:
 * - dependency (included file) -> dependent (including file)
 */
function buildDependencyGraph(descriptorFiles) {
  /** @type {Map<string, { includes: Set<string>, dependents: Set<string> }>} */
  const graph = new Map();

  for (const file of descriptorFiles) {
    graph.set(file, { includes: new Set(), dependents: new Set() });
  }

  for (const file of descriptorFiles) {
    const descriptor = readDescriptorJson(file);
    if (!descriptor) continue;

    const includeRefs = getIncludesList(descriptor);
    for (const includeRef of includeRefs) {
      const includePath = resolveIncludePath(file, includeRef);
      if (!includePath) continue;

      // Keep only local ERC-7730 descriptors present in the graph
      if (!graph.has(includePath)) continue;

      graph.get(file).includes.add(includePath);
      graph.get(includePath).dependents.add(file);
    }
  }

  return graph;
}

/**
 * Order files so dependencies (roots) are processed before dependents (leafs).
 *
 * @param {string[]} filesToProcess
 * @param {Map<string, { includes: Set<string>, dependents: Set<string> }>} graph
 * @returns {string[]}
 */
function orderFilesByDependencies(filesToProcess, graph) {
  const selected = new Set(filesToProcess);
  const indegree = new Map();

  for (const file of filesToProcess) {
    const node = graph.get(file);
    if (!node) {
      indegree.set(file, 0);
      continue;
    }
    const internalDeps = [...node.includes].filter((dep) => selected.has(dep));
    indegree.set(file, internalDeps.length);
  }

  const ready = filesToProcess
    .filter((file) => indegree.get(file) === 0)
    .sort((a, b) => a.localeCompare(b));
  const ordered = [];

  while (ready.length > 0) {
    const current = ready.shift();
    ordered.push(current);

    const currentNode = graph.get(current);
    if (!currentNode) continue;

    for (const dependent of currentNode.dependents) {
      if (!selected.has(dependent)) continue;
      indegree.set(dependent, indegree.get(dependent) - 1);
      if (indegree.get(dependent) === 0) {
        ready.push(dependent);
        ready.sort((a, b) => a.localeCompare(b));
      }
    }
  }

  // Handle unexpected cycles by appending remaining files in deterministic order
  if (ordered.length < filesToProcess.length) {
    const remaining = filesToProcess
      .filter((file) => !ordered.includes(file))
      .sort((a, b) => a.localeCompare(b));
    ordered.push(...remaining);
    log(
      `Dependency cycle detected for ${remaining.length} file(s); using deterministic fallback order`,
      "warning"
    );
  }

  return ordered;
}

/**
 * Collect transitive dependency files for the target set.
 */
function collectTransitiveDependencies(startFiles, graph) {
  const visited = new Set(startFiles);
  const stack = [...startFiles];

  while (stack.length > 0) {
    const current = stack.pop();
    const node = graph.get(current);
    if (!node) continue;

    for (const dep of node.includes) {
      if (visited.has(dep)) continue;
      visited.add(dep);
      stack.push(dep);
    }
  }

  return visited;
}

/**
 * Check if file is v1 schema
 */
function isV1Schema(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    const json = JSON.parse(content);
    return json.$schema?.includes("erc7730-v1.schema.json");
  } catch (e) {
    return false;
  }
}

/**
 * Get test file path for a descriptor
 */
function getTestFilePath(descriptorPath) {
  const dir = path.dirname(descriptorPath);
  const baseName = path.basename(descriptorPath, ".json");
  return path.join(dir, "tests", `${baseName}.tests.json`);
}

/**
 * Read number of tests from a *.tests.json file.
 * @returns {number|null}
 */
function getTestCountFromFile(testFilePath) {
  try {
    if (!fs.existsSync(testFilePath)) return null;
    const content = fs.readFileSync(testFilePath, "utf8");
    const json = JSON.parse(content);
    return Array.isArray(json.tests) ? json.tests.length : null;
  } catch {
    return null;
  }
}

/**
 * Best-effort extraction of how many individual tests were executed
 * from tester output captured in stdout/stderr.
 * @returns {number|null}
 */
function extractExecutedTestCount(output) {
  if (!output) return null;

  const countMatches = (regex) => {
    const matches = output.match(regex);
    return matches ? matches.length : 0;
  };

  const candidates = [
    countMatches(/SCREEN TEXT ANALYSIS/g),
    countMatches(/Expected texts from test file:/g),
    countMatches(/Accumulated screen texts from device:/g),
  ];

  const maxCount = Math.max(...candidates);
  return maxCount > 0 ? maxCount : null;
}

// =============================================================================
// Migration
// =============================================================================

/**
 * Migrate a file from v1 to v2
 */
function migrateFile(filePath, report, options = {}) {
  const { skipLint = false } = options;
  report.migrations.attempted++;
  const preMigrationContent = !CONFIG.dryRun && fs.existsSync(filePath)
    ? fs.readFileSync(filePath, "utf8")
    : null;

  const args = ["--file", filePath];
  if (CONFIG.dryRun) args.push("--dry-run");
  if (CONFIG.verbose) args.push("--verbose");
  if (CONFIG.logFile) args.push("--log", CONFIG.logFile);
  if (skipLint) args.push("--skip-lint");

  log(`Migrating: ${path.relative(ROOT_DIR, filePath)}`, "debug");

  try {
    const result = spawnSync("node", [MIGRATE_SCRIPT, ...args], {
      cwd: ROOT_DIR,
      encoding: "utf8",
      stdio: CONFIG.verbose ? "inherit" : "pipe",
    });

    if (result.status !== 0) {
      const fileChanged =
        !CONFIG.dryRun &&
        preMigrationContent !== null &&
        fs.existsSync(filePath) &&
        fs.readFileSync(filePath, "utf8") !== preMigrationContent;

      if (fileChanged) {
        // Keep migrated descriptor in the commit even if post-migration validation failed.
        report.addModifiedFile(filePath);
      }

      printCommandErrorOutput(
        "migrate-v1-to-v2.js error output",
        result.stdout,
        result.stderr
      );
      const combinedError = `${result.stdout || ""}\n${result.stderr || ""}`.trim();
      report.migrations.failed.push({
        file: path.relative(ROOT_DIR, filePath),
        error: combinedError || "Migration script failed",
      });
      return false;
    }

    report.migrations.successful++;
    if (!CONFIG.dryRun) {
      report.addModifiedFile(filePath);
    }
    return true;
  } catch (error) {
    report.migrations.failed.push({
      file: path.relative(ROOT_DIR, filePath),
      error: error.message,
    });
    return false;
  }
}

// =============================================================================
// Test Generation
// =============================================================================

/**
 * Generate test file for a descriptor
 */
async function generateTests(filePath, report) {
  report.testGeneration.attempted++;

  const args = [filePath];
  if (CONFIG.dryRun) args.push("--dry-run");
  if (CONFIG.verbose) args.push("--verbose");
  if (CONFIG.logFile) args.push("--log", CONFIG.logFile);
  args.push("--emit-test-events");
  if (CONFIG.depth) args.push("--depth", String(CONFIG.depth));
  if (CONFIG.maxTests) args.push("--max-tests", String(CONFIG.maxTests));
  if (CONFIG.chainFilter) args.push("--chain", String(CONFIG.chainFilter));
  if (CONFIG.compact) args.push("--compact");
  if (CONFIG.backend) args.push("--backend", CONFIG.backend);
  if (CONFIG.model) args.push("--model", CONFIG.model);
  if (CONFIG.apiKey) args.push("--api-key", CONFIG.apiKey);
  if (CONFIG.apiUrl) args.push("--api-url", CONFIG.apiUrl);
  if (CONFIG.noTest) args.push("--no-test");
  if (CONFIG.forceTest) args.push("--force-test");
  if (CONFIG.testDevice) args.push("--device", CONFIG.testDevice);
  if (CONFIG.testLogLevel) args.push("--test-log-level", CONFIG.testLogLevel);
  if (CONFIG.noRefine) args.push("--no-refine");
  // NOTE: when --local-api is used, batch-process.js starts the server once
  // and passes ERC7730_API_URL via the environment rather than letting each
  // generate-tests.js subprocess start its own server.

  log(`Generating tests: ${path.relative(ROOT_DIR, filePath)}`, "debug");

  try {
    const relPath = path.relative(ROOT_DIR, filePath);
    const metrics = initGeneratePhaseMetrics();
    const preTestFilePath = getTestFilePath(filePath);
    const prePlannedTests = getTestCountFromFile(preTestFilePath);
    let lastProgressLine = "";

    const renderRefinementProgress = () => {
      if (!CONFIG.verboseTestSummary) return;
      if (!metrics.testerProgress.started) return;
      const goal = metrics.refinementSummary.total || prePlannedTests || 0;
      const done = metrics.testerProgress.verified;
      const bar = goal > 0 ? `${formatProgressBar(Math.min(done, goal), goal, 16)} ${done}/${goal}` : `${done}/?`;
      const text = `      refinement progress: ${bar} | screenshots ${metrics.testerProgress.screenshots}`;
      if (text !== lastProgressLine) {
        renderInlineProgressLine(text, goal > 0 ? Math.min(done, goal) : done, goal || null);
        lastProgressLine = text;
      }
    };

    const onLine = (line) => {
      const clean = stripAnsi(line);
      const event = parseTestEventLine(clean);
      if (event) {
        switch (event.event) {
          case "generation_target": {
            metrics.generationTargets.push({
              label: event.label || event.target || "unknown target",
              status: event.status || "skipped",
              testCases: Number(event.testCases || 0),
              reason: event.reason || null,
            });
            if (event.status === "generated") {
              metrics.generationSummary.generatedFunctions++;
              metrics.generationSummary.totalTestCases += Number(event.testCases || 0);
              if (CONFIG.verboseTestSummary) {
                ensureProgressLineBreak();
                const left = `      ${shortenText(event.label || event.target, 82)}`;
                const right = renderStatusTag(`${Number(event.testCases || 0)} test cases`, "ok");
                console.log(alignWithRightStatus(left, right));
              }
            } else {
              metrics.generationSummary.skippedFunctions++;
              if (CONFIG.verboseTestSummary) {
                ensureProgressLineBreak();
                const left = `      ${shortenText(event.label || event.target, 82)}`;
                const right = renderStatusTag("Skipped", "warn");
                console.log(alignWithRightStatus(left, right));
              }
            }
            break;
          }
          case "generation_summary":
            metrics.generationSummary.generatedFunctions = Number(event.generatedTargets || 0);
            metrics.generationSummary.skippedFunctions = Number(event.skippedTargets || 0);
            metrics.generationSummary.totalTestCases = Number(event.generatedTestCases || 0);
            break;
          case "tester_start":
            metrics.testerProgress.started = true;
            renderRefinementProgress();
            break;
          case "tester_screenshot":
            metrics.testerProgress.screenshots = Number(event.count || metrics.testerProgress.screenshots + 1);
            renderRefinementProgress();
            break;
          case "tester_case_result":
            metrics.testerProgress.verified = Math.max(
              metrics.testerProgress.verified,
              Number(event.index || 0) + 1
            );
            renderRefinementProgress();
            break;
          case "tester_complete":
            metrics.testerProgress.complete = true;
            renderRefinementProgress();
            break;
          case "refinement_case": {
            const status = event.status === "refined" ? "refined" : "failed";
            metrics.refinementCases.push({
              index: Number(event.index || 0),
              description: event.description || "",
              status,
            });
            if (status === "refined") metrics.refinementSummary.refined++;
            else metrics.refinementSummary.failed++;
            if (CONFIG.verboseTestSummary) {
              ensureProgressLineBreak();
              const left = `      ${formatTestCaseLabel(event.description)}`;
              const right = status === "refined"
                ? renderStatusTag("Refined", "ok")
                : renderStatusTag("Failed", "error");
              console.log(alignWithRightStatus(left, right));
            }
            break;
          }
          case "refinement_complete":
            metrics.refinementSummary.refined = Number(event.refined || 0);
            metrics.refinementSummary.failed = Number(event.failed || 0);
            metrics.refinementSummary.total = Number(event.total || 0);
            renderRefinementProgress();
            break;
          default:
            break;
        }
        return;
      }

      if (/SCREEN TEXT ANALYSIS/.test(clean)) {
        metrics.testerProgress.verified++;
        renderRefinementProgress();
      }
    };

    const result = await spawnAndCapture("node", [GENERATE_TESTS_SCRIPT, ...args], {
      cwd: ROOT_DIR,
      env: process.env,
      onStdoutLine: onLine,
      onStderrLine: onLine,
    });
    const combinedOutput = `${result.stdout || ""}\n${result.stderr || ""}`;
    ensureProgressLineBreak();

    // Check if the test file was actually written, regardless of exit code.
    // generate-tests.js may exit non-zero because the *tester* step failed
    // (e.g. blind signing), but the test file itself is still valid and
    // should be included in the PR.
    const testFilePath = getTestFilePath(filePath);
    const testFileWritten = !CONFIG.dryRun && fs.existsSync(testFilePath);
    const plannedTests = testFileWritten ? getTestCountFromFile(testFilePath) : null;
    let executedTests = metrics.testerProgress.verified || extractExecutedTestCount(combinedOutput);
    if (!metrics.testerProgress.verified && executedTests === null && plannedTests !== null && result.status === 0) {
      executedTests = plannedTests;
    }

    if (result.status !== 0) {
      // "No tests generated" → not a real failure, just skip
      if (result.stdout?.includes("No tests generated") || result.stderr?.includes("No tests generated")) {
        log(`  → No tests could be generated for ${path.basename(filePath)}`, "warning");
        report.testGeneration.skipped++;
        return { ok: true, plannedTests, executedTests, metrics };
      }

      if (testFileWritten) {
        // Test file exists — generation succeeded, only the tester failed.
        // Still include the file in the PR.
        log(`  → Test file written but tester step failed for ${path.basename(filePath)}`, "warning");
        printCommandErrorOutput(
          "generate-tests.js reported errors",
          result.stdout,
          result.stderr
        );
        report.testGeneration.successful++;
        report.addNewFile(testFilePath);
        return { ok: true, plannedTests, executedTests, metrics };
      }

      printCommandErrorOutput(
        "generate-tests.js error output",
        result.stdout,
        result.stderr
      );
      report.testGeneration.failed.push({
        file: path.relative(ROOT_DIR, filePath),
        error: result.stderr || "Test generation failed",
      });
      return { ok: false, plannedTests, executedTests, metrics };
    }

    if (testFileWritten) {
      report.testGeneration.successful++;
      report.addNewFile(testFilePath);
    } else if (CONFIG.dryRun) {
      report.testGeneration.successful++;
    }
    return { ok: true, plannedTests, executedTests, metrics };
  } catch (error) {
    report.testGeneration.failed.push({
      file: path.relative(ROOT_DIR, filePath),
      error: error.message,
    });
    return { ok: false, plannedTests: null, executedTests: null, metrics: initGeneratePhaseMetrics() };
  }
}

/**
 * Run clear-signing tests for an existing descriptor test file.
 */
async function runTests(filePath) {
  const testFilePath = getTestFilePath(filePath);
  const relPath = path.relative(ROOT_DIR, filePath);
  const plannedTests = getTestCountFromFile(testFilePath);
  const finalMetrics = {
    ran: 0,
    clear: 0,
    partial: 0,
    blind: 0,
    failed: 0,
    cases: [],
    screenshots: 0,
  };

  if (!fs.existsSync(testFilePath)) {
    log(`  → Skipping test run (no test file): ${path.relative(ROOT_DIR, testFilePath)}`, "warning");
    return { ok: false, plannedTests: null, executedTests: null, metrics: finalMetrics };
  }

  if (!fs.existsSync(TESTER_SCRIPT)) {
    log("  → Tester script not found at tools/tester/run-test.sh, skipping test run", "warning");
    return { ok: false, plannedTests, executedTests: null, metrics: finalMetrics };
  }

  const device = CONFIG.testDevice || "flex";
  const logLevel = CONFIG.testLogLevel || "info";

  log(`Running tests: ${relPath}`, "debug");

  try {
    const testDescriptions = (() => {
      try {
        const content = fs.readFileSync(testFilePath, "utf8");
        const json = JSON.parse(content);
        if (!Array.isArray(json.tests)) return [];
        return json.tests.map((t) => t?.description || "");
      } catch {
        return [];
      }
    })();
    let lastProgressLine = "";
    const renderFinalProgress = () => {
      if (!CONFIG.verboseTestSummary) return;
      const goal = plannedTests || 0;
      const done = finalMetrics.ran;
      const bar = goal > 0 ? `${formatProgressBar(Math.min(done, goal), goal, 16)} ${done}/${goal}` : `${done}/?`;
      const text = `      final run progress: ${bar} | screenshots ${finalMetrics.screenshots}`;
      if (text !== lastProgressLine) {
        renderInlineProgressLine(text, goal > 0 ? Math.min(done, goal) : done, goal || null);
        lastProgressLine = text;
      }
    };

    const onLine = (line) => {
      const clean = stripAnsi(line);
      if (/Saved screenshot:/.test(clean)) {
        finalMetrics.screenshots++;
        renderFinalProgress();
      }
      const resultStatus = parseFinalTestResultStatus(clean);
      if (resultStatus) {
        finalMetrics.ran++;
        if (resultStatus === "clear") finalMetrics.clear++;
        else if (resultStatus === "partial") finalMetrics.partial++;
        else if (resultStatus === "blind") finalMetrics.blind++;
        else finalMetrics.failed++;
        const index = finalMetrics.ran - 1;
        const description = testDescriptions[index] || `Test ${index + 1}`;
        finalMetrics.cases.push({ index, description, status: resultStatus });
        if (CONFIG.verboseTestSummary) {
          ensureProgressLineBreak();
          const left = `      ${formatTestCaseLabel(description)}`;
          const right =
            resultStatus === "clear"
              ? renderStatusTag("Clear", "ok")
              : resultStatus === "partial"
                ? renderStatusTag("Partial", "warn")
                : resultStatus === "blind"
                  ? renderStatusTag("Blind", "warn")
                  : renderStatusTag("Failed", "error");
          console.log(alignWithRightStatus(left, right));
        }
        renderFinalProgress();
      }
    };

    const result = await spawnAndCapture(
      "bash",
      [TESTER_SCRIPT, filePath, testFilePath, device, logLevel],
      {
        cwd: ROOT_DIR,
        env: { ...process.env },
        onStdoutLine: onLine,
        onStderrLine: onLine,
      }
    );
    const combinedOutput = `${result.stdout || ""}\n${result.stderr || ""}`;
    ensureProgressLineBreak();
    let executedTests = finalMetrics.ran || extractExecutedTestCount(combinedOutput);

    if (result.status !== 0) {
      log(`  → Test run failed for ${path.basename(filePath)}`, "warning");
      printCommandErrorOutput(
        "run-test.sh error output",
        result.stdout,
        result.stderr
      );
      return { ok: false, plannedTests, executedTests, metrics: finalMetrics };
    }

    if (executedTests === null && plannedTests !== null) {
      // If parsing fails but run succeeded, assume all planned tests were executed.
      executedTests = plannedTests;
    }
    log(`  → Test run passed for ${path.basename(filePath)}`, "success");
    return { ok: true, plannedTests, executedTests, metrics: finalMetrics };
  } catch (error) {
    log(`  → Test run failed for ${path.basename(filePath)}: ${error.message}`, "warning");
    return { ok: false, plannedTests, executedTests: null, metrics: finalMetrics };
  }
}

// =============================================================================
// Git Operations
// =============================================================================

/**
 * Detect the git remote name (prefer "upstream", fall back to "origin").
 */
function getRemoteName() {
  try {
    const remotes = execSync("git remote", { encoding: "utf8", cwd: ROOT_DIR, stdio: "pipe" }).trim().split("\n");
    if (remotes.includes("upstream")) return "upstream";
    if (remotes.includes("origin")) return "origin";
    return remotes[0] || "origin";
  } catch {
    return "origin";
  }
}

/**
 * Check if git is available and we're in a git repo
 */
function checkGit() {
  try {
    execSync("git rev-parse --git-dir", { encoding: "utf8", stdio: "pipe", cwd: ROOT_DIR });
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Check if gh CLI is available
 */
function checkGhCli() {
  try {
    execSync("gh --version", { encoding: "utf8", stdio: "pipe" });
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Get current git branch
 */
function getCurrentBranch() {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf8", cwd: ROOT_DIR }).trim();
  } catch (e) {
    return null;
  }
}

/**
 * Create a PR containing only the files modified by batch-process.
 *
 * This function is called **after** file processing is complete. It:
 *   1. Captures the content of all modified/new files
 *   2. Stashes the working tree so we can switch branches cleanly
 *   3. Creates a new branch from <remote>/master
 *   4. Writes only the captured files onto that branch
 *   5. Commits, pushes, and opens a PR targeting master
 *
 * @param {string} targetFolder - Target folder path
 * @param {Report} report - Processing report
 * @returns {{ originalBranch: string, stashed: boolean } | null} cleanup context, or null if nothing was done
 */
function createPrFromChanges(targetFolder, report) {
  const folderName = path.basename(targetFolder);
  const remote = getRemoteName();
  const branchName = CONFIG.prBranch || `migrate-v1-to-v2/${folderName}`;
  const allChanges = [...report.modifiedFiles, ...report.newFiles];

  if (allChanges.length === 0) {
    log("No changes to commit", "info");
    return null;
  }

  // 1. Capture file contents before switching branches
  const fileContents = new Map();
  for (const filePath of allChanges) {
    if (fs.existsSync(filePath)) {
      fileContents.set(filePath, fs.readFileSync(filePath));
    }
  }

  const originalBranch = getCurrentBranch();
  let stashed = false;

  // 2. Stash working tree (includes batch-process changes + any prior dirty state)
  const statusOutput = execSync("git status --porcelain", {
    cwd: ROOT_DIR,
    encoding: "utf8",
  }).trim();

  if (statusOutput) {
    log("Stashing working tree changes...", "info");
    execSync('git stash push --include-untracked -m "batch-process-temp"', {
      cwd: ROOT_DIR,
      stdio: "pipe",
    });
    stashed = true;
  }

  // 3. Fetch latest master from remote
  log(`Fetching ${remote}/master...`, "info");
  execSync(`git fetch "${remote}" master`, { cwd: ROOT_DIR, stdio: "pipe" });

  // Delete branch if it already exists (stale leftover from a previous run)
  try {
    execSync(`git rev-parse --verify "${branchName}"`, { cwd: ROOT_DIR, stdio: "pipe" });
    log(`Branch ${branchName} already exists, recreating...`, "info");
    execSync(`git branch -D "${branchName}"`, { cwd: ROOT_DIR, stdio: "pipe" });
  } catch {
    // Branch doesn't exist — good
  }

  // 4. Create a clean branch from remote/master
  log(`Creating branch ${branchName} from ${remote}/master...`, "info");
  execSync(`git checkout -b "${branchName}" "${remote}/master"`, { cwd: ROOT_DIR, stdio: "pipe" });

  // 5. Write captured files onto the clean branch
  for (const [filePath, content] of fileContents) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
  }

  // 6. Stage and commit
  const relChanges = allChanges.map((f) => path.relative(ROOT_DIR, f));
  for (const rel of relChanges) {
    execSync(`git add "${rel}"`, { cwd: ROOT_DIR, stdio: "pipe" });
  }

  const commitMessage =
    `chore(${folderName}): batch migration and test generation\n\n` +
    `- Migrated ${report.migrations.successful} files from v1 to v2 schema\n` +
    `- Generated ${report.testGeneration.successful} test files`;

  execSync(`git commit -m "${commitMessage}"`, { cwd: ROOT_DIR, stdio: "pipe" });
  log("Changes committed", "success");

  // 7. Build PR body
  const prBody = buildPrBody(folderName, report);
  const prTitle =
    CONFIG.prTitle || `[V2 migration] ${folderName} - schema migration and test generation`;
  const prBodyFile = path.join(ROOT_DIR, `.migrate-pr-body-${folderName}.md`);
  fs.writeFileSync(prBodyFile, prBody);
  log(`PR summary saved to: ${path.relative(ROOT_DIR, prBodyFile)}`, "info");

  if (!checkGhCli()) {
    log("GitHub CLI (gh) not installed. Install with: brew install gh", "warning");
    log("PR will not be created.", "warning");
    return { originalBranch, stashed };
  }

  // 8. Push and create PR (always targeting master)
  log("Pushing branch to remote...", "info");
  execSync(`git push -u "${remote}" "${branchName}"`, { cwd: ROOT_DIR, stdio: "pipe" });

  log("Creating PR targeting master...", "info");
  const draftFlag = CONFIG.prDraft ? " --draft" : "";
  const prResult = execSync(
    `gh pr create --title "${prTitle}" --body-file "${prBodyFile}" --base master${draftFlag}`,
    { cwd: ROOT_DIR, encoding: "utf8" }
  );

  report.prCreated = true;
  report.prUrl = prResult.trim();
  log(`PR created: ${report.prUrl}`, "success");

  return { originalBranch, stashed };
}

/**
 * Restore the working tree after PR creation: switch back to the original
 * branch and pop the stash.
 *
 * @param {{ originalBranch: string, stashed: boolean }} context
 */
function cleanupAfterPr(context) {
  const { originalBranch, stashed } = context;

  try {
    if (originalBranch && getCurrentBranch() !== originalBranch) {
      execSync(`git checkout "${originalBranch}"`, { cwd: ROOT_DIR, stdio: "pipe" });
    }
  } catch (e) {
    log(`Warning: could not switch back to ${originalBranch}: ${e.message}`, "warning");
  }

  if (stashed) {
    try {
      execSync("git stash pop", { cwd: ROOT_DIR, stdio: "pipe" });
    } catch (e) {
      log("Warning: could not pop stash. Run 'git stash pop' manually.", "warning");
    }
  }
}

/**
 * Build PR body content
 */
function buildPrBody(folderName, report) {
  return `## Summary

This PR contains automated batch updates for the \`${folderName}\` registry folder.

### Changes Made

- **Schema Migrations**: Migrated ${report.migrations.successful} files from ERC-7730 v1 to v2 schema
- **Test Generation**: Generated ${report.testGeneration.successful} new test files

### Modified Files

${report.modifiedFiles.map((f) => `- \`${path.relative(ROOT_DIR, f)}\``).join("\n") || "None"}

### New Files

${report.newFiles.map((f) => `- \`${path.relative(ROOT_DIR, f)}\``).join("\n") || "None"}

### Validation Status

| Check | Status |
|-------|--------|
| Schema Migration | ${report.migrations.failed.length === 0 ? "✅ Passed" : "⚠️ Some failures"} |
| Test Generation | ${report.testGeneration.failed.length === 0 ? "✅ Passed" : "⚠️ Some failures"} |

### Notes

<!-- Add any additional notes or context here -->
- This PR was auto-generated by \`tools/scripts/batch-process.js\`
- Please review the changes before merging

### Test Plan

- [ ] Review migrated schema files
- [ ] Review generated test files
- [ ] Run CI checks
- [ ] Manual spot-check on sample files`;
}

// =============================================================================
// Local ERC7730 API Server Management
// =============================================================================

/** @type {import("child_process").ChildProcess | null} */
let _localApiProcess = null;

/**
 * Start the local Flask API server in the background.
 * Resolves once the server is accepting HTTP requests.
 *
 * @param {number} port
 * @returns {Promise<import("child_process").ChildProcess>}
 */
function startLocalApiServer(port) {
  return new Promise((resolve, reject) => {
    const runScript = path.join(ROOT_DIR, "tools", "tester", "run-local-api.sh");
    if (!fs.existsSync(runScript)) {
      reject(new Error(
        `Local API script not found: ${runScript}\n` +
        "  Set up with: cd tools/tester && ./setup.sh"
      ));
      return;
    }

    log(`Starting local ERC7730 API server on port ${port}...`, "info");

    // detached: true creates a new process group so we can kill bash + Flask together
    const child = spawn("bash", [runScript, String(port)], {
      cwd: ROOT_DIR,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
      detached: true,
    });
    _localApiProcess = child;

    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      appendLogLine("STDERR", chunk.toString());
      if (CONFIG.verbose) process.stderr.write(chunk);
    });
    child.stdout.on("data", (chunk) => {
      appendLogLine("STDOUT", chunk.toString());
      if (CONFIG.verbose) process.stdout.write(chunk);
    });
    child.on("error", (err) => reject(new Error(`Failed to start local API: ${err.message}`)));
    child.on("exit", (code) => {
      if (code !== null && code !== 0) {
        reject(new Error(`Local API exited with code ${code}\n${stderr.slice(-500)}`));
      }
    });

    // Poll until ready
    const startTime = Date.now();
    const timeout = 30000;
    const poll = setInterval(() => {
      if (Date.now() - startTime > timeout) {
        clearInterval(poll);
        stopLocalApiServer();
        reject(new Error(`Local API server did not start within ${timeout / 1000}s\n${stderr.slice(-500)}`));
        return;
      }
      const req = http.get(`http://127.0.0.1:${port}/`, (res) => {
        clearInterval(poll);
        log(`Local API server ready on http://127.0.0.1:${port}`, "success");
        resolve(child);
      });
      req.on("error", () => { /* not ready yet */ });
      req.end();
    }, 500);
  });
}

/**
 * Stop the local API server if we started it.
 * Kills the entire process group (bash + Flask) so nothing lingers.
 */
function stopLocalApiServer() {
  if (_localApiProcess && !_localApiProcess.killed) {
    log("Stopping local API server...", "info");
    try {
      // Kill the entire process group (negative PID) so Flask dies too
      process.kill(-_localApiProcess.pid, "SIGTERM");
    } catch (e) {
      // Process group may already be gone
      try { _localApiProcess.kill("SIGTERM"); } catch {}
    }
    _localApiProcess = null;
  }
}

process.on("exit", stopLocalApiServer);
process.on("SIGINT", () => { stopLocalApiServer(); process.exit(130); });
process.on("SIGTERM", () => { stopLocalApiServer(); process.exit(143); });

// =============================================================================
// Main Process
// =============================================================================

function renderGenerationSummary(relPath, generation) {
  if (!generation?.metrics) return;
  const gen = generation.metrics.generationSummary || {
    skippedFunctions: 0,
    generatedFunctions: 0,
    totalTestCases: 0,
  };
  const ref = generation.metrics.refinementSummary || { refined: 0, failed: 0, total: 0 };

  ensureProgressLineBreak();
  console.log(`   Generation summary (${relPath})`);
  console.log(
    `      functions: skipped ${colorStatus(String(gen.skippedFunctions), "warn")} | generated ${colorStatus(String(gen.generatedFunctions), "ok")} | test cases ${colorStatus(String(gen.totalTestCases), "ok")}`
  );
  console.log(
    `      refinement: refined ${colorStatus(String(ref.refined), "ok")} | failed ${ref.failed > 0 ? colorStatus(String(ref.failed), "error") : colorStatus("0", "ok")}`
  );
}

function renderFinalRunSummary(relPath, testRun) {
  if (!testRun?.metrics) return;
  const m = testRun.metrics;
  ensureProgressLineBreak();
  console.log(`   Final test summary (${relPath})`);
  console.log(
    `      ran ${colorStatus(String(m.ran), "ok")} | clear ${colorStatus(String(m.clear), "ok")} | partial ${m.partial > 0 ? colorStatus(String(m.partial), "warn") : "0"} | blind ${m.blind > 0 ? colorStatus(String(m.blind), "warn") : "0"} | failed ${m.failed > 0 ? colorStatus(String(m.failed), "error") : "0"}`
  );
}

/**
 * Process a single file
 */
async function processFile(filePath, report, options = {}) {
  const {
    runTestGeneration = true,
    runFinalTests = true,
    isLeaf = true,
    progress = null,
  } = options;
  report.filesProcessed++;
  const relPath = path.relative(ROOT_DIR, filePath);

  log(`\nProcessing: ${relPath}`, "info");

  // Always call generate-tests unless explicitly skipped via args.
  // generate-tests.js handles coverage checks and decides whether generation is needed.
  if (!CONFIG.skipTests && runTestGeneration) {
    log("  → Running test generation/refinement...", "info");
    const generation = await generateTests(filePath, report);
    renderGenerationSummary(relPath, generation);
    if (progress?.testGeneration) {
      progress.testGeneration.done++;
    }
  } else {
    if (!CONFIG.skipTests && !runTestGeneration) {
      log("  → Skipping test generation (only enabled for leaf descriptors)", "debug");
    }
    report.testGeneration.skipped++;
  }

  // Check if v1 and migrate
  if (!CONFIG.skipMigration && isV1Schema(filePath)) {
    log("  → v1 schema detected, migrating to v2...", "info");
    const skipLintForThisFile = CONFIG.skipLint || !isLeaf;
    if (skipLintForThisFile && !CONFIG.skipLint && !isLeaf) {
      log("  → Skipping lint for non-leaf descriptor during migration", "debug");
    }
    migrateFile(filePath, report, { skipLint: skipLintForThisFile });
    // Note: Linting/validation is now handled inside migrate-v1-to-v2.js
  } else {
    if (CONFIG.skipMigration) {
      report.migrations.skipped++;
    } else {
      log("  → Already v2 schema, skipping migration", "debug");
      report.migrations.skipped++;
    }
  }

  // Run tests after migration step (without generating tests again)
  if (!CONFIG.skipTests && !CONFIG.noTest && !CONFIG.dryRun && runFinalTests) {
    log("  → Running tests after migration...", "info");
    const testRun = await runTests(filePath);
    renderFinalRunSummary(relPath, testRun);
    if (progress?.finalTests) {
      progress.finalTests.done++;
    }
  } else if (!CONFIG.skipTests && !CONFIG.noTest && !CONFIG.dryRun && !runFinalTests) {
    log("  → Skipping final test run (only enabled for leaf descriptors)", "debug");
  }
}

/**
 * Main entry point
 */
async function main() {
  console.log("ERC-7730 Batch Processor");
  console.log("========================");
  if (CONFIG.dryRun) {
    console.log("🔍 DRY RUN MODE - No files will be modified\n");
  }

  // Get target folder — skip positional args consumed as values by known flags
  const flagsWithValues = new Set([
    "--log", "--pr-title", "--pr-branch", "--local-api-port",
    "--depth", "--max-tests", "--chain", "--backend", "--model",
    "--api-key", "--api-url", "--device", "--test-log-level",
  ]);
  const consumedIndices = new Set();
  for (let i = 2; i < process.argv.length; i++) {
    if (flagsWithValues.has(process.argv[i]) && i + 1 < process.argv.length) {
      consumedIndices.add(i + 1);
    }
  }
  const targetArg = process.argv.find(
    (arg, idx) =>
      idx >= 2 &&
      !consumedIndices.has(idx) &&
      !arg.startsWith("-") &&
      !arg.includes("batch-process") &&
      !arg.includes("node")
  );

  if (!targetArg) {
    printHelp(1, "Error: A registry subfolder argument is required.");
  }

  // Resolve target folder
  let targetFolder = targetArg;
  if (!path.isAbsolute(targetFolder)) {
    // Check if it's a direct subfolder name or a path
    if (targetFolder.startsWith("registry/")) {
      targetFolder = path.join(ROOT_DIR, targetFolder);
    } else {
      targetFolder = path.join(REGISTRY_DIR, targetFolder);
    }
  }

  if (!fs.existsSync(targetFolder)) {
    console.error(`Target folder not found: ${targetFolder}`);
    process.exit(1);
  }

  if (!fs.statSync(targetFolder).isDirectory()) {
    console.error(`Target is not a directory: ${targetFolder}`);
    process.exit(1);
  }

  console.log(`Target: ${path.relative(ROOT_DIR, targetFolder)}`);

  // Initialize report
  const report = new Report();

  // Build repository-wide dependency graph from all local descriptors
  const repoDescriptorFiles = findErc7730Files(ROOT_DIR);
  const dependencyGraph = buildDependencyGraph(repoDescriptorFiles);

  // Target files to process (inside selected folder)
  const targetFiles = findErc7730Files(targetFolder);

  // Optionally include transitive dependencies outside target folder
  const filesSet = CONFIG.includeExternalDeps
    ? collectTransitiveDependencies(targetFiles, dependencyGraph)
    : new Set(targetFiles);
  const files = orderFilesByDependencies([...filesSet], dependencyGraph);

  const leafFiles = new Set(
    files.filter((file) => {
      const node = dependencyGraph.get(file);
      return !node || node.dependents.size === 0;
    })
  );
  const progress = {
    testGeneration: {
      done: 0,
      total: CONFIG.skipTests ? 0 : leafFiles.size,
    },
    finalTests: {
      done: 0,
      total: CONFIG.skipTests || CONFIG.noTest || CONFIG.dryRun ? 0 : leafFiles.size,
    },
  };

  console.log(`Found ${targetFiles.length} target ERC-7730 files`);
  if (CONFIG.includeExternalDeps) {
    const outsideTargetCount = files.filter((f) => !f.startsWith(`${targetFolder}${path.sep}`)).length;
    console.log(
      `Including ${files.length - targetFiles.length} transitive dependency file(s), ` +
      `${outsideTargetCount} outside target folder`
    );
  }
  console.log(`Processing ${files.length} file(s) in dependency order`);
  console.log(`Test generation + final tests will run only on ${leafFiles.size} leaf file(s)\n`);

  if (files.length === 0) {
    console.log("No files to process.");
    process.exit(0);
  }

  let prCleanupContext = null;

  try {
    // Start local API server once (shared by all generate-tests invocations)
    if (CONFIG.localApi && !CONFIG.skipTests) {
      try {
        await startLocalApiServer(CONFIG.localApiPort);
        process.env.ERC7730_API_URL = `http://127.0.0.1:${CONFIG.localApiPort}`;
        log(`ERC7730_API_URL set to ${process.env.ERC7730_API_URL}`, "info");
      } catch (err) {
        log(`Could not start local API server: ${err.message}`, "error");
        process.exit(1);
      }
    }

    // Process each file on the current branch
    logSection("Processing Files");
    for (const file of files) {
      const isLeaf = leafFiles.has(file);
      await processFile(file, report, {
        runTestGeneration: isLeaf,
        runFinalTests: isLeaf,
        isLeaf,
        progress,
      });
    }

    // Create PR with only the files modified by batch-process
    const hasChanges = report.modifiedFiles.length > 0 || report.newFiles.length > 0;
    const hasFailures =
      report.migrations.failed.length > 0 ||
      report.testGeneration.failed.length > 0;

    if (CONFIG.pr && !CONFIG.dryRun && checkGit() && hasChanges) {
      if (CONFIG.prStrict && hasFailures) {
        log("Skipping PR creation: --pr-strict is set and there were failures", "error");
      } else {
        logSection("Creating PR");
        prCleanupContext = createPrFromChanges(targetFolder, report);
      }
    }

    // Print summary
    report.print();

    if (hasFailures) {
      process.exit(1);
    }
  } finally {
    stopLocalApiServer();
    if (prCleanupContext) {
      cleanupAfterPr(prCleanupContext);
    }
  }
}

main().catch((error) => {
  console.error(`\n❌ Fatal error: ${error.message}`);
  if (CONFIG.verbose) {
    console.error(error.stack);
  } else if (CONFIG.logVerbose) {
    appendLogLine("ERROR", error.stack);
  }
  process.exit(1);
});
