#!/usr/bin/env node
/**
 * ERC-7730 Batch Processor
 *
 * Processes a registry subfolder to:
 * - Migrate v1 schema files to v2
 * - Validate migrations with linter and binary comparison
 * - Generate missing test files
 * - Optionally create a PR with all changes
 *
 * Usage:
 *   node tools/batch-process.js <registry-subfolder> [options]
 *
 * Options:
 *   --dry-run           Preview changes without modifying files
 *   --verbose           Show detailed output
 *   --skip-tests        Skip test generation
 *   --skip-migration    Skip v1 to v2 migration
 *   --skip-lint         Skip linting validation
 *   --skip-pr           Skip PR creation
 *   --pr-title <title>  Custom PR title
 *   --pr-branch <name>  Custom branch name
 *
 * Environment Variables:
 *   GITHUB_TOKEN        GitHub token for PR creation (required for --create-pr)
 *   ETHERSCAN_API_KEY   For test generation (fetching transactions)
 *   OPENAI_API_KEY      For EIP-712 test generation
 */

const fs = require("fs");
const path = require("path");
const { execSync, spawnSync } = require("child_process");

// =============================================================================
// Configuration
// =============================================================================

const CONFIG = {
  dryRun: process.argv.includes("--dry-run"),
  verbose: process.argv.includes("--verbose"),
  skipTests: process.argv.includes("--skip-tests"),
  skipMigration: process.argv.includes("--skip-migration"),
  skipLint: process.argv.includes("--skip-lint"),
  skipPr: process.argv.includes("--skip-pr"),
  prTitle: getArgValue("--pr-title", null),
  prBranch: getArgValue("--pr-branch", null),
};

function getArgValue(flag, defaultValue) {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && process.argv[idx + 1] && !process.argv[idx + 1].startsWith("--")) {
    return process.argv[idx + 1];
  }
  return defaultValue;
}

