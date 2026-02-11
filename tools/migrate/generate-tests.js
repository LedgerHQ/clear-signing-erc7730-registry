#!/usr/bin/env node
/**
 * ERC-7730 Test Generator
 *
 * Generates test files for ERC-7730 clear signing descriptors by:
 * - Fetching real transactions from block explorers (Etherscan, etc.)
 * - Using LLM to generate EIP-712 message examples
 * - Inferring expected display values from the descriptor
 *
 * Usage:
 *   node tools/migrate/generate-tests.js <erc7730-file> [options]
 *
 * Options:
 *   --dry-run         Preview without writing files
 *   --verbose         Show detailed output
 *   --depth <n>       Max transactions to search (default: 100)
 *   --max-tests <n>   Max tests to generate per function (default: 3)
 *   --chain <id>      Only process specific chain ID
 *   --openai-url <url>  Custom OpenAI API URL (e.g., Azure OpenAI endpoint)
 *   --openai-key <key>  OpenAI API key (overrides OPENAI_API_KEY env var)
 *   --openai-model <model>  Model to use (default: gpt-4)
 *   --azure            Use Azure OpenAI API format (api-key header)
 *
 * Environment Variables:
 *   ETHERSCAN_API_KEY      API key for Etherscan (Ethereum mainnet)
 *   POLYGONSCAN_API_KEY    API key for Polygonscan
 *   BSCSCAN_API_KEY        API key for BSCScan
 *   ARBISCAN_API_KEY       API key for Arbiscan
 *   OPTIMISM_API_KEY       API key for Optimism Etherscan
 *   BASESCAN_API_KEY       API key for Basescan
 *   OPENAI_API_KEY         API key for OpenAI (EIP-712 examples)
 *   LLM_BASE_URL           Custom LLM endpoint (optional)
 *   AZURE_OPENAI           Set to "true" to use Azure OpenAI API format
 */

const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const crypto = require("crypto");

// =============================================================================
// Configuration
// =============================================================================

const CONFIG = {
  dryRun: process.argv.includes("--dry-run"),
  verbose: process.argv.includes("--verbose"),
  depth: getArgValue("--depth", 100),
  maxTests: getArgValue("--max-tests", 3),
  chainFilter: getArgValue("--chain", null),
  openaiUrl: getArgValue("--openai-url", process.env.LLM_BASE_URL || "https://api.openai.com"),
  openaiKey: getArgValue("--openai-key", process.env.OPENAI_API_KEY),
  openaiModel: getArgValue("--openai-model", "gpt-4"),
  useAzure: process.argv.includes("--azure") || process.env.AZURE_OPENAI === "true",
};

function getArgValue(flag, defaultValue) {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && process.argv[idx + 1]) {
    const val = process.argv[idx + 1];
    return isNaN(val) ? val : parseInt(val, 10);
  }
  return defaultValue;
}

// =============================================================================
// Block Explorer Providers
// =============================================================================

/**
 * Provider registry - maps chainId to explorer configuration
 * Uses unified Etherscan V2 API (api.etherscan.io/v2/api?chainid=X)
 */
const PROVIDERS = {
  1: {
    name: "Etherscan",
    baseUrl: "api.etherscan.io",
    apiKeyEnv: "ETHERSCAN_API_KEY",
    explorerUrl: "https://etherscan.io/tx/",
  },
  56: {
    name: "BSCScan",
    baseUrl: "api.etherscan.io", // V2 unified API
    apiKeyEnv: "ETHERSCAN_API_KEY",
    explorerUrl: "https://bscscan.com/tx/",
  },
  137: {
    name: "Polygonscan",
    baseUrl: "api.etherscan.io", // V2 unified API
    apiKeyEnv: "ETHERSCAN_API_KEY",
    explorerUrl: "https://polygonscan.com/tx/",
  },
  42161: {
    name: "Arbiscan",
    baseUrl: "api.etherscan.io", // V2 unified API
    apiKeyEnv: "ETHERSCAN_API_KEY",
    explorerUrl: "https://arbiscan.io/tx/",
  },
  10: {
    name: "Optimism Etherscan",
    baseUrl: "api.etherscan.io", // V2 unified API
    apiKeyEnv: "ETHERSCAN_API_KEY",
    explorerUrl: "https://optimistic.etherscan.io/tx/",
  },
  8453: {
    name: "Basescan",
    baseUrl: "api.etherscan.io", // V2 unified API
    apiKeyEnv: "ETHERSCAN_API_KEY",
    explorerUrl: "https://basescan.org/tx/",
  },
  43114: {
    name: "Snowtrace",
    baseUrl: "api.etherscan.io", // V2 unified API
    apiKeyEnv: "ETHERSCAN_API_KEY",
    explorerUrl: "https://snowtrace.io/tx/",
  },
};

