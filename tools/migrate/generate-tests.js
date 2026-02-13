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
 *   --dry-run               Preview without writing files
 *   --verbose               Show detailed output
 *   --depth <n>             Max transactions to search (default: 100)
 *   --max-tests <n>         Max tests to generate per function (default: 3)
 *   --chain <id>            Only process specific chain ID
 *   --openai-url <url>      Custom OpenAI API URL (e.g., Azure OpenAI endpoint)
 *   --openai-key <key>      OpenAI API key (overrides OPENAI_API_KEY env var)
 *   --openai-model <model>  Model to use (default: gpt-4)
 *   --azure                 Use Azure OpenAI API format (api-key header)
 *   --no-test               Skip running the clear signing tester after generation
 *   --device <device>       Tester device: flex, stax, nanosp, nanox (default: flex)
 *   --test-log-level <lvl>  Tester log level: none, error, warn, info, debug (default: info)
 *   --no-refine             Skip refining expectedTexts from tester screen output
 *   --local-api             Auto-start a local Flask API server (patched erc7730)
 *   --local-api-port <port> Port for the local API server (default: 5000)
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
const { execSync, spawn } = require("child_process");

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
  runTest: !process.argv.includes("--no-test"),
  testDevice: getArgValue("--device", "flex"),
  testLogLevel: getArgValue("--test-log-level", "info"),
  refine: !process.argv.includes("--no-refine"),
  localApi: process.argv.includes("--local-api"),
  localApiPort: getArgValue("--local-api-port", 5000),
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

// =============================================================================
// Ledger Explorer API
// =============================================================================

/**
 * Maps chainId to Ledger explorer API coin path.
 * API base: https://explorers.api.vault.ledger.com/blockchain/v4/{coin}/
 * No API key required.
 */
const LEDGER_EXPLORER_CHAINS = {
  1: "eth",
  56: "bnb",
  137: "matic",
  43114: "avax",
};

/**
 * Fetch transaction details from Ledger's explorer API.
 * Returns the full transaction object with input data.
 *
 * @param {number} chainId
 * @param {string} txHash
 * @returns {Promise<object|null>} Transaction data or null
 */
async function fetchTransactionFromLedger(chainId, txHash) {
  const coin = LEDGER_EXPLORER_CHAINS[chainId];
  if (!coin) {
    if (CONFIG.verbose) {
      log(`   ⚠️  No Ledger explorer mapping for chainId ${chainId}`);
    }
    return null;
  }

  const url =
    `https://explorers.api.vault.ledger.com/blockchain/v4/${coin}/tx/${txHash}?noinput=false`;

  if (CONFIG.verbose) {
    log(`   📡 Fetching tx details from Ledger explorer (${coin})...`);
  }

  try {
    const response = await httpsGet(url);
    if (response && response.hash) {
      return response;
    }
    return null;
  } catch (error) {
    if (CONFIG.verbose) {
      log(`   ⚠️  Ledger explorer request failed: ${error.message}`);
    }
    return null;
  }
}

// =============================================================================
// RLP Encoding (minimal implementation for unsigned transaction serialization)
// =============================================================================

/**
 * RLP-encode a value. Accepts Buffer/Uint8Array (byte string) or Array (list).
 * @param {Buffer|Uint8Array|Array} input
 * @returns {Buffer}
 */
function rlpEncode(input) {
  if (Array.isArray(input)) {
    // Encode as list: concatenate encoded items, then wrap with list prefix
    const encoded = Buffer.concat(input.map((item) => rlpEncode(item)));
    return Buffer.concat([rlpLength(encoded.length, 0xc0), encoded]);
  }

  // Ensure input is a Buffer
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);

  // Single byte in [0x00, 0x7f]
  if (buf.length === 1 && buf[0] < 0x80) {
    return buf;
  }

  // Short string (0-55 bytes)
  return Buffer.concat([rlpLength(buf.length, 0x80), buf]);
}

/**
 * Encode the RLP length prefix.
 * For lengths <= 55: single byte (offset + length)
 * For lengths > 55: (offset + 55 + byte-length-of-length) || length bytes
 */
function rlpLength(len, offset) {
  if (len <= 55) {
    return Buffer.from([offset + len]);
  }
  const lenBytes = intToBuffer(len);
  return Buffer.concat([Buffer.from([offset + 55 + lenBytes.length]), lenBytes]);
}

/**
 * Convert a non-negative integer to a big-endian Buffer with no leading zeros.
 * 0 returns empty Buffer (RLP encodes 0 as empty byte string).
 */
