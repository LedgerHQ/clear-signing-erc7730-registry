#!/usr/bin/env node
/**
 * ERC-7730 Migration Script: v1 to v2
 *
 * This script migrates all registry files from erc7730-v1.schema.json to erc7730-v2.schema.json
 *
 * Key transformations:
 * - Update schema reference
 * - Add metadata.contractName from context.$id
 * - Remove metadata.info.legalName
 * - Remove context.contract.addressMatcher
 * - Remove context.contract.abi (format keys should be human-readable ABI)
 * - Remove context.eip712.schemas (format keys should be encodeType strings)
 * - Convert required/excluded to visibility modifiers
 * - Remove screens
 * - Clean up null values
 * - Transform format keys to proper format (human-readable ABI or EIP-712 encodeType)
 *
 * After migration, validates:
 * - Lints the migrated v2 file
 * - Runs calldata validation on both v1 (original) and v2 (migrated) files
 *
 * Usage:
 *   node tools/migrate/migrate-v1-to-v2.js [--dry-run] [--verbose] [--file <path>] [--skip-lint]
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

// Configuration
const ROOT_DIR = path.join(__dirname, "..", "..");
const REGISTRY_DIR = path.join(ROOT_DIR, "registry");
const DRY_RUN = process.argv.includes("--dry-run");
const VERBOSE = process.argv.includes("--verbose");
const SKIP_LINT = process.argv.includes("--skip-lint");
const SINGLE_FILE = process.argv.includes("--file")
  ? process.argv[process.argv.indexOf("--file") + 1]
  : null;

// Local linter path
const LOCAL_LINTER_PATH = path.join(ROOT_DIR, "tools", "linter", ".venv", "bin", "erc7730");

// Statistics
const stats = {
  total: 0,
  migrated: 0,
  skipped: 0,
  errors: [],
  changes: {
    schemaRef: 0,
    contractName: 0,
    legalName: 0,
    addressMatcher: 0,
    abiRemoved: 0,
    schemasRemoved: 0,
    requiredConverted: 0,
    excludedConverted: 0,
    screensRemoved: 0,
    nullsCleaned: 0,
    formatKeysTransformed: 0,
  },
  linting: {
    v1Passed: 0,
    v1Failed: [],
    v2Passed: 0,
    v2Failed: [],
    skipped: 0,
  },
  calldata: {
    v1Passed: 0,
    v1Failed: [],
    v2Passed: 0,
    v2Failed: [],
    skipped: 0,
  },
};

// =============================================================================
// Linting Functions
// =============================================================================

/**
 * Check if local linter is available
 */
function checkLocalLinter() {
  return fs.existsSync(LOCAL_LINTER_PATH);
}

/**
 * Get the linter command to use (local or global)
 */
function getLinterCommand() {
  if (checkLocalLinter()) {
    return LOCAL_LINTER_PATH;
  }
  // Fallback to global erc7730 command
  try {
    spawnSync("erc7730", ["--version"], { encoding: "utf8", stdio: "pipe" });
    return "erc7730";
  } catch (e) {
    return null;
  }
}

/**
 * Lint a file using erc7730 CLI
 * @param {string} filePath - Path to the file to lint
 * @param {string} version - "v1" or "v2" for tracking stats
 * @returns {boolean} - True if linting passed
 */
function lintFile(filePath, version) {
  const linterCmd = getLinterCommand();
  if (!linterCmd) {
    if (VERBOSE) console.log("  ⚠️  erc7730 CLI not found. Install with: pip install erc7730");
    stats.linting.skipped++;
    return true; // Don't fail if CLI not available
  }

  if (VERBOSE) console.log(`  🔍 Linting ${version}: ${path.relative(ROOT_DIR, filePath)}`);

  try {
    const result = spawnSync(linterCmd, ["lint", filePath], {
      cwd: ROOT_DIR,
      encoding: "utf8",
      stdio: VERBOSE ? "inherit" : "pipe",
    });

    if (result.status !== 0) {
      const errorMsg = result.stderr || result.stdout || "Linting failed";
      if (version === "v1") {
        stats.linting.v1Failed.push({ file: path.relative(ROOT_DIR, filePath), error: errorMsg });
      } else {
        stats.linting.v2Failed.push({ file: path.relative(ROOT_DIR, filePath), error: errorMsg });
      }
      return false;
    }

    if (version === "v1") {
      stats.linting.v1Passed++;
    } else {
      stats.linting.v2Passed++;
    }
    return true;
  } catch (error) {
    if (version === "v1") {
      stats.linting.v1Failed.push({ file: path.relative(ROOT_DIR, filePath), error: error.message });
    } else {
      stats.linting.v2Failed.push({ file: path.relative(ROOT_DIR, filePath), error: error.message });
    }
    return false;
  }
}

