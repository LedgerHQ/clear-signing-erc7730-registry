#!/usr/bin/env node
/**
 * ERC-7730 Batch Processor
 *
 * Processes a registry subfolder to:
 * - Migrate v1 schema files to v2 (linting/validation is handled by migrate-v1-to-v2.js)
 * - Generate missing test files
 * - Optionally create a PR with all changes
 *
 * Usage:
 *   node tools/migrate/batch-process.js <registry-subfolder> [options]
 *
 * Options:
 *   --dry-run               Preview changes without modifying files
 *   --verbose               Show detailed output
 *   --skip-tests            Skip test generation
 *   --skip-migration        Skip v1 to v2 migration
 *   --skip-pr               Skip PR creation
 *   --pr-title <title>      Custom PR title
 *   --pr-branch <name>      Custom branch name
 *   --local-api             Auto-start local Flask API server for the tester
 *   --local-api-port <port> Port for the local API server (default: 5000)
 *
 * Test generation options (cascaded to generate-tests.js):
 *   --depth <n>             Max transactions to search (default: 100)
 *   --max-tests <n>         Max tests to generate per function (default: 3)
 *   --chain <id>            Only process specific chain ID
 *   --openai-url <url>      Custom OpenAI API URL (e.g., Azure OpenAI endpoint)
 *   --openai-key <key>      OpenAI API key (overrides OPENAI_API_KEY env var)
 *   --openai-model <model>  Model to use (default: gpt-4)
 *   --azure                 Use Azure OpenAI API format (api-key header)
 *   --no-test               Skip running the clear signing tester after generation
 *   --force-test            Run tester even when test file already exists
 *   --device <device>       Tester device: flex, stax, nanosp, nanox (default: flex)
 *   --test-log-level <lvl>  Tester log level: none, error, warn, info, debug (default: info)
 *   --no-refine             Skip refining expectedTexts from tester screen output
 *
 * Environment Variables:
 *   GITHUB_TOKEN        GitHub token for PR creation (required for --create-pr)
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

const CONFIG = {
  dryRun: process.argv.includes("--dry-run"),
  verbose: process.argv.includes("--verbose"),
  skipTests: process.argv.includes("--skip-tests"),
  skipMigration: process.argv.includes("--skip-migration"),
  skipPr: process.argv.includes("--skip-pr"),
  prTitle: getArgValue("--pr-title", null),
  prBranch: getArgValue("--pr-branch", null),
  localApi: process.argv.includes("--local-api"),
  localApiPort: getArgValue("--local-api-port", 5000),
  // Parameters cascaded to generate-tests.js
  depth: getArgValue("--depth", null),
  maxTests: getArgValue("--max-tests", null),
  chainFilter: getArgValue("--chain", null),
  openaiUrl: getArgValue("--openai-url", null),
  openaiKey: getArgValue("--openai-key", null),
  openaiModel: getArgValue("--openai-model", null),
  useAzure: process.argv.includes("--azure"),
  noTest: process.argv.includes("--no-test"),
  forceTest: process.argv.includes("--force-test"),
  testDevice: getArgValue("--device", null),
  testLogLevel: getArgValue("--test-log-level", null),
  noRefine: process.argv.includes("--no-refine"),
};

function getArgValue(flag, defaultValue) {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && process.argv[idx + 1] && !process.argv[idx + 1].startsWith("--")) {
    return process.argv[idx + 1];
  }
  return defaultValue;
}

// Paths
const ROOT_DIR = path.join(__dirname, "..", "..");
const REGISTRY_DIR = path.join(ROOT_DIR, "registry");
const MIGRATE_SCRIPT = path.join(__dirname, "migrate-v1-to-v2.js");
const GENERATE_TESTS_SCRIPT = path.join(__dirname, "generate-tests.js");

// =============================================================================
// Logging
// =============================================================================

function log(message, level = "info") {
  const prefix = {
    info: "ℹ️ ",
    success: "✅ ",
    warning: "⚠️ ",
    error: "❌ ",
    debug: "🔍 ",
  };
  if (level === "debug" && !CONFIG.verbose) return;
  console.log(`${prefix[level] || ""}${message}`);
}

function logSection(title) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`📦 ${title}`);
  console.log(`${"=".repeat(60)}\n`);
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
    console.log("   (Linting/validation is now handled by migrate-v1-to-v2.js)");

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

  function walk(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        // Skip tests directories for main file discovery
        if (entry.name !== "tests") {
          walk(fullPath);
        }
      } else if (entry.isFile() && entry.name.endsWith(".json")) {
        // Skip test files and common/shared files
        if (!entry.name.includes(".tests.") && !entry.name.startsWith("common-")) {
          files.push(fullPath);
        }
      }
    }
  }

  walk(dir);
  return files;
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
 * Check if test file exists for a descriptor
 */