function intToBuffer(n) {
  if (typeof n === "string") {
    // Handle hex strings
    if (n.startsWith("0x") || n.startsWith("0X")) {
      const hex = n.slice(2);
      if (hex === "" || hex === "0") return Buffer.alloc(0);
      // Ensure even length
      const padded = hex.length % 2 === 0 ? hex : "0" + hex;
      return Buffer.from(padded, "hex");
    }
    // Decimal string
    n = BigInt(n);
  }
  if (typeof n === "number") {
    n = BigInt(n);
  }
  if (n === 0n || n === 0) return Buffer.alloc(0);

  const hex = n.toString(16);
  const padded = hex.length % 2 === 0 ? hex : "0" + hex;
  return Buffer.from(padded, "hex");
}

/**
 * Convert an address string to a 20-byte Buffer.
 */
function addressToBuffer(addr) {
  if (!addr || addr === "0x" || addr === "0x0") return Buffer.alloc(0);
  return Buffer.from(addr.replace("0x", "").padStart(40, "0"), "hex");
}

/**
 * Convert a hex data string to a Buffer.
 */
function hexToBuffer(hex) {
  if (!hex || hex === "0x") return Buffer.alloc(0);
  return Buffer.from(hex.replace("0x", ""), "hex");
}

// =============================================================================
// Unsigned Transaction Serialization
// =============================================================================

/**
 * Build an unsigned raw transaction (RLP-encoded) from Ledger explorer tx data.
 *
 * Supports:
 *   - Type 0 (legacy) with EIP-155 replay protection
 *   - Type 1 (EIP-2930)
 *   - Type 2 (EIP-1559)
 *
 * @param {object} txData - Transaction data from Ledger explorer API
 * @param {number} chainId - Chain ID
 * @returns {string} Hex-encoded unsigned raw transaction (0x-prefixed)
 */
function buildUnsignedRawTx(txData, chainId) {
  const type = txData.transaction_type || 0;
  const nonce = intToBuffer(txData.nonce);
  const gasLimit = intToBuffer(txData.gas);
  const to = addressToBuffer(txData.to);
  const value = intToBuffer(txData.value || "0");
  const data = hexToBuffer(txData.input || "0x");

  if (type === 2) {
    // EIP-1559: 0x02 || RLP([chainId, nonce, maxPriorityFeePerGas, maxFeePerGas,
    //                         gasLimit, to, value, data, accessList])
    const fields = [
      intToBuffer(chainId),
      nonce,
      intToBuffer(txData.max_priority_fee_per_gas || "0"),
      intToBuffer(txData.max_fee_per_gas || "0"),
      gasLimit,
      to,
      value,
      data,
      [], // accessList (empty)
    ];
    const payload = rlpEncode(fields);
    return "0x02" + payload.toString("hex");
  }

  if (type === 1) {
    // EIP-2930: 0x01 || RLP([chainId, nonce, gasPrice, gasLimit, to, value,
    //                         data, accessList])
    const fields = [
      intToBuffer(chainId),
      nonce,
      intToBuffer(txData.gas_price || "0"),
      gasLimit,
      to,
      value,
      data,
      [], // accessList (empty)
    ];
    const payload = rlpEncode(fields);
    return "0x01" + payload.toString("hex");
  }

  // Legacy (type 0) with EIP-155 replay protection:
  // RLP([nonce, gasPrice, gasLimit, to, value, data, chainId, 0, 0])
  const fields = [
    nonce,
    intToBuffer(txData.gas_price || "0"),
    gasLimit,
    to,
    value,
    data,
    intToBuffer(chainId),
    Buffer.alloc(0), // 0
    Buffer.alloc(0), // 0
  ];
  return "0x" + rlpEncode(fields).toString("hex");
}

// =============================================================================
// Raw Transaction Fetching
// =============================================================================

/**
 * Get the unsigned raw transaction for a given tx hash.
 *
 * Strategy:
 *   1. Fetch tx details from Ledger explorer API (no API key needed)
 *   2. Reconstruct the unsigned raw tx via RLP encoding
 *   3. Fallback: try Etherscan eth_getRawTransactionByHash
 *
 * @param {number} chainId
 * @param {string} txHash
 * @returns {Promise<string|null>} Hex-encoded unsigned raw tx, or null
 */