/**
 * Run calldata validation on a file using erc7730 CLI
 * @param {string} filePath - Path to the file to validate
 * @param {string} version - "v1" or "v2" for tracking stats
 * @returns {object|null} - Calldata output or null on failure
 */
function validateCalldata(filePath, version) {
  const linterCmd = getLinterCommand();
  if (!linterCmd) {
    if (VERBOSE) console.log("  ⚠️  erc7730 CLI not found for calldata validation");
    stats.calldata.skipped++;
    return null;
  }

  if (VERBOSE) console.log(`  📋 Validating calldata ${version}: ${path.relative(ROOT_DIR, filePath)}`);

  try {
    const result = spawnSync(linterCmd, ["calldata", filePath], {
      cwd: ROOT_DIR,
      encoding: "utf8",
      stdio: "pipe",
    });

    if (result.status !== 0) {
      const errorMsg = result.stderr || result.stdout || "Calldata validation failed";
      if (version === "v1") {
        stats.calldata.v1Failed.push({ file: path.relative(ROOT_DIR, filePath), error: errorMsg });
      } else {
        stats.calldata.v2Failed.push({ file: path.relative(ROOT_DIR, filePath), error: errorMsg });
      }
      return null;
    }

    if (version === "v1") {
      stats.calldata.v1Passed++;
    } else {
      stats.calldata.v2Passed++;
    }
    return result.stdout;
  } catch (error) {
    if (version === "v1") {
      stats.calldata.v1Failed.push({ file: path.relative(ROOT_DIR, filePath), error: error.message });
    } else {
      stats.calldata.v2Failed.push({ file: path.relative(ROOT_DIR, filePath), error: error.message });
    }
    return null;
  }
}

/**
 * Validate a file before and after migration
 * @param {string} filePath - Path to the file
 * @param {string} v1Content - Original v1 content (to validate calldata before migration)
 * @param {boolean} wasV1 - Whether the file was originally v1
 */
function validateMigration(filePath, v1Content, wasV1) {
  if (SKIP_LINT || DRY_RUN) {
    stats.linting.skipped++;
    stats.calldata.skipped++;
    return;
  }

  const linterCmd = getLinterCommand();
  if (!linterCmd) {
    if (VERBOSE) console.log("  ⚠️  Skipping validation - erc7730 CLI not available");
    stats.linting.skipped++;
    stats.calldata.skipped++;
    return;
  }

  // If we have v1 content, create a temp file and validate it
  let v1TempPath = null;
  if (wasV1 && v1Content) {
    v1TempPath = filePath + ".v1.tmp";
    fs.writeFileSync(v1TempPath, v1Content);
    
    // Lint v1
    lintFile(v1TempPath, "v1");
    
    // Calldata validation on v1
    validateCalldata(v1TempPath, "v1");
    
    // Clean up temp file
    fs.unlinkSync(v1TempPath);
  }

  // Lint v2 (the migrated file)
  lintFile(filePath, "v2");
  
  // Calldata validation on v2
  validateCalldata(filePath, "v2");
}

/**
 * Recursively remove keys with null values from an object
 */
function removeNullValues(obj) {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj
      .map((item) => removeNullValues(item))
      .filter((item) => item !== null);
  }

  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === null) {
      stats.changes.nullsCleaned++;
      continue;
    }
    const cleaned = removeNullValues(value);
    if (cleaned !== null) {
      result[key] = cleaned;
    }
  }
  return result;
}

/**
 * Generate EIP-712 encodeType string from schema
 * Format: "PrimaryType(type1 name1,type2 name2,...)DependentType(...)"
 */