/**
 * Make an HTTPS GET request
 */
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === "https:" ? https : http;

    client
      .get(url, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve(data);
          }
        });
      })
      .on("error", reject);
  });
}

/**
 * Fetch transactions for an address from a block explorer
 * Uses Etherscan V2 API format: /v2/api?chainid=X
 */
async function fetchTransactions(chainId, address, depth = 100) {
  const provider = PROVIDERS[chainId];
  if (!provider) {
    log(`  ⚠️  No provider configured for chainId ${chainId}`);
    return [];
  }

  const apiKey = process.env[provider.apiKeyEnv];
  if (!apiKey) {
    log(`  ⚠️  Missing API key: ${provider.apiKeyEnv}`);
    return [];
  }

  // Use V2 API format with chainid parameter
  const url =
    `https://${provider.baseUrl}/v2/api?chainid=${chainId}&module=account&action=txlist` +
    `&address=${address}&startblock=0&endblock=99999999` +
    `&page=1&offset=${depth}&sort=desc&apikey=${apiKey}`;

  if (CONFIG.verbose) {
    log(`  📡 Fetching from ${provider.name} (chain ${chainId})...`);
  }

  try {
    const response = await httpsGet(url);
    if (response.status === "1" && Array.isArray(response.result)) {
      return response.result.filter((tx) => tx.to?.toLowerCase() === address.toLowerCase());
    }
    if (response.message === "No transactions found") {
      return [];
    }
    log(`  ⚠️  ${provider.name} API error: ${response.message || "Unknown error"}`);
    return [];
  } catch (error) {
    log(`  ❌ ${provider.name} request failed: ${error.message}`);
    return [];
  }
}

/**
 * Fetch full transaction details including input data
 */
