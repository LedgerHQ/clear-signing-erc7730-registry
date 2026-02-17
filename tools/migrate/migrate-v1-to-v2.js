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
 * - Remove redundant domain.chainId / domain.verifyingContract when deployments exist
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
 *   node tools/migrate/migrate-v1-to-v2.js [--dry-run] [--verbose] [--skip-lint] [--file <path> | <path>]
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
const SINGLE_FILE = (() => {
  // Support --file <path> flag
  if (process.argv.includes("--file")) {
    return process.argv[process.argv.indexOf("--file") + 1];
  }
  // Support bare positional argument (first arg that is not a flag)
  const FLAGS = new Set(["--dry-run", "--verbose", "--skip-lint", "--file"]);
  for (let i = 2; i < process.argv.length; i++) {
    if (!FLAGS.has(process.argv[i]) && !process.argv[i].startsWith("--")) {
      // Skip if previous arg was --file (already handled above)
      if (i > 2 && process.argv[i - 1] === "--file") continue;
      return process.argv[i];
    }
  }
  return null;
})();

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
    domainRedundantRemoved: 0,
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
    mismatches: [],
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
 * Check whether a file is a "leaf" ERC-7730 descriptor (as opposed to a shared/common file).
 * By convention, leaf files start with `calldata` (for contracts) or `eip712` (for messages).
 * Non-leaf files (e.g. common-*.json) are shared includes and cannot be validated standalone.
 * @param {string} filePath - Path to the file
 * @returns {boolean}
 */
function isLeafDescriptor(filePath) {
  const baseName = path.basename(filePath);
  return baseName.startsWith("calldata") || baseName.startsWith("eip712");
}

/**
 * Detect whether a descriptor file is a contract (calldata) or eip712 type.
 * @param {string} filePath - Path to the file
 * @returns {string|null} - "contract", "eip712", or null if unknown
 */
function detectDescriptorType(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    const json = JSON.parse(content);
    if (json.context?.contract) return "contract";
    if (json.context?.eip712) return "eip712";
    return null;
  } catch {
    return null;
  }
}

/**
 * Check if a parsed JSON value is empty (null, undefined, empty object, empty array, empty string).
 * @param {*} value - The parsed JSON value
 * @returns {boolean}
 */
function isEmptyJson(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === "string" && value.trim() === "") return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0) return true;
  return false;
}

/**
 * Deep compare two JSON values, returning a list of human-readable differences.
 * @param {*} v1 - First value (from v1)
 * @param {*} v2 - Second value (from v2)
 * @param {string} jsonPath - Current path for error messages
 * @returns {string[]} - List of difference descriptions
 */
function deepCompare(v1, v2, jsonPath = "$") {
  const diffs = [];

  if (v1 === v2) return diffs;

  if (typeof v1 !== typeof v2) {
    diffs.push(`${jsonPath}: type mismatch — v1 is ${typeof v1}, v2 is ${typeof v2}`);
    return diffs;
  }

  if (v1 === null || v2 === null) {
    if (v1 !== v2) {
      diffs.push(`${jsonPath}: v1=${JSON.stringify(v1)}, v2=${JSON.stringify(v2)}`);
    }
    return diffs;
  }

  if (Array.isArray(v1) && Array.isArray(v2)) {
    if (v1.length !== v2.length) {
      diffs.push(`${jsonPath}: array length mismatch — v1 has ${v1.length} elements, v2 has ${v2.length}`);
    }
    const maxLen = Math.max(v1.length, v2.length);
    for (let i = 0; i < maxLen; i++) {
      if (i >= v1.length) {
        diffs.push(`${jsonPath}[${i}]: missing in v1, present in v2`);
      } else if (i >= v2.length) {
        diffs.push(`${jsonPath}[${i}]: present in v1, missing in v2`);
      } else {
        diffs.push(...deepCompare(v1[i], v2[i], `${jsonPath}[${i}]`));
      }
    }
    return diffs;
  }

  if (typeof v1 === "object" && typeof v2 === "object") {
    const allKeys = new Set([...Object.keys(v1), ...Object.keys(v2)]);
    for (const key of [...allKeys].sort()) {
      const subPath = `${jsonPath}.${key}`;
      if (!(key in v1)) {
        diffs.push(`${subPath}: missing in v1, present in v2`);
      } else if (!(key in v2)) {
        diffs.push(`${subPath}: present in v1, missing in v2`);
      } else {
        diffs.push(...deepCompare(v1[key], v2[key], subPath));
      }
    }
    return diffs;
  }

  // Primitive mismatch
  diffs.push(`${jsonPath}: v1=${JSON.stringify(v1)}, v2=${JSON.stringify(v2)}`);
  return diffs;
}