function generateEncodeType(schemas, primaryType) {
  if (!Array.isArray(schemas)) return primaryType;

  const schema = schemas.find((s) => s.primaryType === primaryType);
  if (!schema || !schema.types) return primaryType;

  const types = schema.types;
  const visited = new Set();
  const result = [];

  function encodeTypeRecursive(typeName) {
    if (visited.has(typeName) || typeName === "EIP712Domain") return;
    if (!types[typeName]) return;
    visited.add(typeName);

    const fields = types[typeName];
    const fieldStr = fields.map((f) => `${f.type} ${f.name}`).join(",");
    result.push({ name: typeName, encoded: `${typeName}(${fieldStr})` });

    // Find dependent types (strip array notation)
    for (const field of fields) {
      const baseType = field.type.replace(/\[\]$/, "");
      if (types[baseType]) {
        encodeTypeRecursive(baseType);
      }
    }
  }

  encodeTypeRecursive(primaryType);

  if (result.length === 0) return primaryType;

  // Primary type first, then dependent types sorted alphabetically
  const [primary, ...deps] = result;
  const sortedDeps = deps.sort((a, b) => a.name.localeCompare(b.name));
  return primary.encoded + sortedDeps.map((d) => d.encoded).join("");
}

/**
 * Build human-readable function signature from ABI entry
 */
function buildHumanReadableSignature(abiEntry) {
  if (!abiEntry || abiEntry.type !== "function") return null;

  const name = abiEntry.name;
  const inputs = abiEntry.inputs || [];

  function formatParam(param) {
    let type = param.type;

    // Handle tuple types
    if (type === "tuple" || type === "tuple[]") {
      const components = param.components || [];
      const inner = components.map(formatParam).join(", ");
      type = type === "tuple[]" ? `(${inner})[]` : `(${inner})`;
    }

    return `${type} ${param.name}`;
  }

  const params = inputs.map(formatParam).join(", ");
  return `${name}(${params})`;
}

/**
 * Try to find matching ABI entry for a format key
 */
