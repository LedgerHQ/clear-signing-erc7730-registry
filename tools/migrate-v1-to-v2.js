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
 * Usage:
 *   node tools/migrate-v1-to-v2.js [--dry-run] [--verbose] [--file <path>]
 */

const fs = require("fs");
const path = require("path");

// Configuration
const REGISTRY_DIR = path.join(__dirname, "..", "registry");
const DRY_RUN = process.argv.includes("--dry-run");
const VERBOSE = process.argv.includes("--verbose");
const SINGLE_FILE = process.argv.includes("--file")
  ? process.argv[process.argv.indexOf("--file") + 1]
  : null;

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
};

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

  if (stats.errors.length > 0) {
    console.log("\n❌ Errors");
    console.log("---------");
    for (const { file, error } of stats.errors) {
      console.log(`  ${file}: ${error}`);
    }
  }

  if (DRY_RUN) {
    console.log("\n💡 Run without --dry-run to apply changes");
  }
}

// Run
main();
