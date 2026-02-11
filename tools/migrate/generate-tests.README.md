# ERC-7730 Test Generator

Automatically generates test files for ERC-7730 clear signing descriptors by fetching real transaction examples from block explorers and generating EIP-712 message samples.

## Features

- **Calldata Tests**: Fetches real transactions from Etherscan-compatible APIs
- **EIP-712 Tests**: Generates examples from schemas or uses LLM
- **Multi-chain Support**: Works with Ethereum, Polygon, BSC, Arbitrum, Optimism, Base, Avalanche
- **Extensible Providers**: Easy to add new block explorer APIs
- **Expected Values Inference**: Attempts to infer display labels from the descriptor

## Installation

```bash
# Install optional dependency for proper function selector computation
npm install js-sha3

# Or use yarn
yarn add js-sha3
```

## Usage

```bash
# Basic usage
node tools/migrate/generate-tests.js <erc7730-file>

# Dry run (preview without writing)
node tools/migrate/generate-tests.js registry/1inch/calldata-AggregationRouterV3.json --dry-run

# Verbose output
node tools/migrate/generate-tests.js registry/ethena/calldata-ethena.json --verbose

# Limit search depth and tests
node tools/migrate/generate-tests.js registry/aave/calldata-lpv3.json --depth 50 --max-tests 2

# Process only specific chain
node tools/migrate/generate-tests.js registry/1inch/calldata-AggregationRouterV3.json --chain 1
```

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `--dry-run` | false | Preview changes without writing files |
| `--verbose` | false | Show detailed output |
| `--depth <n>` | 100 | Maximum transactions to search |
| `--max-tests <n>` | 3 | Maximum tests to generate per function |
| `--chain <id>` | all | Only process specific chain ID |
| `--openai-url <url>` | api.openai.com | Custom OpenAI API URL (e.g., Azure endpoint) |
| `--openai-key <key>` | OPENAI_API_KEY env | OpenAI API key |
| `--openai-model <model>` | gpt-4 | Model to use for generation |
| `--azure` | false | Use Azure OpenAI API format (api-key header) |

## Environment Variables

API keys should be provided via environment variables. **Do not commit API keys to git.**

### Block Explorer APIs

The script uses the unified Etherscan V2 API which supports multiple chains with a single API key.

| Variable | Provider | Supported Chains |
|----------|----------|------------------|
| `ETHERSCAN_API_KEY` | Etherscan V2 API | 1 (Ethereum), 56 (BSC), 137 (Polygon), 42161 (Arbitrum), 10 (Optimism), 8453 (Base), 43114 (Avalanche) |