/**
 * Record a calldata/convert validation failure in stats.
 */
function recordCalldataFailure(version, filePath, errorMsg) {
  const relFile = path.relative(ROOT_DIR, filePath);
  if (version === "v1") {
    stats.calldata.v1Failed.push({ file: relFile, error: errorMsg });
  } else {
    stats.calldata.v2Failed.push({ file: relFile, error: errorMsg });
  }
}

/**
 * Record a calldata/convert validation success in stats.
 */
function recordCalldataSuccess(version) {
  if (version === "v1") {
    stats.calldata.v1Passed++;
  } else {
    stats.calldata.v2Passed++;
  }
}

/**
 * Run output validation on a file using erc7730 CLI.
 *
 * For contract descriptors, runs `erc7730 calldata <file>` (output on stdout).
 * For eip712 descriptors, runs `erc7730 convert erc7730-to-eip712 <input> <tmp-output>`.
 *
 * Validates that the resulting JSON is not empty.
 *
 * @param {string} filePath - Path to the descriptor file
 * @param {string} version - "v1" or "v2" for tracking stats
 * @returns {object|null} - Parsed JSON output, or null on failure
 */
function validateCalldata(filePath, version) {
  const linterCmd = getLinterCommand();
  if (!linterCmd) {
    if (VERBOSE) console.log("  ⚠️  erc7730 CLI not found for output validation");
    stats.calldata.skipped++;
    return null;
  }

  const descriptorType = detectDescriptorType(filePath);
  if (!descriptorType) {
    if (VERBOSE) console.log(`  ⚠️  Could not detect descriptor type for ${path.relative(ROOT_DIR, filePath)}`);
    stats.calldata.skipped++;
    return null;
  }

  if (VERBOSE) console.log(`  📋 Validating ${descriptorType} output ${version}: ${path.relative(ROOT_DIR, filePath)}`);

  try {
    let jsonResult;

    if (descriptorType === "contract") {
      // Contract descriptors: use `erc7730 calldata <file>` (stdout)
      const result = spawnSync(linterCmd, ["calldata", filePath], {
        cwd: ROOT_DIR,
        encoding: "utf8",
        stdio: "pipe",
      });

      if (result.status !== 0) {
        const errorMsg = result.stderr || result.stdout || "Calldata command failed";
        recordCalldataFailure(version, filePath, errorMsg);
        return null;
      }

      try {
        jsonResult = JSON.parse(result.stdout);
      } catch (e) {
        recordCalldataFailure(version, filePath, `Failed to parse calldata output as JSON: ${e.message}\nOutput: ${(result.stdout || "").slice(0, 200)}`);
        return null;
      }

    } else if (descriptorType === "eip712") {
      // EIP-712 descriptors: use `erc7730 convert erc7730-to-eip712 <input> <output>`
      // The converter writes chain-suffixed files: <output>.{chainId}.json
      const tempOutputPath = filePath + `.${version}.eip712.tmp.json`;
      const tempOutputGlob = [];
      try {
        const result = spawnSync(linterCmd, ["convert", "erc7730-to-eip712", filePath, tempOutputPath], {
          cwd: ROOT_DIR,
          encoding: "utf8",
          stdio: "pipe",
        });

        if (result.status !== 0) {
          const errorMsg = result.stderr || result.stdout || "Convert command failed";
          recordCalldataFailure(version, filePath, errorMsg);
          return null;
        }

        // The converter writes chain-specific files like foo.tmp.json -> foo.tmp.{chainId}.json
        // Find all matching output files
        const outputDir = path.dirname(tempOutputPath);
        const baseName = path.basename(tempOutputPath, ".json");
        const outputFiles = fs.readdirSync(outputDir).filter((f) => {
          return f.startsWith(baseName + ".") && f.endsWith(".json") && f !== path.basename(tempOutputPath);
        }).map((f) => path.join(outputDir, f));

        // Also check if the exact path exists (single output case)
        if (fs.existsSync(tempOutputPath)) {
          outputFiles.push(tempOutputPath);
        }

        if (outputFiles.length === 0) {
          recordCalldataFailure(version, filePath, "Convert command succeeded but did not produce output file");
          return null;
        }

        tempOutputGlob.push(...outputFiles);

        // Combine all chain outputs into a single dict keyed by chain ID for comparison
        const combined = {};
        for (const outFile of outputFiles) {
          const content = fs.readFileSync(outFile, "utf8");
          try {
            const parsed = JSON.parse(content);
            // Use chainId as key, or filename if no chainId
            const key = parsed.chainId != null ? String(parsed.chainId) : path.basename(outFile);
            combined[key] = parsed;
          } catch (e) {
            recordCalldataFailure(version, filePath, `Failed to parse convert output as JSON: ${e.message}`);
            return null;
          }
        }

        jsonResult = combined;
      } finally {
        // Clean up all temp output files
        for (const f of tempOutputGlob) {
          try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch { /* ignore */ }
        }
        try { if (fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath); } catch { /* ignore */ }
      }
    }

    // Validate result is not empty
    if (isEmptyJson(jsonResult)) {
      recordCalldataFailure(version, filePath, `Output is empty JSON (${JSON.stringify(jsonResult)})`);
      return null;
    }

    recordCalldataSuccess(version);
    return jsonResult;
  } catch (error) {
    recordCalldataFailure(version, filePath, error.message);
    return null;
  }
}