async function getRawTransaction(chainId, txHash) {
  // Strategy 1: Ledger explorer API + RLP reconstruction
  const ledgerTx = await fetchTransactionFromLedger(chainId, txHash);
  if (ledgerTx && ledgerTx.input) {
    try {
      const rawTx = buildUnsignedRawTx(ledgerTx, chainId);
      if (CONFIG.verbose) {
        log(`   ✅ Built unsigned raw tx from Ledger explorer (type ${ledgerTx.transaction_type || 0})`);
      }
      return rawTx;
    } catch (error) {
      if (CONFIG.verbose) {
        log(`   ⚠️  Failed to build raw tx: ${error.message}`);
      }
    }
  }

  // Strategy 2: Etherscan eth_getRawTransactionByHash (returns signed raw tx)
  const provider = PROVIDERS[chainId];
  if (provider) {
    const apiKey = process.env[provider.apiKeyEnv];
    if (apiKey) {
      const url =
        `https://${provider.baseUrl}/v2/api?chainid=${chainId}&module=proxy&action=eth_getRawTransactionByHash` +
        `&txhash=${txHash}&apikey=${apiKey}`;

      try {
        const response = await httpsGet(url);
        if (response.result && response.result.startsWith("0x") && response.result.length > 10) {
          if (CONFIG.verbose) {
            log(`   ✅ Got signed raw tx from Etherscan`);
          }
          return response.result;
        }
      } catch (error) {
        // Fall through
      }
    }
  }

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
 * @param {object} erc7730 - Parsed descriptor
 * @param {object} report - Generation report
 * @param {Set<string>} [coveredFunctions] - Function signatures already covered by existing tests
 */
async function generateCalldataTests(erc7730, report, coveredFunctions = new Set()) {
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

      // Skip functions already covered by existing tests
      if (coveredFunctions.has(func.signature)) {
        log(`   ✔️  ${func.intent || func.signature}: already covered — skipping`);
        continue;
      }

      // Find transactions matching this function
      const matching = transactions.filter((tx) => {
        const txSelector = extractSelector(tx.input);
        return txSelector === selector;
      });

      log(`   🔍 ${func.intent || func.signature}: ${matching.length} matches`);

      // Take up to maxTests examples
      const examples = matching.slice(0, CONFIG.maxTests);

      for (const tx of examples) {
        // Get unsigned raw transaction (Ledger explorer + RLP reconstruction)
        let rawTx = await getRawTransaction(chainId, tx.hash);

        if (!rawTx) {
          // Could not fetch or reconstruct — skip this test case
          report.warnings.push(
            `Chain ${chainId}: Could not build raw tx for ${tx.hash} (no Ledger explorer support and Etherscan fallback failed)`
          );
          continue;
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
 * @param {object} erc7730 - Parsed descriptor
 * @param {object} report - Generation report
 * @param {Set<string>} [coveredMessageTypes] - Primary types already covered by existing tests
 */
async function generateEip712Tests(erc7730, report, coveredMessageTypes = new Set()) {
  const tests = [];

  for (const msgType of erc7730.messageTypes) {
    // Skip message types already covered by existing tests
    if (coveredMessageTypes.has(msgType.primaryType)) {
      log(`\n✔️  ${msgType.primaryType}: already covered — skipping`);
      continue;
    }

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
  const model = CONFIG.openaiModel;
  const requestBody = {
    messages: [{ role: "user", content: prompt }],
  };

  // Only set temperature for models that support it (skip for o-series and gpt-5+)
  const skipTemperature = /^(o[1-9]|gpt-5)/.test(model);
  if (!skipTemperature) {
    requestBody.temperature = 0.7;
  }

  // Only include model for non-Azure APIs (Azure has model in URL)
  if (!useAzure) {
    requestBody.model = CONFIG.openaiModel;
  }

  const data = JSON.stringify(requestBody);

  return new Promise((resolve, reject) => {
    // Build the request URL
    let url;
    if (useAzure) {
      if (baseUrl.includes("/openai/deployments/")) {
        // Full Azure endpoint provided — use as-is
        url = new URL(baseUrl);
      } else {
        // Base URL only — construct the full Azure OpenAI chat completions endpoint
        // using the model name as the deployment name
        const deployment = CONFIG.openaiModel;
        const base = baseUrl.replace(/\/+$/, "");
        url = new URL(
          `${base}/openai/deployments/${deployment}/chat/completions?api-version=2024-02-15-preview`
        );
      }
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
// Existing Test Coverage Detection
// =============================================================================

/**
 * Compute the output test file path for a given descriptor.
 * @param {string} descriptorPath - Absolute path to the ERC-7730 descriptor
 * @returns {string} Absolute path to the corresponding .tests.json file
 */
function getTestFilePath(descriptorPath) {
  const dir = path.dirname(descriptorPath);
  const testsDir = path.join(dir, "tests");
  const baseName = path.basename(descriptorPath, ".json");
  return path.join(testsDir, `${baseName}.tests.json`);
}

/**
 * Load an existing test file and determine which functions / message types
 * are already covered by existing tests.
 *
 * Coverage detection:
 *   - EIP-712: uses `test.data.primaryType` to identify the message type.
 *   - Calldata: searches the raw tx hex for known function selectors.
 *
 * @param {string} testFilePath - Path to the .tests.json file
 * @param {object} erc7730 - Parsed ERC-7730 descriptor (from parseErc7730)
 * @returns {{ existingTests: object[], coveredFunctions: Set<string>, coveredMessageTypes: Set<string> }}
 */
function getExistingTestCoverage(testFilePath, erc7730) {
  const empty = { existingTests: [], coveredFunctions: new Set(), coveredMessageTypes: new Set() };

  if (!fs.existsSync(testFilePath)) return empty;

  let existing;
  try {
    existing = JSON.parse(fs.readFileSync(testFilePath, "utf8"));
  } catch {
    return empty;
  }

  const existingTests = existing.tests || [];
  const coveredFunctions = new Set();
  const coveredMessageTypes = new Set();

  for (const test of existingTests) {
    // EIP-712: identify by primaryType in test data
    if (test.data?.primaryType) {
      coveredMessageTypes.add(test.data.primaryType);
    }

    // Calldata: search rawTx hex for known function selectors
    if (test.rawTx) {
      const rawHex = test.rawTx.toLowerCase();
      for (const func of erc7730.functions || []) {
        if (func.selector) {
          const selectorHex = func.selector.toLowerCase().replace("0x", "");
          if (rawHex.includes(selectorHex)) {
            coveredFunctions.add(func.signature);
          }
        }
      }
    }
  }

  return { existingTests, coveredFunctions, coveredMessageTypes };
}

// =============================================================================
// Output
// =============================================================================

/**
 * Write test file, merging with existing tests.
 * Existing tests are preserved at the beginning, new tests are appended.
 */
function writeTestFile(erc7730, tests, report, existingTests = []) {
  const allTests = [...existingTests, ...tests];

  if (allTests.length === 0) {
    log("\n⚠️  No tests generated");
    return null;
  }

  if (tests.length === 0 && existingTests.length > 0) {
    log("\nℹ️  All functions/messages already covered by existing tests — nothing new to add");
    // Return the existing path so tester can still run on existing tests
    return getTestFilePath(erc7730.filePath);
  }

  const testFilePath = getTestFilePath(erc7730.filePath);
  const testsDir = path.dirname(testFilePath);

  // Build test file content
  const testFile = {
    $schema: "../../../specs/erc7730-tests.schema.json",
    tests: allTests,
  };

  if (CONFIG.dryRun) {
    log(`\n📄 Would write: ${testFilePath}`);
    if (existingTests.length > 0) {
      log(`   Preserving ${existingTests.length} existing test(s), adding ${tests.length} new test(s)`);
    }
    log(JSON.stringify(testFile, null, 2).slice(0, 500) + "...");
  } else {
    // Create tests directory if needed
    if (!fs.existsSync(testsDir)) {
      fs.mkdirSync(testsDir, { recursive: true });
    }
    fs.writeFileSync(testFilePath, JSON.stringify(testFile, null, 2) + "\n");
    if (existingTests.length > 0) {
      log(`\n✅ Written: ${testFilePath} (${existingTests.length} existing + ${tests.length} new)`);
    } else {
      log(`\n✅ Written: ${testFilePath}`);
    }
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
// Local ERC7730 API Server Management
// =============================================================================

/** @type {import("child_process").ChildProcess | null} */
let _localApiProcess = null;

/**
 * Start the local Flask API server in the background.
 * Resolves once the server is accepting HTTP requests on the given port.
 *
 * @param {number} port  Port to run on
 * @returns {Promise<import("child_process").ChildProcess>}
 */
function startLocalApiServer(port) {
  return new Promise((resolve, reject) => {
    const repoRoot = path.resolve(__dirname, "../..");
    const runScript = path.join(repoRoot, "tools", "tester", "run-local-api.sh");

    if (!fs.existsSync(runScript)) {
      reject(new Error(
        `Local API script not found: ${runScript}\n` +
        "  Set up with: cd tools/tester && ./setup.sh"
      ));
      return;
    }

    console.log(`\n🚀 Starting local ERC7730 API server on port ${port}...`);

    const child = spawn("bash", [runScript, String(port)], {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
    });

    _localApiProcess = child;

    // Accumulate stderr/stdout for diagnostics
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      if (CONFIG.verbose) process.stderr.write(chunk);
    });
    child.stdout.on("data", (chunk) => {
      if (CONFIG.verbose) process.stdout.write(chunk);
    });

    child.on("error", (err) => {
      reject(new Error(`Failed to start local API: ${err.message}`));
    });

    child.on("exit", (code) => {
      if (code !== null && code !== 0) {
        reject(new Error(
          `Local API server exited with code ${code}\n${stderr.slice(-500)}`
        ));
      }
    });

    // Poll until the server is accepting connections
    const startTime = Date.now();
    const timeout = 30000; // 30 s
    const poll = setInterval(() => {
      if (Date.now() - startTime > timeout) {
        clearInterval(poll);
        stopLocalApiServer();
        reject(new Error(
          `Local API server did not start within ${timeout / 1000}s\n${stderr.slice(-500)}`
        ));
        return;
      }

      const req = http.get(`http://127.0.0.1:${port}/`, (res) => {
        // Any HTTP response (even 404) means Flask is up
        clearInterval(poll);
        console.log(`✅ Local API server ready on http://127.0.0.1:${port}`);
        resolve(child);
      });
      req.on("error", () => { /* not ready yet, keep polling */ });
      req.end();
    }, 500);
  });
}

/**
 * Stop the local API server if it was started by us.
 */
function stopLocalApiServer() {
  if (_localApiProcess && !_localApiProcess.killed) {
    console.log("\n🛑 Stopping local API server...");
    _localApiProcess.kill("SIGTERM");
    // Give it a moment, then force kill
    setTimeout(() => {
      if (_localApiProcess && !_localApiProcess.killed) {
        _localApiProcess.kill("SIGKILL");
      }
    }, 3000);
    _localApiProcess = null;
  }
}

// Ensure the child process is cleaned up on unexpected exit
process.on("exit", stopLocalApiServer);
process.on("SIGINT", () => { stopLocalApiServer(); process.exit(130); });
process.on("SIGTERM", () => { stopLocalApiServer(); process.exit(143); });

// =============================================================================
// Clear Signing Tester Integration
// =============================================================================

/**
 * Run the clear signing tester on the generated test file.
 * Invokes tools/tester/run-test.sh with the descriptor and test file.
 *
 * @param {string} descriptorPath - Absolute path to the ERC-7730 descriptor
 * @param {string} testFilePath   - Absolute path to the generated .tests.json
 * @returns {{ passed: boolean, logFile: string|null }} test result and log file path
 */
function runTester(descriptorPath, testFilePath) {
  // Resolve the run-test.sh script relative to the repository root
  const repoRoot = path.resolve(__dirname, "../..");
  const runTestScript = path.join(repoRoot, "tools", "tester", "run-test.sh");

  if (!fs.existsSync(runTestScript)) {
    console.log("\n⚠️  Tester script not found at: " + runTestScript);
    console.log("   Skipping test execution. Run setup first: cd tools/tester && ./setup.sh");
    return { passed: false, logFile: null };
  }

  const device = CONFIG.testDevice;
  const logLevel = CONFIG.testLogLevel;

  console.log("\n" + "=".repeat(60));
  console.log("🧪 RUNNING CLEAR SIGNING TESTER");
  console.log("=".repeat(60));
  console.log(`\n   Descriptor: ${descriptorPath}`);
  console.log(`   Test file:  ${testFilePath}`);
  console.log(`   Device:     ${device}`);
  console.log(`   Log level:  ${logLevel}\n`);

  let passed = false;
  try {
    execSync(
      `"${runTestScript}" "${descriptorPath}" "${testFilePath}" "${device}" "${logLevel}"`,
      {
        stdio: "inherit",
        cwd: repoRoot,
        env: { ...process.env },
      }
    );
    console.log("\n✅ Clear signing tests passed!");
    passed = true;
  } catch (error) {
    const exitCode = error.status || 1;
    console.log(`\n❌ Clear signing tests failed (exit code: ${exitCode})`);
  }

  // Find the most recent test output log
  const logsDir = path.join(repoRoot, "tools", "tester", "output", "logs");
  const logFile = findMostRecentFile(logsDir, "test-output-");
  return { passed, logFile };
}

/**
 * Find the most recent file in a directory matching a prefix.
 */
function findMostRecentFile(dir, prefix) {
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir)
    .filter((f) => f.startsWith(prefix))
    .map((f) => ({ name: f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  return files.length > 0 ? path.join(dir, files[0].name) : null;
}

// =============================================================================
// Test Refinement — extract expectedTexts from tester screen output
// =============================================================================

/**
 * Generic UI patterns to filter out from screen texts.
 * These are standard Ledger device chrome, not descriptor-specific content.
 */
const GENERIC_UI_PATTERNS = [
  /^Review transaction/i,
  /^Sign transaction/i,
  /^Transaction signed/i,
  /Swipe to review/i,
  /Hold to sign/i,
  /Reject \d+ of \d+/i,
  /^Ethereum\b.*Quit app/i,
];

/**
 * Parse tester log output to extract per-test screen text blocks.
 *
 * Each "SCREEN TEXT ANALYSIS" section in the log corresponds to one test case
 * (in order). Returns an array of arrays, one per test, each containing the
 * raw screen text strings.
 *
 * @param {string} logContent - Full tester log file content
 * @returns {string[][]} Per-test arrays of screen text strings
 */
function parseTesterScreenTexts(logContent) {
  const allTests = [];
  const sectionRegex = /Accumulated screen texts from device:\n([\s\S]*?)Expected texts from test file:/g;

  let match;
  while ((match = sectionRegex.exec(logContent)) !== null) {
    const block = match[1];
    const texts = [];
    const lineRegex = /\[\d+\]\s+"(.*?)"/g;
    let lineMatch;
    while ((lineMatch = lineRegex.exec(block)) !== null) {
      texts.push(lineMatch[1]);
    }
    allTests.push(texts);
  }

  return allTests;
}

/**
 * Extract refined expectedTexts from screen texts for one test case.
 *
 * Filters out generic UI, identifies the data screen(s) containing
 * "Interaction with", and extracts label + shortened value pairs.
 *
 * @param {string[]} screenTexts - Raw screen texts for one test
 * @param {string[]} descriptorLabels - Field labels from the ERC-7730 descriptor
 * @returns {string[]} Refined expected text strings
 */
function extractExpectedTexts(screenTexts, descriptorLabels) {
  const expectedTexts = [];

  // Find the data screen(s) — those containing "Interaction with"
  for (const text of screenTexts) {
    // Data screen: contains "Interaction with" — check this BEFORE generic UI
    // because data screens also contain generic suffixes like "Reject X of Y"
    if (text.includes("Interaction with")) {
      // Extract "Interaction with {owner}"
      const ownerMatch = text.match(/Interaction with\s+(\S+)/);
      if (ownerMatch) {
        expectedTexts.push(`Interaction with ${ownerMatch[1]}`);
      }

      // Extract label + shortened value for each descriptor label
      for (const label of descriptorLabels) {
        const shortValue = extractShortLabelValue(text, label);
        if (shortValue) {
          expectedTexts.push(shortValue);
        }
      }

      // Check for "Max fees" presence
      if (text.includes("Max fees")) {
        expectedTexts.push("Max fees");
      }
    }
  }

  return expectedTexts;
}

/**
 * Check if a screen text is generic Ledger UI chrome.
 */
function isGenericUI(text) {
  return GENERIC_UI_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Extract a label + shortened value from a data screen text.
 *
 * Finds the label in the text, then captures the value that follows.
 * Returns "Label shortvalue" or null if not found.
 *
 * For numeric/token values: first ~8 significant characters
 * For address values (0x...): first ~10 hex characters
 *
 * @param {string} text - Full data screen text
 * @param {string} label - Field label to search for
 * @returns {string|null}
 */
function extractShortLabelValue(text, label) {
  const idx = text.indexOf(label);
  if (idx === -1) return null;

  // Get the text after the label
  const afterLabel = text.slice(idx + label.length).trimStart();

  // Known delimiters that mark the end of a value: next label, "Max fees", "Reject"
  // We grab a reasonable chunk and truncate
  const valuePortion = afterLabel.split(/\s+(?:Max fees|Reject\s+\d)/).shift() || "";

  if (!valuePortion.trim()) return label;

  // Remove device line-break artifacts: join tokens back, then shorten
  const tokens = valuePortion.trim().split(/\s+/);

  // Detect address value (starts with 0x)
  if (tokens[0] && tokens[0].startsWith("0x")) {
    // Rejoin hex fragments that were split by line breaks
    const fullHex = tokens.join("");
    // Keep "0x" + first 8 hex chars
    const shortAddr = fullHex.slice(0, 10);
    return `${label} ${shortAddr}`;
  }

  // Detect numeric value (starts with digit or decimal point)
  if (tokens[0] && /^[\d.]/.test(tokens[0])) {
    // Rejoin numeric fragments (line breaks can split "65500.978878409520 354251")
    // Take just the first token which has the significant start
    const numStr = tokens[0];
    // Find decimal point position for truncation
    const dotIdx = numStr.indexOf(".");
    if (dotIdx !== -1) {
      // Keep up to 2 decimal places
      const short = numStr.slice(0, dotIdx + 3);
      return `${label} ${short}`;
    }
    // Integer: take first 8 chars
    return `${label} ${numStr.slice(0, 8)}`;
  }

  // Fallback: just label + first token (shortened)
  return `${label} ${tokens[0].slice(0, 10)}`;
}

/**
 * Refine the expectedTexts in a test file using actual tester screen output.
 *
 * @param {string} testFilePath - Path to the .tests.json file
 * @param {string} logFile      - Path to the tester output log
 * @param {object} erc7730      - Parsed ERC-7730 descriptor
 * @returns {boolean} true if refinement was applied
 */
function refineTestFile(testFilePath, logFile, erc7730) {
  const logContent = fs.readFileSync(logFile, "utf8");
  const perTestScreens = parseTesterScreenTexts(logContent);

  if (perTestScreens.length === 0) {
    console.log("   ⚠️  No screen text analysis found in tester log");
    return false;
  }

  const testFile = JSON.parse(fs.readFileSync(testFilePath, "utf8"));
  const tests = testFile.tests;

  if (perTestScreens.length !== tests.length) {
    console.log(
      `   ⚠️  Screen text count (${perTestScreens.length}) doesn't match test count (${tests.length}), skipping refinement`
    );
    return false;
  }

  // Build a map from descriptor labels per function/intent
  const labelsByIntent = buildLabelsByIntent(erc7730);

  let refined = 0;
  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    const screenTexts = perTestScreens[i];

    // Determine which labels apply to this test based on its description
    const labels = findLabelsForTest(test, labelsByIntent, erc7730);

    const newExpectedTexts = extractExpectedTexts(screenTexts, labels);

    if (newExpectedTexts.length > 0) {
      test.expectedTexts = newExpectedTexts;
      refined++;
    }
  }

  if (refined > 0) {
    fs.writeFileSync(testFilePath, JSON.stringify(testFile, null, 2) + "\n");
    console.log(`   ✅ Refined expectedTexts for ${refined}/${tests.length} test cases`);
  }

  return refined > 0;
}

/**
 * Build a mapping from intent/function name to field labels from the descriptor.
 */
function buildLabelsByIntent(erc7730) {
  const map = {};

  // Calldata functions
  for (const func of erc7730.functions || []) {
    const intent = func.intent || extractFunctionName(func.signature);
    const labels = (func.fields || [])
      .map((f) => f.label)
      .filter(Boolean);
    map[intent] = labels;
    // Also index by function name
    const funcName = extractFunctionName(func.signature);
    if (funcName !== intent) {
      map[funcName] = labels;
    }
  }

  // EIP-712 message types
  for (const msgType of erc7730.messageTypes || []) {
    const intent = msgType.intent || msgType.primaryType;
    const labels = (msgType.fields || [])
      .map((f) => f.label)
      .filter(Boolean);
    map[intent] = labels;
  }

  return map;
}

/**
 * Find the descriptor labels that apply to a given test case.
 * Matches test description against known intents/function names.
 */
function findLabelsForTest(test, labelsByIntent, erc7730) {
  const desc = test.description || "";

  // Try to match the test description against known intents
  for (const [intent, labels] of Object.entries(labelsByIntent)) {
    if (desc.includes(intent)) {
      return labels;
    }
  }

  // Fallback: return all labels from the descriptor
  const allLabels = [];
  for (const func of erc7730.functions || []) {
    for (const f of func.fields || []) {
      if (f.label) allLabels.push(f.label);
    }
  }
  for (const msgType of erc7730.messageTypes || []) {
    for (const f of msgType.fields || []) {
      if (f.label) allLabels.push(f.label);
    }
  }
  return [...new Set(allLabels)];
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
    console.error("  --dry-run                Preview without writing files");
    console.error("  --verbose                Show detailed output");
    console.error("  --depth <n>              Max transactions to search (default: 100)");
    console.error("  --max-tests <n>          Max tests per function (default: 3)");
    console.error("  --chain <id>             Only process specific chain ID");
    console.error("  --openai-url <url>       Custom OpenAI API URL (e.g., Azure OpenAI endpoint)");
    console.error("  --openai-key <key>       OpenAI API key (overrides OPENAI_API_KEY env var)");
    console.error("  --openai-model <m>       Model to use (default: gpt-4)");
    console.error("  --azure                  Use Azure OpenAI API format (api-key header)");
    console.error("  --no-test                Skip running the clear signing tester (on by default)");
    console.error("  --device <device>        Tester device: flex, stax, nanosp, nanox (default: flex)");
    console.error("  --test-log-level <lvl>   Tester log level: none, error, warn, info, debug (default: info)");
    console.error("  --no-refine              Skip refining expectedTexts from tester screen output");
    console.error("  --local-api              Auto-start local Flask API server (patched erc7730)");
    console.error("  --local-api-port <port>  Port for the local API server (default: 5000)");
    console.error("\nEnvironment Variables:");
    console.error("  ETHERSCAN_API_KEY, POLYGONSCAN_API_KEY, BSCSCAN_API_KEY, etc.");
    console.error("  OPENAI_API_KEY      API key for OpenAI (for EIP-712 examples)");
    console.error("  LLM_BASE_URL        Custom LLM endpoint URL");
    console.error("  AZURE_OPENAI=true   Use Azure OpenAI API format");
    console.error("  GATING_TOKEN        Required for tester (Ledger auth token)");
    console.error("\nExamples:");
    console.error("  # Standard OpenAI");
    console.error("  OPENAI_API_KEY=sk-xxx node tools/migrate/generate-tests.js registry/uniswap/eip712-uniswap.json");
    console.error("");
    console.error("  # Azure OpenAI");
    console.error("  node tools/migrate/generate-tests.js registry/uniswap/eip712-uniswap.json \\");
    console.error("    --azure \\");
    console.error("    --openai-url 'https://YOUR-RESOURCE.openai.azure.com/openai/deployments/YOUR-DEPLOYMENT/chat/completions?api-version=2024-02-15-preview' \\");
    console.error("    --openai-key YOUR-API-KEY");
    console.error("");
    console.error("  # Generate tests and run on Ledger Stax");
    console.error("  node tools/migrate/generate-tests.js registry/ethena/calldata-ethena.json --device stax");
    console.error("");
    console.error("  # Generate tests without running the tester");
    console.error("  node tools/migrate/generate-tests.js registry/ethena/calldata-ethena.json --no-test");
    process.exit(1);
  }

  const filePath = path.resolve(inputFile);
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  // Only generate tests for leaf descriptors (calldata-* / eip712-* files).
  // Non-leaf files (e.g. common-*) are shared includes that cannot be tested standalone.
  const baseName = path.basename(filePath);
  if (!baseName.startsWith("calldata") && !baseName.startsWith("eip712")) {
    console.log(`⚠️  Skipping non-leaf file: ${baseName}`);
    console.log("   Tests can only be generated for leaf descriptors (calldata-* / eip712-* files).");
    return;
  }

  console.log(`Input: ${filePath}\n`);

  // Start local API server if requested
  if (CONFIG.localApi) {
    try {
      await startLocalApiServer(CONFIG.localApiPort);
      // Set env var so the tester subprocess (run-test.sh) uses the local server
      process.env.ERC7730_API_URL = `http://127.0.0.1:${CONFIG.localApiPort}`;
      console.log(`   ERC7730_API_URL set to ${process.env.ERC7730_API_URL}\n`);
    } catch (err) {
      console.error(`\n❌ Could not start local API server: ${err.message}`);
      process.exit(1);
    }
  }

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

    // Check for existing tests and determine coverage
    const testFileTarget = getTestFilePath(filePath);
    const { existingTests, coveredFunctions, coveredMessageTypes } =
      getExistingTestCoverage(testFileTarget, erc7730);

    if (existingTests.length > 0) {
      console.log(`Existing tests: ${existingTests.length}`);
      if (coveredFunctions.size > 0) {
        console.log(`Covered functions: ${[...coveredFunctions].join(", ")}`);
      }
      if (coveredMessageTypes.size > 0) {
        console.log(`Covered message types: ${[...coveredMessageTypes].join(", ")}`);
      }
    }

    let tests = [];

    // Generate tests only for uncovered functions/message types
    if (erc7730.isCalldata) {
      tests = await generateCalldataTests(erc7730, report, coveredFunctions);
    } else if (erc7730.isEip712) {
      tests = await generateEip712Tests(erc7730, report, coveredMessageTypes);
    }

    // Write output (merge existing + new)
    const testFilePath = writeTestFile(erc7730, tests, report, existingTests);

    // Print report
    printReport(report);

    // Run clear signing tester if enabled and tests were written
    if (CONFIG.runTest && !CONFIG.dryRun && testFilePath) {
      const { passed, logFile } = runTester(filePath, testFilePath);
      if (!passed) {
        process.exitCode = 1;
      }

      // Refine expectedTexts from tester screen output
      if (CONFIG.refine && logFile) {
        console.log("\n" + "=".repeat(60));
        console.log("🔍 REFINING expectedTexts FROM TESTER OUTPUT");
        console.log("=".repeat(60));
        console.log(`\n   Log file: ${logFile}`);
        try {
          refineTestFile(testFilePath, logFile, erc7730);
        } catch (err) {
          console.log(`   ⚠️  Refinement failed: ${err.message}`);
          if (CONFIG.verbose) console.error(err.stack);
        }
      } else if (!CONFIG.refine) {
        console.log("\nℹ️  Refinement skipped (--no-refine)");
      }
    } else if (!CONFIG.runTest) {
      console.log("\nℹ️  Tester skipped (--no-test)");
    }
  } catch (error) {
    console.error(`\n❌ Fatal error: ${error.message}`);
    if (CONFIG.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    // Clean up local API server if we started one
    stopLocalApiServer();
  }
}

main();