// Paths
const ROOT_DIR = path.join(__dirname, "..");
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
    this.linting = { passed: 0, failed: [], skipped: 0 };
    this.binaryComparison = { passed: 0, failed: [], skipped: 0 };
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

    console.log("\n🔍 Linting:");
    console.log(`   Passed:  ${this.linting.passed}`);
    console.log(`   Skipped: ${this.linting.skipped}`);
    if (this.linting.failed.length > 0) {
      console.log(`   Failed:  ${this.linting.failed.length}`);
      this.linting.failed.forEach((f) => console.log(`     - ${f.file}: ${f.error}`));
    }

    console.log("\n🔢 Binary Comparison (placeholder):");
    console.log(`   Passed:  ${this.binaryComparison.passed}`);
    console.log(`   Skipped: ${this.binaryComparison.skipped}`);
    if (this.binaryComparison.failed.length > 0) {
      console.log(`   Failed:  ${this.binaryComparison.failed.length}`);
      this.binaryComparison.failed.forEach((f) => console.log(`     - ${f.file}: ${f.error}`));
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
// Linting
// =============================================================================

/**
 * Check if erc7730 CLI is available
 */
function checkErc7730Cli() {
  try {
    execSync("erc7730 --version", { encoding: "utf8", stdio: "pipe" });
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Lint a file using erc7730 CLI
 */
function lintFile(filePath, report) {
  if (!checkErc7730Cli()) {
    log("erc7730 CLI not found. Install with: pip install erc7730", "warning");
    report.linting.skipped++;
    return true; // Don't fail if CLI not available
  }

  log(`Linting: ${path.relative(ROOT_DIR, filePath)}`, "debug");

  try {
    const result = spawnSync("erc7730", ["lint", filePath], {
      cwd: ROOT_DIR,
      encoding: "utf8",
      stdio: CONFIG.verbose ? "inherit" : "pipe",
    });

    if (result.status !== 0) {
      report.linting.failed.push({
        file: path.relative(ROOT_DIR, filePath),
        error: result.stderr || result.stdout || "Linting failed",
      });
      return false;
    }

    report.linting.passed++;
    return true;
  } catch (error) {
    report.linting.failed.push({
      file: path.relative(ROOT_DIR, filePath),
      error: error.message,
    });
    return false;
  }
}

// =============================================================================
// Binary Comparison (Placeholder)
// =============================================================================

/**
 * Compare binary descriptors between v1 and v2
 * NOTE: This is a placeholder - actual implementation pending erc7730 calldata command support
 */
function compareBinaryDescriptors(v1FilePath, v2FilePath, report) {
  log(`Binary comparison: ${path.relative(ROOT_DIR, v2FilePath)}`, "debug");
  log("  → Binary comparison is a placeholder (erc7730 calldata command not yet available)", "debug");

  // Placeholder: Skip comparison until calldata command is available
  report.binaryComparison.skipped++;

  // TODO: Implement when erc7730 calldata command is available
  // The implementation would:
  // 1. Run `erc7730 calldata <v1-file>` to generate v1 binary descriptor
  // 2. Run `erc7730 calldata <v2-file>` to generate v2 binary descriptor
  // 3. Compare the outputs byte-by-byte
  // 4. Report any differences

  return true;
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

  log(`Generating tests: ${path.relative(ROOT_DIR, filePath)}`, "debug");

  try {
    const result = spawnSync("node", [GENERATE_TESTS_SCRIPT, ...args], {
      cwd: ROOT_DIR,
      encoding: "utf8",
      stdio: CONFIG.verbose ? "inherit" : "pipe",
    });

    if (result.status !== 0) {
      // Don't treat as failure if it's just "no tests generated"
      if (result.stdout?.includes("No tests generated") || result.stderr?.includes("No tests generated")) {
        log(`  → No tests could be generated for ${path.basename(filePath)}`, "warning");
        report.testGeneration.skipped++;
        return true;
      }
      report.testGeneration.failed.push({
        file: path.relative(ROOT_DIR, filePath),
        error: result.stderr || "Test generation failed",
      });
      return false;
    }

    const testFilePath = getTestFilePath(filePath);
    if (!CONFIG.dryRun && fs.existsSync(testFilePath)) {
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
 * Create branch and prepare PR
 */
function preparePr(targetFolder, report) {
  if (!checkGit()) {
    log("Git not available, skipping PR creation", "warning");
    return false;
  }

  if (!checkGhCli()) {
    log("GitHub CLI (gh) not installed. Install with: brew install gh", "warning");
    log("PR will not be created, but changes are staged.", "warning");
    return false;
  }

  const folderName = path.basename(targetFolder);
  const timestamp = new Date().toISOString().split("T")[0].replace(/-/g, "");
  const branchName = CONFIG.prBranch || `batch-update-${folderName}-${timestamp}`;
  const prTitle = CONFIG.prTitle || `[Batch Update] ${folderName} - schema migration and test generation`;

  const allChanges = [...report.modifiedFiles, ...report.newFiles];

  if (allChanges.length === 0) {
    log("No changes to commit", "info");
    return false;
  }

  // Build PR body
  const prBody = buildPrBody(folderName, report);

  if (CONFIG.dryRun) {
    log("\n📝 Would create PR:", "info");
    log(`   Branch: ${branchName}`, "info");
    log(`   Title:  ${prTitle}`, "info");
    log(`   Files:  ${allChanges.length}`, "info");
    console.log("\n--- PR Body Preview ---");
    console.log(prBody);
    console.log("--- End Preview ---\n");
    return true;
  }

  try {
    // Create and checkout new branch
    log(`Creating branch: ${branchName}`, "info");
    execSync(`git checkout -b ${branchName}`, { cwd: ROOT_DIR, stdio: "pipe" });

    // Stage all changes
    for (const file of allChanges) {
      const relPath = path.relative(ROOT_DIR, file);
      execSync(`git add "${relPath}"`, { cwd: ROOT_DIR, stdio: "pipe" });
    }

    // Create commit
    const commitMessage = `chore(${folderName}): batch migration and test generation

- Migrated ${report.migrations.successful} files from v1 to v2 schema
- Generated ${report.testGeneration.successful} test files
- Linted ${report.linting.passed} files`;

    execSync(`git commit -m "${commitMessage}"`, { cwd: ROOT_DIR, stdio: "pipe" });

    // Push branch
    log("Pushing branch to remote...", "info");
    execSync(`git push -u origin ${branchName}`, { cwd: ROOT_DIR, stdio: "pipe" });

    // Create PR using gh CLI
    log("Creating PR...", "info");
    const prResult = execSync(
      `gh pr create --title "${prTitle}" --body "${prBody.replace(/"/g, '\\"')}"`,
      { cwd: ROOT_DIR, encoding: "utf8" }
    );

    report.prCreated = true;
    report.prUrl = prResult.trim();
    log(`PR created: ${report.prUrl}`, "success");

    return true;
  } catch (error) {
    log(`Failed to create PR: ${error.message}`, "error");
    return false;
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
- **Validation**: Linted ${report.linting.passed} files successfully

### Modified Files

${report.modifiedFiles.map((f) => `- \`${path.relative(ROOT_DIR, f)}\``).join("\n") || "None"}

### New Files

${report.newFiles.map((f) => `- \`${path.relative(ROOT_DIR, f)}\``).join("\n") || "None"}

### Validation Status

| Check | Status |
|-------|--------|
| Schema Migration | ${report.migrations.failed.length === 0 ? "✅ Passed" : "⚠️ Some failures"} |
| Linting | ${report.linting.failed.length === 0 ? "✅ Passed" : "⚠️ Some failures"} |
| Binary Comparison | ⏳ Placeholder (pending tooling) |
| Test Generation | ${report.testGeneration.failed.length === 0 ? "✅ Passed" : "⚠️ Some failures"} |

### Notes

<!-- Add any additional notes or context here -->
- This PR was auto-generated by \`tools/batch-process.js\`
- Please review the changes before merging

### Test Plan

- [ ] Review migrated schema files
- [ ] Review generated test files
- [ ] Run CI checks
- [ ] Manual spot-check on sample files`;
}

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

  // Store original content for comparison
  let originalContent = null;
  let wasV1 = false;

  // Check if v1 and migrate
  if (!CONFIG.skipMigration && isV1Schema(filePath)) {
    wasV1 = true;
    originalContent = fs.readFileSync(filePath, "utf8");

    log("  → v1 schema detected, migrating to v2...", "info");
    const migrated = migrateFile(filePath, report);

    if (migrated && !CONFIG.dryRun) {
      // Lint the migrated file
      if (!CONFIG.skipLint) {
        log("  → Linting migrated file...", "info");
        lintFile(filePath, report);
      }

      // Binary comparison placeholder
      log("  → Binary comparison (placeholder)...", "info");
      compareBinaryDescriptors(filePath, filePath, report);
    }
  } else {
    if (CONFIG.skipMigration) {
      report.migrations.skipped++;
    } else {
      log("  → Already v2 schema, skipping migration", "debug");
      report.migrations.skipped++;

      // Still lint v2 files
      if (!CONFIG.skipLint) {
        lintFile(filePath, report);
      }
    }
  }

  // Generate tests if missing
  if (!CONFIG.skipTests && !hasTestFile(filePath)) {
    log("  → No test file found, generating tests...", "info");
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
    console.error("Usage: node tools/batch-process.js <registry-subfolder> [options]");
    console.error("\nOptions:");
    console.error("  --dry-run           Preview changes without modifying files");
    console.error("  --verbose           Show detailed output");
    console.error("  --skip-tests        Skip test generation");
    console.error("  --skip-migration    Skip v1 to v2 migration");
    console.error("  --skip-lint         Skip linting validation");
    console.error("  --skip-pr           Skip PR creation");
    console.error("  --pr-title <title>  Custom PR title");
    console.error("  --pr-branch <name>  Custom branch name");
    console.error("\nExamples:");
    console.error("  node tools/batch-process.js 1inch --dry-run");
    console.error("  node tools/batch-process.js registry/ethena --verbose");
    console.error("  node tools/batch-process.js morpho --skip-pr");
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

  // Process each file
  logSection("Processing Files");
  for (const file of files) {
    await processFile(file, report);
  }

  // Create PR if there are changes
  if (!CONFIG.skipPr && (report.modifiedFiles.length > 0 || report.newFiles.length > 0)) {
    logSection("Preparing Pull Request");
    preparePr(targetFolder, report);
  }

  // Print summary
  report.print();

  // Exit with error if there were failures
  const hasFailures =
    report.migrations.failed.length > 0 ||
    report.linting.failed.length > 0 ||
    report.testGeneration.failed.length > 0;

  if (hasFailures) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(`\n❌ Fatal error: ${error.message}`);
  if (CONFIG.verbose) {
    console.error(error.stack);
  }
  process.exit(1);
});