### LLM Integration (for EIP-712)

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | OpenAI API key for generating EIP-712 examples |
| `LLM_BASE_URL` | Custom LLM endpoint (default: https://api.openai.com) |
| `AZURE_OPENAI` | Set to `true` to use Azure OpenAI API format |

### Setting Up Environment Variables

**Option 1: Using the env template (recommended)**

```bash
# Copy the template to .env in the project root
cp tools/migrate/env.example .env

# Edit .env and add your API keys
nano .env  # or use your preferred editor

# Source the file before running
source .env && node tools/migrate/generate-tests.js registry/file.json
```

**Option 2: Using dotenv package**

```bash
# Install dotenv
npm install dotenv

# Create .env file from template
cp tools/migrate/env.example .env
# Edit .env with your keys...

# Run with dotenv preloading
node -r dotenv/config tools/migrate/generate-tests.js registry/file.json
```

**Option 3: Inline environment variables**

```bash
ETHERSCAN_API_KEY="your-key" node tools/migrate/generate-tests.js registry/file.json
```

**Option 4: Export in your shell**

```bash
export ETHERSCAN_API_KEY="your-api-key-here"
export OPENAI_API_KEY="your-openai-key"
node tools/migrate/generate-tests.js registry/file.json
```

> ⚠️ **Important**: The `.env` file is in `.gitignore` - never commit files containing real API keys!

### Using Azure OpenAI

Azure OpenAI uses a different authentication format (`api-key` header instead of `Bearer` token) and the model is specified in the URL rather than the request body.

```bash
# Using CLI arguments
node tools/migrate/generate-tests.js registry/uniswap/eip712-uniswap.json \
  --azure \
  --openai-url "https://YOUR-RESOURCE.openai.azure.com/openai/deployments/YOUR-DEPLOYMENT/chat/completions?api-version=2024-02-15-preview" \
  --openai-key "YOUR-AZURE-API-KEY"

# Using environment variables
export AZURE_OPENAI=true
export LLM_BASE_URL="https://YOUR-RESOURCE.openai.azure.com/openai/deployments/YOUR-DEPLOYMENT/chat/completions?api-version=2024-02-15-preview"
export OPENAI_API_KEY="YOUR-AZURE-API-KEY"
node tools/migrate/generate-tests.js registry/uniswap/eip712-uniswap.json
```

**Note**: For Azure, the `--openai-url` should be the full deployment URL including the API version query parameter.

## Output

The script generates test files in a `tests/` subdirectory next to the input file:

```
registry/
├── ethena/
│   ├── calldata-ethena.json          # Input descriptor
│   └── tests/
│       └── calldata-ethena.tests.json # Generated test file
```

### Test File Format

```json
{
  "$schema": "../../../specs/erc7730-tests.schema.json",
  "tests": [
    {
      "description": "Cooldown Shares - chain 1",
      "rawTx": "0x...",
      "txHash": "0x...",
      "expectedTexts": ["Amount"]
    }
  ]
}
```

## How It Works

### For Calldata (Contract Calls)

1. Parses the ERC-7730 file to extract:
   - Deployment addresses and chain IDs
   - Function signatures from `display.formats` keys

2. For each deployment:
   - Queries the appropriate block explorer API
   - Fetches recent transactions to the contract address
   - Filters by function selector

3. For each matching transaction:
   - Retrieves the raw transaction data
   - Creates a test case with the transaction hash

### For EIP-712 Messages

1. Parses the ERC-7730 file to extract:
   - Message type definitions from schemas or encodeType keys
   - Deployment information for domain construction

2. Generates example messages using:
   - Schema definitions (if available in v1 format)
   - LLM generation (if `OPENAI_API_KEY` is set)
   - Placeholder generation (fallback)

3. Creates test cases with properly structured EIP-712 data

## Extending Providers

To add support for a new block explorer, add an entry to the `PROVIDERS` object in the script:

```javascript
const PROVIDERS = {
  // ... existing providers
  12345: {  // Chain ID
    name: "NewExplorer",
    baseUrl: "api.newexplorer.io",
    apiKeyEnv: "NEWEXPLORER_API_KEY",
    explorerUrl: "https://newexplorer.io/tx/",
  },
};
```

The provider must implement the Etherscan-compatible API format.

## Limitations

- **Raw Transaction Data**: Some block explorers don't provide signed raw transactions via API. In these cases, the script uses calldata instead and logs a warning.
- **EIP-712 Messages**: Since typed data signatures are off-chain, real examples must be generated rather than fetched.
- **Rate Limits**: Block explorer APIs have rate limits. Use `--depth` to limit requests.
- **Function Selectors**: Proper selector computation requires the `js-sha3` package for Keccak-256.

## Example Run

```bash
$ ETHERSCAN_API_KEY="your-api-key" \
  node tools/migrate/generate-tests.js registry/ethena/calldata-ethena.json --dry-run --verbose

ERC-7730 Test Generator
=======================
🔍 DRY RUN MODE - No files will be written

Input: /path/to/registry/ethena/calldata-ethena.json

Type: Calldata
Deployments: 1
Functions/Types: 3

📍 Processing 0x9D39A5DE30e57443BfF2A8307A4256c8797A3497 on chain 1
  📡 Fetching from Etherscan (chain 1)...
   Found 100 transactions
   🔍 Cooldown Shares: 19 matches
   🔍 Cooldown Assets: 0 matches
   🔍 Unstake: 10 matches

📄 Would write: /path/to/registry/ethena/tests/calldata-ethena.tests.json
{
  "$schema": "../../../specs/erc7730-tests.schema.json",
  "tests": [
    {
      "description": "Cooldown Shares - chain 1",
      "rawTx": "0x9343d9e1...",
      "txHash": "0x2ccc6161...",
      "expectedTexts": ["Amount"]
    },
    ...
  ]
}

============================================================
📊 GENERATION REPORT
============================================================

✅ Generated: 6 test cases
   • cooldownShares(uint256) (chain 1)
   • unstake(address) (chain 1)

⚠️  Not found: 1 items
   • cooldownAssets(uint256) (chain 1): No matching transactions found

⚡ Warnings: 6
   • Chain 1: Using calldata instead of raw tx for 0x2ccc6161...

============================================================
```

## Troubleshooting

### "No provider configured for chainId X"

Add the chain's block explorer to the `PROVIDERS` configuration.

### "Missing API key: ETHERSCAN_API_KEY"

Set the environment variable before running the script.

### "No matching transactions found"

- The contract may be new or have low activity
- Try increasing `--depth`
- Verify the function signature matches actual on-chain calls

### Function selector mismatch

Install `js-sha3` for accurate Keccak-256 computation:
```bash
npm install js-sha3
```