function findAbiEntry(abi, formatKey) {
  if (!Array.isArray(abi)) return null;

  // Extract function name from format key
  const match = formatKey.match(/^(\w+)\(/);
  if (!match) return null;

  const funcName = match[1];
  return abi.find(
    (entry) => entry.type === "function" && entry.name === funcName
  );
}

/**
 * Transform format keys and build mapping
 */
function transformFormatKeys(json) {
  if (!json.display?.formats) return {};

  const keyMapping = {};
  const isEip712 = !!json.context?.eip712;
  const isContract = !!json.context?.contract;

  // For EIP-712, use schemas to generate encodeType
  if (isEip712 && json.context.eip712.schemas) {
    const schemas = json.context.eip712.schemas;
    if (Array.isArray(schemas)) {
      for (const oldKey of Object.keys(json.display.formats)) {
        const newKey = generateEncodeType(schemas, oldKey);
        if (newKey !== oldKey) {
          keyMapping[oldKey] = newKey;
          stats.changes.formatKeysTransformed++;
        }
      }
    }
  }

  // For contracts, try to build human-readable signatures from ABI
  if (isContract && json.context.contract.abi) {
    const abi = json.context.contract.abi;
    if (Array.isArray(abi)) {
      for (const oldKey of Object.keys(json.display.formats)) {
        const abiEntry = findAbiEntry(abi, oldKey);
        if (abiEntry) {
          const newKey = buildHumanReadableSignature(abiEntry);
          if (newKey && newKey !== oldKey) {
            keyMapping[oldKey] = newKey;
            stats.changes.formatKeysTransformed++;
          }
        }
      }
    }
  }

  return keyMapping;
}

/**
 * Main migration function for a single file
 */
function migrateFile(filePath) {
  stats.total++;

  try {
    const content = fs.readFileSync(filePath, "utf8");
    const originalV1Content = content; // Store for validation
    let json = JSON.parse(content);
    let modified = false;

    // Skip if not using v1 schema
    if (!json.$schema?.includes("erc7730-v1.schema.json")) {
      stats.skipped++;
      if (VERBOSE) console.log(`Skipped (not v1): ${filePath}`);
      return false;
    }

    // 1. Update schema reference
    json.$schema = json.$schema.replace(
      "erc7730-v1.schema.json",
      "erc7730-v2.schema.json"
    );
    stats.changes.schemaRef++;
    modified = true;

    // 2. Add metadata.contractName from context.$id
    if (json.context?.$id && !json.metadata?.contractName) {
      json.metadata = json.metadata || {};
      json.metadata.contractName = json.context.$id;
      stats.changes.contractName++;
      modified = true;
    }

    // 3. Remove legalName from metadata.info
    if (json.metadata?.info?.legalName !== undefined) {
      delete json.metadata.info.legalName;
      stats.changes.legalName++;
      modified = true;
    }

    // 4. Remove addressMatcher from context.contract
    if (json.context?.contract?.addressMatcher !== undefined) {
      delete json.context.contract.addressMatcher;
      stats.changes.addressMatcher++;
      modified = true;
    }

    // 5. Transform format keys before removing abi/schemas
    const keyMapping = transformFormatKeys(json);

    // Apply key mapping to formats
    if (Object.keys(keyMapping).length > 0 && json.display?.formats) {
      const newFormats = {};
      for (const [oldKey, format] of Object.entries(json.display.formats)) {
        const newKey = keyMapping[oldKey] || oldKey;
        newFormats[newKey] = format;
      }
      json.display.formats = newFormats;
      modified = true;
    }

    // 6. Remove abi from context.contract
    if (json.context?.contract?.abi !== undefined) {
      delete json.context.contract.abi;
      stats.changes.abiRemoved++;
      modified = true;
    }

    // 7. Remove schemas from context.eip712
    if (json.context?.eip712?.schemas !== undefined) {
      delete json.context.eip712.schemas;
      stats.changes.schemasRemoved++;
      modified = true;
    }

    // 8. Convert required/excluded to visibility modifiers
    if (json.display?.formats) {
      for (const format of Object.values(json.display.formats)) {
        const required = format.required || [];
        const excluded = format.excluded || [];

        // Add visible: "always" to required fields
        if (format.fields && Array.isArray(format.fields)) {
          for (const field of format.fields) {
            if (field.path && required.includes(field.path)) {
              field.visible = "always";
              stats.changes.requiredConverted++;
              modified = true;
            }
          }

          // Add new fields for excluded paths with visible: "never"
          for (const excludedPath of excluded) {
            // Check if field already exists
            const existingField = format.fields.find(
              (f) => f.path === excludedPath
            );
            if (!existingField) {
              format.fields.push({ path: excludedPath, visible: "never" });
              stats.changes.excludedConverted++;
              modified = true;
            }
          }
        }

        // Remove required, excluded, screens
        if (format.required !== undefined) {
          delete format.required;
          modified = true;
        }
        if (format.excluded !== undefined) {
          delete format.excluded;
          modified = true;
        }
        if (format.screens !== undefined) {
          delete format.screens;
          stats.changes.screensRemoved++;
          modified = true;
        }
      }
    }

    // 9. Clean up null values (do this last)
    const beforeNulls = stats.changes.nullsCleaned;
    json = removeNullValues(json);
    if (stats.changes.nullsCleaned > beforeNulls) {
      modified = true;
    }

    // Write back if modified
    if (modified) {
      if (!DRY_RUN) {
        fs.writeFileSync(filePath, JSON.stringify(json, null, 2) + "\n");
        
        // Validate the migration (lint v1 and v2, calldata on both)
        validateMigration(filePath, originalV1Content, true);
      }
      stats.migrated++;
      if (VERBOSE) console.log(`Migrated: ${filePath}`);
      return true;
    }

    stats.skipped++;
    return false;
  } catch (error) {
    stats.errors.push({ file: filePath, error: error.message });
    console.error(`Error processing ${filePath}: ${error.message}`);
    return false;
  }
}

/**
 * Recursively find all JSON files in a directory
 */
function findJsonFiles(dir) {
  const files = [];

  function walk(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".json")) {
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files;
}

/**
 * Main entry point
 */
function main() {
  console.log("ERC-7730 Migration: v1 → v2");
  console.log("===========================");
  if (DRY_RUN) console.log("🔍 DRY RUN MODE - No files will be modified\n");

  let files;
  if (SINGLE_FILE) {
    const fullPath = path.resolve(SINGLE_FILE);
    if (!fs.existsSync(fullPath)) {
      console.error(`File not found: ${fullPath}`);
      process.exit(1);
    }
    files = [fullPath];
    console.log(`Processing single file: ${fullPath}\n`);
  } else {
    files = findJsonFiles(REGISTRY_DIR);
    console.log(`Found ${files.length} JSON files in registry/\n`);
  }

  // Process files
  for (const file of files) {
    migrateFile(file);
  }

  // Print summary
  console.log("\n📊 Migration Summary");
  console.log("====================");
  console.log(`Total files scanned:    ${stats.total}`);
  console.log(`Files migrated:         ${stats.migrated}`);
  console.log(`Files skipped:          ${stats.skipped}`);
  console.log(`Errors:                 ${stats.errors.length}`);

  console.log("\n📝 Changes Applied");
  console.log("------------------");
  console.log(`Schema references:      ${stats.changes.schemaRef}`);
  console.log(`Contract names added:   ${stats.changes.contractName}`);
  console.log(`legalName removed:      ${stats.changes.legalName}`);
  console.log(`addressMatcher removed: ${stats.changes.addressMatcher}`);
  console.log(`ABI removed:            ${stats.changes.abiRemoved}`);
  console.log(`Schemas removed:        ${stats.changes.schemasRemoved}`);
  console.log(`Required → visible:     ${stats.changes.requiredConverted}`);
  console.log(`Excluded → visible:     ${stats.changes.excludedConverted}`);
  console.log(`Screens removed:        ${stats.changes.screensRemoved}`);
  console.log(`Null values cleaned:    ${stats.changes.nullsCleaned}`);
  console.log(`Format keys transformed:${stats.changes.formatKeysTransformed}`);

  // Print linting summary
  if (!SKIP_LINT && !DRY_RUN) {
    console.log("\n🔍 Linting Validation");
    console.log("---------------------");
    console.log(`v1 passed:              ${stats.linting.v1Passed}`);
    console.log(`v2 passed:              ${stats.linting.v2Passed}`);
    console.log(`Skipped:                ${stats.linting.skipped}`);
    if (stats.linting.v1Failed.length > 0) {
      console.log(`v1 failed:              ${stats.linting.v1Failed.length}`);
      for (const { file, error } of stats.linting.v1Failed) {
        console.log(`  ${file}: ${error.slice(0, 100)}${error.length > 100 ? '...' : ''}`);
      }
    }
    if (stats.linting.v2Failed.length > 0) {
      console.log(`v2 failed:              ${stats.linting.v2Failed.length}`);
      for (const { file, error } of stats.linting.v2Failed) {
        console.log(`  ${file}: ${error.slice(0, 100)}${error.length > 100 ? '...' : ''}`);
      }
    }

    console.log("\n📋 Calldata Validation");
    console.log("----------------------");
    console.log(`v1 passed:              ${stats.calldata.v1Passed}`);
    console.log(`v2 passed:              ${stats.calldata.v2Passed}`);
    console.log(`Skipped:                ${stats.calldata.skipped}`);
    if (stats.calldata.v1Failed.length > 0) {
      console.log(`v1 failed:              ${stats.calldata.v1Failed.length}`);
      for (const { file, error } of stats.calldata.v1Failed) {
        console.log(`  ${file}: ${error.slice(0, 100)}${error.length > 100 ? '...' : ''}`);
      }
    }
    if (stats.calldata.v2Failed.length > 0) {
      console.log(`v2 failed:              ${stats.calldata.v2Failed.length}`);
      for (const { file, error } of stats.calldata.v2Failed) {
        console.log(`  ${file}: ${error.slice(0, 100)}${error.length > 100 ? '...' : ''}`);
      }
    }
  }

  if (stats.errors.length > 0) {
    console.log("\n❌ Migration Errors");
    console.log("-------------------");
    for (const { file, error } of stats.errors) {
      console.log(`  ${file}: ${error}`);
    }
  }

  if (DRY_RUN) {
    console.log("\n💡 Run without --dry-run to apply changes");
  }
  if (SKIP_LINT) {
    console.log("\n💡 Run without --skip-lint to validate files after migration");
  }

  // Determine exit code based on failures
  const hasFailures =
    stats.errors.length > 0 ||
    stats.linting.v2Failed.length > 0 ||
    stats.calldata.v2Failed.length > 0;

  if (hasFailures && !DRY_RUN) {
    process.exit(1);
  }
}

// Run
main();