function hasTestFile(descriptorPath) {
  const dir = path.dirname(descriptorPath);
  const baseName = path.basename(descriptorPath, ".json");
  const testFilePath = path.join(dir, "tests", `${baseName}.tests.json`);
  return fs.existsSync(testFilePath);
}

/**
 * Get test file path for a descriptor
 */
function getTestFilePath(descriptorPath) {
  const dir = path.dirname(descriptorPath);
  const baseName = path.basename(descriptorPath, ".json");
  return path.join(dir, "tests", `${baseName}.tests.json`);
}

// =============================================================================
// Migration
// =============================================================================

/**
 * Migrate a file from v1 to v2
 */
function migrateFile(filePath, report) {
  report.migrations.attempted++;

  const args = ["--file", filePath];
  if (CONFIG.dryRun) args.push("--dry-run");
  if (CONFIG.verbose) args.push("--verbose");

  log(`Migrating: ${path.relative(ROOT_DIR, filePath)}`, "debug");

  try {
    const result = spawnSync("node", [MIGRATE_SCRIPT, ...args], {
      cwd: ROOT_DIR,
      encoding: "utf8",
      stdio: CONFIG.verbose ? "inherit" : "pipe",
    });

    if (result.status !== 0) {
      report.migrations.failed.push({
        file: path.relative(ROOT_DIR, filePath),
        error: result.stderr || "Migration script failed",
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
function generateTests(filePath, report) {
  report.testGeneration.attempted++;

  const args = [filePath];
  if (CONFIG.dryRun) args.push("--dry-run");
  if (CONFIG.verbose) args.push("--verbose");
  if (CONFIG.depth) args.push("--depth", String(CONFIG.depth));
  if (CONFIG.maxTests) args.push("--max-tests", String(CONFIG.maxTests));
  if (CONFIG.chainFilter) args.push("--chain", String(CONFIG.chainFilter));
  if (CONFIG.openaiUrl) args.push("--openai-url", CONFIG.openaiUrl);
  if (CONFIG.openaiKey) args.push("--openai-key", CONFIG.openaiKey);
  if (CONFIG.openaiModel) args.push("--openai-model", CONFIG.openaiModel);
  if (CONFIG.useAzure) args.push("--azure");
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
    const result = spawnSync("node", [GENERATE_TESTS_SCRIPT, ...args], {
      cwd: ROOT_DIR,
      encoding: "utf8",
      stdio: CONFIG.verbose ? "inherit" : "pipe",
    });

    // Check if the test file was actually written, regardless of exit code.
    // generate-tests.js may exit non-zero because the *tester* step failed
    // (e.g. blind signing), but the test file itself is still valid and
    // should be included in the PR.
    const testFilePath = getTestFilePath(filePath);
    const testFileWritten = !CONFIG.dryRun && fs.existsSync(testFilePath);

    if (result.status !== 0) {
      // "No tests generated" → not a real failure, just skip
      if (result.stdout?.includes("No tests generated") || result.stderr?.includes("No tests generated")) {
        log(`  → No tests could be generated for ${path.basename(filePath)}`, "warning");
        report.testGeneration.skipped++;
        return true;
      }

      if (testFileWritten) {
        // Test file exists — generation succeeded, only the tester failed.
        // Still include the file in the PR.
        log(`  → Test file written but tester step failed for ${path.basename(filePath)}`, "warning");
        report.testGeneration.successful++;
        report.addNewFile(testFilePath);
        return true;
      }

      report.testGeneration.failed.push({
        file: path.relative(ROOT_DIR, filePath),
        error: result.stderr || "Test generation failed",
      });
      return false;
    }

    if (testFileWritten) {
      report.testGeneration.successful++;
      report.addNewFile(testFilePath);
    } else if (CONFIG.dryRun) {
      report.testGeneration.successful++;
    }
    return true;
  } catch (error) {
    report.testGeneration.failed.push({
      file: path.relative(ROOT_DIR, filePath),
      error: error.message,
    });
    return false;
  }
}

// =============================================================================
// Git Operations
// =============================================================================

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
 * Set up a clean working branch for the batch process.
 *
 * Stashes any existing dirty/untracked changes so the working tree is
 * clean, then creates a new branch from the current HEAD.  File
 * processing happens directly on this branch, so changes are isolated
 * from the user's working tree.
 *
 * @param {string} folderName - Registry subfolder name (e.g. "ethena")
 * @returns {{ branchName: string, originalBranch: string, stashed: boolean }}
 */
function setupBranch(folderName) {
  const branchName = CONFIG.prBranch || `migrate-v1-to-v2/${folderName}`;
  const originalBranch = getCurrentBranch();
  let stashed = false;

  // Stash any dirty / untracked files so we start clean
  const statusOutput = execSync("git status --porcelain", {
    cwd: ROOT_DIR,
    encoding: "utf8",
  }).trim();

  if (statusOutput) {
    log("Stashing current changes...", "info");
    execSync('git stash push --include-untracked -m "batch-process-temp"', {
      cwd: ROOT_DIR,
      stdio: "pipe",
    });
    stashed = true;
  }

  // Delete branch if it already exists (stale leftover from a previous run)
  try {
    execSync(`git rev-parse --verify "${branchName}"`, { cwd: ROOT_DIR, stdio: "pipe" });
    log(`Branch ${branchName} already exists, recreating...`, "info");
    execSync(`git branch -D "${branchName}"`, { cwd: ROOT_DIR, stdio: "pipe" });
  } catch {
    // Branch doesn't exist — good
  }

  log(`Creating branch: ${branchName}`, "info");
  execSync(`git checkout -b "${branchName}"`, { cwd: ROOT_DIR, stdio: "pipe" });

  return { branchName, originalBranch, stashed };
}

/**
 * Commit all changes on the working branch and optionally push + create a PR.
 *
 * @param {{ branchName: string }} context - Branch context from setupBranch
 * @param {string} targetFolder - Target folder path
 * @param {Report} report - Processing report
 */
function commitAndCreatePr(context, targetFolder, report) {
  const folderName = path.basename(targetFolder);
  const { branchName } = context;
  const allChanges = [...report.modifiedFiles, ...report.newFiles];

  if (allChanges.length === 0) {
    log("No changes to commit", "info");
    return;
  }

  // Stage only the target folder files
  const relChanges = allChanges.map((f) => path.relative(ROOT_DIR, f));
  for (const rel of relChanges) {
    execSync(`git add "${rel}"`, { cwd: ROOT_DIR, stdio: "pipe" });
  }

  // Create commit
  const commitMessage =
    `chore(${folderName}): batch migration and test generation\n\n` +
    `- Migrated ${report.migrations.successful} files from v1 to v2 schema\n` +
    `- Generated ${report.testGeneration.successful} test files`;

  execSync(`git commit -m "${commitMessage}"`, { cwd: ROOT_DIR, stdio: "pipe" });
  log("Changes committed", "success");

  // Build PR body & save to file for reference
  const prBody = buildPrBody(folderName, report);
  const prTitle =
    CONFIG.prTitle || `[V2 migration] ${folderName} - schema migration and test generation`;
  const prBodyFile = path.join(ROOT_DIR, `.migrate-pr-body-${folderName}.md`);
  fs.writeFileSync(prBodyFile, prBody);
  log(`PR summary saved to: ${path.relative(ROOT_DIR, prBodyFile)}`, "info");

  if (!CONFIG.skipPr) {
    if (!checkGhCli()) {
      log("GitHub CLI (gh) not installed. Install with: brew install gh", "warning");
      log("PR will not be created.", "warning");
      return;
    }

    log("Pushing branch to remote...", "info");
    execSync(`git push -u origin "${branchName}"`, { cwd: ROOT_DIR, stdio: "pipe" });

    log("Creating PR...", "info");
    const prResult = execSync(
      `gh pr create --title "${prTitle}" --body-file "${prBodyFile}"`,
      { cwd: ROOT_DIR, encoding: "utf8" }
    );

    report.prCreated = true;
    report.prUrl = prResult.trim();
    log(`PR created: ${report.prUrl}`, "success");
  } else {
    console.log(`\n${"-".repeat(60)}`);
    console.log("To create the PR manually, run:");
    console.log(`${"-".repeat(60)}`);
    console.log(`git checkout "${branchName}" && \\`);
    console.log(`  git push -u origin "${branchName}" && \\`);
    console.log(`  gh pr create \\`);
    console.log(`    --title "${prTitle}" \\`);
    console.log(`    --body-file "${prBodyFile}"`);
    console.log(`${"-".repeat(60)}`);
  }
}

/**
 * Clean up after processing: switch back to the original branch, restore
 * stashed changes, and delete the working branch if nothing was committed.
 *
 * @param {{ branchName: string, originalBranch: string, stashed: boolean }} context
 * @param {boolean} hasChanges - Whether any changes were committed on the branch
 */
function cleanupBranch(context, hasChanges) {
  const { branchName, originalBranch, stashed } = context;

  // Switch back to the original branch
  try {
    if (originalBranch && getCurrentBranch() !== originalBranch) {
      execSync(`git checkout "${originalBranch}"`, { cwd: ROOT_DIR, stdio: "pipe" });
    }
  } catch (e) {
    log(`Warning: could not switch back to ${originalBranch}: ${e.message}`, "warning");
  }

  // Restore stashed changes
  if (stashed) {
    try {
      execSync("git stash pop", { cwd: ROOT_DIR, stdio: "pipe" });
    } catch (e) {
      log("Warning: could not pop stash. Run 'git stash pop' manually.", "warning");
    }
  }

  // Delete the branch if there were no changes (nothing committed)
  if (!hasChanges) {
    try {
      execSync(`git branch -D "${branchName}"`, { cwd: ROOT_DIR, stdio: "pipe" });
      log(`Deleted empty branch: ${branchName}`, "info");
    } catch (e) {
      log(`Warning: could not delete branch ${branchName}: ${e.message}`, "warning");
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
- This PR was auto-generated by \`tools/migrate/batch-process.js\`
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
      if (CONFIG.verbose) process.stderr.write(chunk);
    });
    child.stdout.on("data", (chunk) => {
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

/**
 * Process a single file
 */
async function processFile(filePath, report) {
  report.filesProcessed++;
  const relPath = path.relative(ROOT_DIR, filePath);

  log(`\nProcessing: ${relPath}`, "info");

  // Check if v1 and migrate
  if (!CONFIG.skipMigration && isV1Schema(filePath)) {
    log("  → v1 schema detected, migrating to v2...", "info");
    migrateFile(filePath, report);
    // Note: Linting/validation is now handled inside migrate-v1-to-v2.js
  } else {
    if (CONFIG.skipMigration) {
      report.migrations.skipped++;
    } else {
      log("  → Already v2 schema, skipping migration", "debug");
      report.migrations.skipped++;
    }
  }

  // Generate tests if missing, or run tester on existing tests when forced
  if (!CONFIG.skipTests && (!hasTestFile(filePath) || CONFIG.forceTest)) {
    if (hasTestFile(filePath)) {
      log("  → Test file already exists, force-running tester...", "info");
    } else {
      log("  → No test file found, generating tests...", "info");
    }
    generateTests(filePath, report);
  } else {
    if (CONFIG.skipTests) {
      report.testGeneration.skipped++;
    } else {
      log("  → Test file already exists", "debug");
      report.testGeneration.skipped++;
    }
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

  // Get target folder
  const targetArg = process.argv.find(
    (arg) => !arg.startsWith("-") && !arg.includes("batch-process") && !arg.includes("node")
  );

  if (!targetArg) {
    console.error("Usage: node tools/migrate/batch-process.js <registry-subfolder> [options]");
    console.error("\nOptions:");
    console.error("  --dry-run               Preview changes without modifying files");
    console.error("  --verbose               Show detailed output");
    console.error("  --skip-tests            Skip test generation");
    console.error("  --skip-migration        Skip v1 to v2 migration");
    console.error("  --skip-pr               Skip PR creation");
    console.error("  --pr-title <title>      Custom PR title");
    console.error("  --pr-branch <name>      Custom branch name");
    console.error("  --local-api             Auto-start local Flask API server (patched erc7730)");
    console.error("  --local-api-port <port> Port for the local API server (default: 5000)");
    console.error("\nTest generation options (cascaded to generate-tests.js):");
    console.error("  --depth <n>             Max transactions to search (default: 100)");
    console.error("  --max-tests <n>         Max tests per function (default: 3)");
    console.error("  --chain <id>            Only process specific chain ID");
    console.error("  --openai-url <url>      Custom OpenAI API URL (e.g., Azure OpenAI endpoint)");
    console.error("  --openai-key <key>      OpenAI API key (overrides OPENAI_API_KEY env var)");
    console.error("  --openai-model <model>  Model to use (default: gpt-4)");
    console.error("  --azure                 Use Azure OpenAI API format (api-key header)");
    console.error("  --no-test               Skip running the clear signing tester after generation");
    console.error("  --force-test            Run tester even when test file already exists");
    console.error("  --device <device>       Tester device: flex, stax, nanosp, nanox (default: flex)");
    console.error("  --test-log-level <lvl>  Tester log level: none, error, warn, info, debug (default: info)");
    console.error("  --no-refine             Skip refining expectedTexts from tester screen output");
    console.error("\nExamples:");
    console.error("  node tools/migrate/batch-process.js 1inch --dry-run");
    console.error("  node tools/migrate/batch-process.js registry/ethena --verbose");
    console.error("  node tools/migrate/batch-process.js morpho --skip-pr");
    console.error("  node tools/migrate/batch-process.js figment --local-api --verbose");
    console.error("  node tools/migrate/batch-process.js ethena --device stax --no-refine");
    process.exit(1);
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

  // Find all ERC-7730 files
  const files = findErc7730Files(targetFolder);
  console.log(`Found ${files.length} ERC-7730 files to process\n`);

  if (files.length === 0) {
    console.log("No files to process.");
    process.exit(0);
  }

  // Set up working branch (stash + create branch) so changes are isolated.
  // Branch is always created — even if only tests are generated — so the
  // user gets a clean PR-ready branch.  If nothing changes, the branch is
  // deleted in the cleanup step.
  let branchContext = null;
  if (!CONFIG.dryRun && checkGit()) {
    branchContext = setupBranch(path.basename(targetFolder));
  }

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

    // Process each file
    logSection("Processing Files");
    for (const file of files) {
      await processFile(file, report);
    }

    // Commit changes and optionally create PR
    const hasChanges = report.modifiedFiles.length > 0 || report.newFiles.length > 0;
    if (branchContext && hasChanges) {
      logSection("Committing Changes");
      commitAndCreatePr(branchContext, targetFolder, report);
    }

    // Print summary
    report.print();

    // Exit with error if there were failures
    const hasFailures =
      report.migrations.failed.length > 0 ||
      report.testGeneration.failed.length > 0;

    if (hasFailures) {
      process.exit(1);
    }
  } finally {
    stopLocalApiServer();
    if (branchContext) {
      const hasChanges = report.modifiedFiles.length > 0 || report.newFiles.length > 0;
      cleanupBranch(branchContext, hasChanges);
    }
  }
}

main().catch((error) => {
  console.error(`\n❌ Fatal error: ${error.message}`);
  if (CONFIG.verbose) {
    console.error(error.stack);
  }
  process.exit(1);
});