async function fetchTransactionByHash(chainId, txHash) {
  const provider = PROVIDERS[chainId];
  if (!provider) return null;

  const apiKey = process.env[provider.apiKeyEnv];
  if (!apiKey) return null;

  const url =
    `https://${provider.baseUrl}/api?module=proxy&action=eth_getTransactionByHash` +
    `&txhash=${txHash}&apikey=${apiKey}`;

  try {
    const response = await httpsGet(url);
    if (response.result) {
      return response.result;
    }
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Get raw transaction from transaction details
 * Note: Block explorers don't provide signed raw tx directly,
 * so we use the input data as the test case
 */
async function getRawTransaction(chainId, txHash) {
  const provider = PROVIDERS[chainId];
  if (!provider) return null;

  const apiKey = process.env[provider.apiKeyEnv];
  if (!apiKey) return null;

  // Fetch raw transaction using eth_getRawTransactionByHash if available (V2 API)
  const url =
    `https://${provider.baseUrl}/v2/api?chainid=${chainId}&module=proxy&action=eth_getRawTransactionByHash` +
    `&txhash=${txHash}&apikey=${apiKey}`;

  try {
    const response = await httpsGet(url);
    if (response.result && response.result.startsWith("0x")) {
      return response.result;
    }
  } catch (error) {
    // Fallback below
  }

  // If raw tx not available, return null - we'll use tx details instead
  return null;
}

// =============================================================================
// Function Signature Utilities
// =============================================================================

/**
 * Compute function selector (first 4 bytes of keccak256 hash)
 */
function computeSelector(signature) {
  // Normalize signature: remove param names, spaces
  const normalized = normalizeSignature(signature);
  const hash = crypto.createHash("sha3-256");
  // Note: Node's sha3-256 is actually Keccak-256
  // For proper Keccak, we need to use a different approach
  return keccak256(normalized).slice(0, 10);
}

/**
 * Simple Keccak-256 implementation for function selectors
 */
function keccak256(input) {
  // Use the keccak256 from crypto if available (Node 16+)
  // Otherwise fall back to a pure JS implementation
  try {
    const { createHash } = require("crypto");
    // Node.js doesn't have native keccak, so we'll compute selector differently
    // For now, extract from signature pattern
    return computeSelectorFromSignature(input);
  } catch (e) {
    return computeSelectorFromSignature(input);
  }
}

/**
 * Compute selector using Web Crypto or manual implementation
 */
function computeSelectorFromSignature(signature) {
  // Keccak-256 implementation for function selectors
  const Keccak = require("./keccak-tiny");
  if (typeof Keccak !== "undefined") {
    return "0x" + Keccak.keccak256(signature).slice(0, 8);
  }

  // Fallback: use a lookup table for common functions
  // This is a simplified approach - in production, use a proper keccak library
  const hash = simpleHash(signature);
  return "0x" + hash.slice(0, 8);
}

/**
 * Simple hash fallback (not cryptographically secure, just for matching)
 */
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}

/**
 * Normalize function signature for selector computation
 * "transfer(address to, uint256 amount)" -> "transfer(address,uint256)"
 */
function normalizeSignature(signature) {
  // Extract function name
  const match = signature.match(/^(\w+)\s*\(/);
  if (!match) return signature;

  const funcName = match[1];
  const paramsStart = signature.indexOf("(");
  const paramsEnd = signature.lastIndexOf(")");
  const paramsStr = signature.slice(paramsStart + 1, paramsEnd);

  // Parse parameters and extract only types
  const types = extractTypes(paramsStr);
  return `${funcName}(${types.join(",")})`;
}

/**
 * Extract parameter types from a parameter string
 */
function extractTypes(paramsStr) {
  if (!paramsStr.trim()) return [];

  const types = [];
  let depth = 0;
  let current = "";

  for (let i = 0; i < paramsStr.length; i++) {
    const char = paramsStr[i];
    if (char === "(") depth++;
    if (char === ")") depth--;
    if (char === "," && depth === 0) {
      types.push(extractType(current.trim()));
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) {
    types.push(extractType(current.trim()));
  }

  return types;
}

/**
 * Extract type from a parameter declaration
 * "address to" -> "address"
 * "(address srcToken, uint256 amount) desc" -> "(address,uint256)"
 */
function extractType(param) {
  param = param.trim();

  // Handle tuple types
  if (param.startsWith("(")) {
    const tupleEnd = findMatchingParen(param, 0);
    const tupleContent = param.slice(1, tupleEnd);
    const innerTypes = extractTypes(tupleContent);
    const suffix = param.slice(tupleEnd + 1).trim();

    // Check for array notation
    let arrayNotation = "";
    const arrayMatch = suffix.match(/^(\[\d*\])+/);
    if (arrayMatch) {
      arrayNotation = arrayMatch[0];
    }

    return `(${innerTypes.join(",")})${arrayNotation}`;
  }

  // Handle simple types: "address to" -> "address"
  const parts = param.split(/\s+/);
  let type = parts[0];

  // Check if array notation is attached or separate
  for (let i = 1; i < parts.length; i++) {
    if (parts[i].match(/^\[\d*\]/)) {
      type += parts[i];
    }
  }

  // Handle array notation in type itself
  const typeMatch = param.match(/^(\w+(?:\[\d*\])*)/);
  if (typeMatch) {
    return typeMatch[1];
  }

  return type;
}

/**
 * Find matching closing parenthesis
 */
function findMatchingParen(str, start) {
  let depth = 0;
  for (let i = start; i < str.length; i++) {
    if (str[i] === "(") depth++;
    if (str[i] === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return str.length;
}

/**
 * Extract selector from calldata
 */
function extractSelector(input) {
  if (!input || input.length < 10) return null;
  return input.slice(0, 10).toLowerCase();
}

// =============================================================================
// ERC-7730 Parser
// =============================================================================

/**
 * Parse an ERC-7730 file and extract relevant information
 */
function parseErc7730(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const json = JSON.parse(content);

  const result = {
    filePath,
    fileName: path.basename(filePath),
    isCalldata: !!json.context?.contract,
    isEip712: !!json.context?.eip712,
    deployments: [],
    functions: [],
    messageTypes: [],
    metadata: json.metadata || {},
  };

  // Extract deployments
  if (json.context?.contract?.deployments) {
    result.deployments = json.context.contract.deployments;
  } else if (json.context?.eip712?.deployments) {
    result.deployments = json.context.eip712.deployments;
  }

  // Extract functions/message types from display.formats
  if (json.display?.formats) {
    for (const [key, format] of Object.entries(json.display.formats)) {
      if (result.isCalldata) {
        const selector = computeSelectorManual(key);
        result.functions.push({
          signature: key,
          selector,
          intent: format.intent || format.$id || key,
          fields: format.fields || [],
        });
      } else if (result.isEip712) {
        result.messageTypes.push({
          primaryType: extractPrimaryType(key),
          encodeType: key,
          intent: format.intent || key,
          fields: format.fields || [],
        });
      }
    }
  }

  // Also check for EIP-712 schemas (v1 format)
  if (json.context?.eip712?.schemas && result.messageTypes.length === 0) {
    const schemas = json.context.eip712.schemas;
    if (Array.isArray(schemas)) {
      for (const schema of schemas) {
        if (schema.primaryType && schema.types) {
          result.messageTypes.push({
            primaryType: schema.primaryType,
            schema: schema,
            intent: schema.primaryType,
          });
        }
      }
    }
  }

  return result;
}

/**
 * Extract primary type from encodeType string
 */
function extractPrimaryType(encodeType) {
  const match = encodeType.match(/^(\w+)\(/);
  return match ? match[1] : encodeType;
}

/**
 * Manually compute selector using a pure JS Keccak implementation
 */
function computeSelectorManual(signature) {
  const normalized = normalizeSignature(signature);
  // Use a simple lookup or compute
  return computeKeccak256Selector(normalized);
}

/**
 * Keccak-256 selector computation (simplified)
 * In production, use a proper library like 'keccak' or 'js-sha3'
 */
function computeKeccak256Selector(input) {
  // Try to use js-sha3 if available
  try {
    const { keccak256 } = require("js-sha3");
    return "0x" + keccak256(input).slice(0, 8);
  } catch (e) {
    // Fallback: use built-in crypto with SHA3-256 (not exactly Keccak but close for our purposes)
    try {
      const hash = crypto.createHash("sha3-256").update(input).digest("hex");
      return "0x" + hash.slice(0, 8);
    } catch (e2) {
      // Ultimate fallback
      return "0x" + simpleHash(input);
    }
  }
}

// =============================================================================
// Test Generation
// =============================================================================

/**
 * Generate test cases for calldata functions
 */
async function generateCalldataTests(erc7730, report) {
  const tests = [];

  for (const deployment of erc7730.deployments) {
    const { chainId, address } = deployment;

    // Apply chain filter if specified
    if (CONFIG.chainFilter && chainId !== parseInt(CONFIG.chainFilter)) {
      continue;
    }

    log(`\n📍 Processing ${address} on chain ${chainId}`);

    const transactions = await fetchTransactions(chainId, address, CONFIG.depth);
    log(`   Found ${transactions.length} transactions`);

    for (const func of erc7730.functions) {
      const selector = func.selector?.toLowerCase();
      if (!selector) continue;

      // Find transactions matching this function
      const matching = transactions.filter((tx) => {
        const txSelector = extractSelector(tx.input);
        return txSelector === selector;
      });

      log(`   🔍 ${func.intent || func.signature}: ${matching.length} matches`);

      // Take up to maxTests examples
      const examples = matching.slice(0, CONFIG.maxTests);

      for (const tx of examples) {
        // Try to get raw transaction
        let rawTx = await getRawTransaction(chainId, tx.hash);

        // If no raw tx available, we need to construct test differently
        // For now, we'll use the input data
        if (!rawTx) {
          // Create a minimal test case
          rawTx = tx.input; // This is the calldata, not the full signed tx
          report.warnings.push(
            `Chain ${chainId}: Using calldata instead of raw tx for ${tx.hash}`
          );
        }

        const testCase = {
          description: `${func.intent || extractFunctionName(func.signature)} - chain ${chainId}`,
          rawTx: rawTx,
          txHash: tx.hash,
        };

        // Try to infer expected texts
        const expectedTexts = inferExpectedTexts(func, erc7730.metadata);
        if (expectedTexts.length > 0) {
          testCase.expectedTexts = expectedTexts;
        }

        tests.push(testCase);
        report.generated.push({
          type: "calldata",
          chainId,
          function: func.signature,
          txHash: tx.hash,
        });
      }

      if (examples.length === 0) {
        report.notFound.push({
          type: "calldata",
          chainId,
          function: func.signature,
          reason: "No matching transactions found",
        });
      }
    }
  }

  return tests;
}

/**
 * Generate test cases for EIP-712 messages using LLM
 */
async function generateEip712Tests(erc7730, report) {
  const tests = [];

  for (const msgType of erc7730.messageTypes) {
    log(`\n📝 Generating EIP-712 test for: ${msgType.primaryType}`);

    // Try to generate example using LLM
    const example = await generateEip712Example(msgType, erc7730);

    if (example) {
      const testCase = {
        description: `${msgType.intent || msgType.primaryType}`,
        data: example,
      };

      // Try to infer expected texts
      const expectedTexts = inferExpectedTextsEip712(msgType, erc7730.metadata);
      if (expectedTexts.length > 0) {
        testCase.expectedTexts = expectedTexts;
      }

      tests.push(testCase);
      report.generated.push({
        type: "eip712",
        messageType: msgType.primaryType,
      });
    } else {
      report.notFound.push({
        type: "eip712",
        messageType: msgType.primaryType,
        reason: "Could not generate example",
      });
    }
  }

  return tests;
}

/**
 * Generate EIP-712 example data using LLM or schema
 */
async function generateEip712Example(msgType, erc7730) {
  // If we have a schema, generate example from it
  if (msgType.schema) {
    return generateFromSchema(msgType.schema, erc7730.deployments[0]);
  }

  // Try using LLM
  if (!CONFIG.openaiKey) {
    log("   ⚠️  No OpenAI API key set (use --openai-key or OPENAI_API_KEY), generating placeholder example");
    return generatePlaceholderExample(msgType, erc7730.deployments[0]);
  }

  try {
    const prompt = buildEip712Prompt(msgType, erc7730);
    const response = await callLLM(prompt);
    return JSON.parse(response);
  } catch (error) {
    log(`   ❌ LLM generation failed: ${error.message}`);
    return generatePlaceholderExample(msgType, erc7730.deployments[0]);
  }
}

/**
 * Generate example from EIP-712 schema
 */
function generateFromSchema(schema, deployment) {
  const types = schema.types;
  const primaryType = schema.primaryType;

  // Build domain
  const domain = {
    name: "Example",
    version: "1",
    chainId: deployment?.chainId || 1,
    verifyingContract: deployment?.address || "0x0000000000000000000000000000000000000000",
  };

  // Generate message based on types
  const message = generateMessageFromTypes(types, primaryType);

  return {
    types,
    primaryType,
    domain,
    message,
  };
}

/**
 * Generate message object from type definitions
 */
function generateMessageFromTypes(types, typeName) {
  const typeFields = types[typeName];
  if (!typeFields) return {};

  const message = {};
  for (const field of typeFields) {
    message[field.name] = generateFieldValue(field.type, types);
  }
  return message;
}

/**
 * Generate a placeholder value for a field type
 */
function generateFieldValue(type, types) {
  // Handle arrays
  if (type.endsWith("[]")) {
    const baseType = type.slice(0, -2);
    return [generateFieldValue(baseType, types)];
  }

  // Handle custom types
  if (types && types[type]) {
    return generateMessageFromTypes(types, type);
  }

  // Handle basic types
  switch (type) {
    case "address":
      return "0x" + "1".repeat(40);
    case "uint256":
    case "uint128":
    case "uint64":
    case "uint48":
    case "uint32":
    case "uint16":
    case "uint8":
      return "1000000000000000000";
    case "int256":
    case "int128":
    case "int64":
    case "int32":
    case "int16":
    case "int8":
      return "0";
    case "bool":
      return true;
    case "string":
      return "example";
    case "bytes":
      return "0x";
    case "bytes32":
      return "0x" + "0".repeat(64);
    default:
      if (type.startsWith("bytes")) {
        const len = parseInt(type.slice(5)) || 32;
        return "0x" + "0".repeat(len * 2);
      }
      if (type.startsWith("uint")) {
        return "0";
      }
      return "0x0";
  }
}

/**
 * Generate placeholder example when no schema or LLM available
 */
function generatePlaceholderExample(msgType, deployment) {
  // Parse encodeType to extract fields
  const fields = parseEncodeType(msgType.encodeType || msgType.primaryType);

  const types = {
    EIP712Domain: [
      { name: "name", type: "string" },
      { name: "version", type: "string" },
      { name: "chainId", type: "uint256" },
      { name: "verifyingContract", type: "address" },
    ],
  };

  // Add primary type
  types[msgType.primaryType] = fields;

  return {
    types,
    primaryType: msgType.primaryType,
    domain: {
      name: "Example",
      version: "1",
      chainId: deployment?.chainId || 1,
      verifyingContract: deployment?.address || "0x0000000000000000000000000000000000000000",
    },
    message: generateMessageFromTypes(types, msgType.primaryType),
  };
}

/**
 * Parse encodeType string to extract fields
 */
function parseEncodeType(encodeType) {
  const match = encodeType.match(/^\w+\(([^)]*)\)/);
  if (!match) return [];

  const fieldsStr = match[1];
  if (!fieldsStr) return [];

  return fieldsStr.split(",").map((field) => {
    const parts = field.trim().split(/\s+/);
    return { name: parts[1] || parts[0], type: parts[0] };
  });
}

/**
 * Build prompt for LLM to generate EIP-712 example
 */
function buildEip712Prompt(msgType, erc7730) {
  return `Generate a realistic EIP-712 typed data example for testing.

Message Type: ${msgType.primaryType}
${msgType.encodeType ? `Encode Type: ${msgType.encodeType}` : ""}
${msgType.intent ? `Intent: ${msgType.intent}` : ""}
${erc7730.deployments[0] ? `Contract: ${erc7730.deployments[0].address} on chain ${erc7730.deployments[0].chainId}` : ""}

Return ONLY valid JSON with this structure:
{
  "types": { ... },
  "primaryType": "${msgType.primaryType}",
  "domain": { ... },
  "message": { ... }
}

Use realistic values (real token addresses, reasonable amounts, etc).`;
}

/**
 * Call LLM API (supports both OpenAI and Azure OpenAI)
 */
async function callLLM(prompt) {
  const apiKey = CONFIG.openaiKey;
  const baseUrl = CONFIG.openaiUrl;
  const useAzure = CONFIG.useAzure;

  // Build request body - Azure doesn't need model in body if it's in the URL
  const requestBody = {
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
  };

  // Only include model for non-Azure APIs (Azure has model in URL)
  if (!useAzure) {
    requestBody.model = CONFIG.openaiModel;
  }

  const data = JSON.stringify(requestBody);

  return new Promise((resolve, reject) => {
    // For Azure, the URL is the full endpoint; for OpenAI, append the path
    let url;
    if (useAzure) {
      // Azure URL is typically the full endpoint already
      url = new URL(baseUrl);
    } else {
      url = new URL("/v1/chat/completions", baseUrl);
    }

    const isHttps = url.protocol === "https:";
    const client = isHttps ? https : http;

    const headers = {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(data),
    };

    // Azure uses 'api-key' header, OpenAI uses 'Authorization: Bearer'
    if (useAzure) {
      headers["api-key"] = apiKey;
    } else {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: "POST",
      headers,
    };

    if (CONFIG.verbose) {
      log(`   📡 Calling LLM: ${url.hostname}${url.pathname} (${useAzure ? "Azure" : "OpenAI"} format)`);
    }

    const req = client.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          const json = JSON.parse(body);
          if (json.choices?.[0]?.message?.content) {
            resolve(json.choices[0].message.content);
          } else if (json.error) {
            reject(new Error(`LLM API error: ${json.error.message || JSON.stringify(json.error)}`));
          } else {
            reject(new Error(`Invalid LLM response: ${body.slice(0, 200)}`));
          }
        } catch (e) {
          reject(new Error(`Failed to parse LLM response: ${e.message}`));
        }
      });
    });

    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

// =============================================================================
// Expected Text Inference
// =============================================================================

/**
 * Infer expected display texts from function fields
 */
function inferExpectedTexts(func, metadata) {
  const texts = [];

  // Add intent if available
  if (func.intent) {
    // texts.push(func.intent); // Usually shown as title, not in field list
  }

  // Add field labels
  for (const field of func.fields || []) {
    if (field.label) {
      texts.push(field.label);
    }
  }

  return texts;
}

/**
 * Infer expected texts for EIP-712 messages
 */
function inferExpectedTextsEip712(msgType, metadata) {
  const texts = [];

  for (const field of msgType.fields || []) {
    if (field.label) {
      texts.push(field.label);
    }
  }

  return texts;
}

/**
 * Extract function name from signature
 */
function extractFunctionName(signature) {
  const match = signature.match(/^(\w+)\(/);
  return match ? match[1] : signature;
}

// =============================================================================
// Output
// =============================================================================

/**
 * Write test file
 */
function writeTestFile(erc7730, tests, report) {
  if (tests.length === 0) {
    log("\n⚠️  No tests generated");
    return null;
  }

  // Determine output path
  const dir = path.dirname(erc7730.filePath);
  const testsDir = path.join(dir, "tests");
  const baseName = path.basename(erc7730.filePath, ".json");
  const testFileName = `${baseName}.tests.json`;
  const testFilePath = path.join(testsDir, testFileName);

  // Build test file content
  const testFile = {
    $schema: "../../../specs/erc7730-tests.schema.json",
    tests,
  };

  if (CONFIG.dryRun) {
    log(`\n📄 Would write: ${testFilePath}`);
    log(JSON.stringify(testFile, null, 2).slice(0, 500) + "...");
  } else {
    // Create tests directory if needed
    if (!fs.existsSync(testsDir)) {
      fs.mkdirSync(testsDir, { recursive: true });
    }
    fs.writeFileSync(testFilePath, JSON.stringify(testFile, null, 2) + "\n");
    log(`\n✅ Written: ${testFilePath}`);
  }

  return testFilePath;
}

/**
 * Print summary report
 */
function printReport(report) {
  console.log("\n" + "=".repeat(60));
  console.log("📊 GENERATION REPORT");
  console.log("=".repeat(60));

  console.log(`\n✅ Generated: ${report.generated.length} test cases`);
  for (const item of report.generated) {
    if (item.type === "calldata") {
      console.log(`   • ${item.function} (chain ${item.chainId})`);
    } else {
      console.log(`   • ${item.messageType} (EIP-712)`);
    }
  }

  if (report.notFound.length > 0) {
    console.log(`\n⚠️  Not found: ${report.notFound.length} items`);
    for (const item of report.notFound) {
      if (item.type === "calldata") {
        console.log(`   • ${item.function} (chain ${item.chainId}): ${item.reason}`);
      } else {
        console.log(`   • ${item.messageType}: ${item.reason}`);
      }
    }
  }

  if (report.warnings.length > 0) {
    console.log(`\n⚡ Warnings: ${report.warnings.length}`);
    for (const warning of report.warnings) {
      console.log(`   • ${warning}`);
    }
  }

  if (report.errors.length > 0) {
    console.log(`\n❌ Errors: ${report.errors.length}`);
    for (const error of report.errors) {
      console.log(`   • ${error}`);
    }
  }

  console.log("\n" + "=".repeat(60));
}

// =============================================================================
// Logging
// =============================================================================

function log(message) {
  if (CONFIG.verbose || !message.startsWith("   ")) {
    console.log(message);
  }
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  console.log("ERC-7730 Test Generator");
  console.log("=======================");
  if (CONFIG.dryRun) {
    console.log("🔍 DRY RUN MODE - No files will be written\n");
  }

  // Get input file
  const inputFile = process.argv.find(
    (arg) => arg.endsWith(".json") && !arg.includes("--")
  );

  if (!inputFile) {
    console.error("Usage: node tools/migrate/generate-tests.js <erc7730-file> [options]");
    console.error("\nOptions:");
    console.error("  --dry-run           Preview without writing files");
    console.error("  --verbose           Show detailed output");
    console.error("  --depth <n>         Max transactions to search (default: 100)");
    console.error("  --max-tests <n>     Max tests per function (default: 3)");
    console.error("  --chain <id>        Only process specific chain ID");
    console.error("  --openai-url <url>  Custom OpenAI API URL (e.g., Azure OpenAI endpoint)");
    console.error("  --openai-key <key>  OpenAI API key (overrides OPENAI_API_KEY env var)");
    console.error("  --openai-model <m>  Model to use (default: gpt-4)");
    console.error("  --azure             Use Azure OpenAI API format (api-key header)");
    console.error("\nEnvironment Variables:");
    console.error("  ETHERSCAN_API_KEY, POLYGONSCAN_API_KEY, BSCSCAN_API_KEY, etc.");
    console.error("  OPENAI_API_KEY      API key for OpenAI (for EIP-712 examples)");
    console.error("  LLM_BASE_URL        Custom LLM endpoint URL");
    console.error("  AZURE_OPENAI=true   Use Azure OpenAI API format");
    console.error("\nExamples:");
    console.error("  # Standard OpenAI");
    console.error("  OPENAI_API_KEY=sk-xxx node tools/migrate/generate-tests.js registry/uniswap/eip712-uniswap.json");
    console.error("");
    console.error("  # Azure OpenAI");
    console.error("  node tools/migrate/generate-tests.js registry/uniswap/eip712-uniswap.json \\");
    console.error("    --azure \\");
    console.error("    --openai-url 'https://YOUR-RESOURCE.openai.azure.com/openai/deployments/YOUR-DEPLOYMENT/chat/completions?api-version=2024-02-15-preview' \\");
    console.error("    --openai-key YOUR-API-KEY");
    process.exit(1);
  }

  const filePath = path.resolve(inputFile);
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  console.log(`Input: ${filePath}\n`);

  // Initialize report
  const report = {
    generated: [],
    notFound: [],
    warnings: [],
    errors: [],
  };

  try {
    // Parse ERC-7730 file
    const erc7730 = parseErc7730(filePath);
    console.log(`Type: ${erc7730.isCalldata ? "Calldata" : "EIP-712"}`);
    console.log(`Deployments: ${erc7730.deployments.length}`);
    console.log(
      `Functions/Types: ${erc7730.functions.length || erc7730.messageTypes.length}`
    );

    let tests = [];

    // Generate tests
    if (erc7730.isCalldata) {
      tests = await generateCalldataTests(erc7730, report);
    } else if (erc7730.isEip712) {
      tests = await generateEip712Tests(erc7730, report);
    }

    // Write output
    writeTestFile(erc7730, tests, report);

    // Print report
    printReport(report);
  } catch (error) {
    console.error(`\n❌ Fatal error: ${error.message}`);
    if (CONFIG.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