/**
 * Validate a file before and after migration.
 *
 * Lints both v1 and v2 files, runs output generation (calldata for contracts,
 * convert for eip712) on both, validates outputs are non-empty JSON, and
 * compares v1/v2 outputs — they should be identical.
 *
 * @param {string} filePath - Path to the migrated v2 file
 * @param {string} v1Content - Original v1 content string
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

  // Only run linting and calldata/convert comparison on leaf descriptors (calldata-* / eip712-* files).
  // Non-leaf files (e.g. common-*) are shared includes that cannot be validated standalone.
  const isLeaf = isLeafDescriptor(filePath);
  if (!isLeaf) {
    if (VERBOSE) console.log(`  ℹ️  Non-leaf file — skipping validation for ${path.relative(ROOT_DIR, filePath)}`);
    stats.linting.skipped++;
    stats.calldata.skipped++;
    return;
  }

  let v1Result = null;
  let v2Result = null;

  // If we have v1 content, create a temp file and validate it
  if (wasV1 && v1Content) {
    const v1TempPath = filePath + ".v1.tmp";
    try {
      fs.writeFileSync(v1TempPath, v1Content);

      // Lint v1
      lintFile(v1TempPath, "v1");

      // Output validation on v1 (calldata or convert)
      v1Result = validateCalldata(v1TempPath, "v1");
    } finally {
      // Clean up temp file
      try { if (fs.existsSync(v1TempPath)) fs.unlinkSync(v1TempPath); } catch { /* ignore */ }
    }
  }

  // Lint v2 (the migrated file)
  lintFile(filePath, "v2");

  // Output validation on v2 (calldata or convert)
  v2Result = validateCalldata(filePath, "v2");

  // Compare v1 and v2 outputs — they should be identical
  if (v1Result !== null && v2Result !== null) {
    const differences = deepCompare(v1Result, v2Result);
    const relPath = path.relative(ROOT_DIR, filePath);
    if (differences.length > 0) {
      const diffSummary = differences.map((d) => `    ${d}`).join("\n");
      const errorMsg = `v1/v2 output mismatch (${differences.length} difference${differences.length > 1 ? "s" : ""}):\n${diffSummary}`;
      console.error(`  ❌ ${relPath}: ${errorMsg}`);
      stats.calldata.mismatches.push({ file: relPath, differences });
    } else {
      if (VERBOSE) console.log(`  ✅ v1/v2 outputs match for ${relPath}`);
    }
  } else if (VERBOSE) {
    const relPath = path.relative(ROOT_DIR, filePath);
    if (v1Result === null && v2Result === null) {
      console.log(`  ⚠️  Skipping comparison — both v1 and v2 output generation failed for ${relPath}`);
    } else if (v1Result === null) {
      console.log(`  ⚠️  Skipping comparison — v1 output generation failed for ${relPath}`);
    } else {
      console.log(`  ⚠️  Skipping comparison — v2 output generation failed for ${relPath}`);
    }
  }
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

    // 8. Remove redundant chainId/verifyingContract from eip712 domain when deployments exist
    if (json.context?.eip712?.deployments && json.context.eip712.domain) {
      const domain = json.context.eip712.domain;
      let removed = false;
      if ("chainId" in domain) {
        delete domain.chainId;
        removed = true;
      }
      if ("verifyingContract" in domain) {
        delete domain.verifyingContract;
        removed = true;
      }
      if (removed) {
        stats.changes.domainRedundantRemoved++;
        modified = true;
        // If domain is now empty, remove it entirely
        if (Object.keys(domain).length === 0) {
          delete json.context.eip712.domain;
        }
      }
    }

    // 9. Convert required/excluded to visibility modifiers
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
              // Generate a label from the path (e.g. "#.signatures.[]" -> "Signatures")
              const pathLabel = excludedPath
                .replace(/^#\./, "")
                .replace(/\.\[\]/g, "")
                .replace(/([A-Z])/g, " $1")
                .replace(/[_.]/g, " ")
                .trim()
                .replace(/\b\w/g, (c) => c.toUpperCase());
              format.fields.push({ label: pathLabel, path: excludedPath, visible: "never" });
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

    // 10. Clean up null values (do this last)
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
  console.log(`Domain redundant removed:${stats.changes.domainRedundantRemoved}`);

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

    console.log("\n📋 Output Validation (calldata / convert)");
    console.log("------------------------------------------");
    console.log(`v1 passed:              ${stats.calldata.v1Passed}`);
    console.log(`v2 passed:              ${stats.calldata.v2Passed}`);
    console.log(`Skipped:                ${stats.calldata.skipped}`);
    if (stats.calldata.v1Failed.length > 0) {
      console.log(`v1 failed:              ${stats.calldata.v1Failed.length}`);
      for (const { file, error } of stats.calldata.v1Failed) {
        console.log(`  ${file}: ${error.slice(0, 200)}${error.length > 200 ? '...' : ''}`);
      }
    }
    if (stats.calldata.v2Failed.length > 0) {
      console.log(`v2 failed:              ${stats.calldata.v2Failed.length}`);
      for (const { file, error } of stats.calldata.v2Failed) {
        console.log(`  ${file}: ${error.slice(0, 200)}${error.length > 200 ? '...' : ''}`);
      }
    }
    if (stats.calldata.mismatches.length > 0) {
      console.log(`\n❌ v1/v2 mismatches:     ${stats.calldata.mismatches.length}`);
      for (const { file, differences } of stats.calldata.mismatches) {
        console.log(`  ${file} (${differences.length} difference${differences.length > 1 ? "s" : ""}):`);
        for (const diff of differences.slice(0, 10)) {
          console.log(`    ${diff}`);
        }
        if (differences.length > 10) {
          console.log(`    ... and ${differences.length - 10} more`);
        }
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
    stats.calldata.v2Failed.length > 0 ||
    stats.calldata.mismatches.length > 0;

  if (hasFailures && !DRY_RUN) {
    process.exit(1);
  }
}

// Run
main();
