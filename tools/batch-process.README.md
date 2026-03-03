# ERC-7730 Batch Processor

Automated batch processing tool for ERC-7730 registry folders. This script streamlines the workflow of migrating schema versions, validating files, generating tests, and creating pull requests.

## Features

- **Schema Migration**: Automatically migrates files from ERC-7730 v1 to v2 schema
- **Validation**: Runs the `erc7730` linter on migrated files
- **Binary Comparison**: Placeholder for comparing generated binary descriptors (pending tooling)
- **Test Generation**: Creates missing test files using transaction data from block explorers
- **PR Automation**: Creates a GitHub PR with all changes and a detailed summary

## Prerequisites

### Required

- **Node.js** (v16 or later)

### Optional (for full functionality)

- **erc7730 Python library** - For linting validation
  ```bash
  pip install erc7730
  # or
  pip install git+https://github.com/LedgerHQ/python-erc7730.git
  ```

- **GitHub CLI** - For PR creation
  ```bash
  # macOS
  brew install gh
  
  # Linux
  sudo apt install gh
  
  # Authenticate
  gh auth login
  ```

- **API Keys** - For test generation (see Environment Variables)

## Installation

```bash
# Install Node.js dependencies
npm install

# Install erc7730 CLI (optional but recommended)
pip install erc7730
```

## Usage

```bash
# Basic usage - process a registry subfolder
node tools/batch-process.js <folder-name>

# Dry run - preview changes without modifying files
node tools/batch-process.js 1inch --dry-run

# Verbose output
node tools/batch-process.js ethena --verbose

# Full path syntax
node tools/batch-process.js registry/morpho

# Skip certain steps
node tools/batch-process.js aave --skip-tests
node tools/batch-process.js uniswap --skip-migration --skip-pr

# Custom PR settings
node tools/batch-process.js kiln --pr-title "Update Kiln descriptors" --pr-branch "feat/kiln-v2"
```

## Options

| Option | Description |
|--------|-------------|
| `--dry-run` | Preview changes without modifying files |
| `--verbose` | Show detailed output for each operation |
| `--skip-tests` | Skip test file generation |
| `--skip-migration` | Skip v1 to v2 schema migration |
| `--skip-lint` | Skip linting validation |
| `--skip-pr` | Skip PR creation (just process files) |
| `--pr-title <title>` | Custom PR title |
| `--pr-branch <name>` | Custom branch name |

## Environment Variables

### For Test Generation

Test generation fetches real transaction data from block explorers:

```bash
# Etherscan V2 API key (supports multiple chains)
export ETHERSCAN_API_KEY=your-api-key

# OpenAI API key (for EIP-712 test generation)
export OPENAI_API_KEY=your-api-key
```

### For PR Creation

```bash
# GitHub token (if not using gh CLI auth)
export GITHUB_TOKEN=your-token
```

You can use the provided env template:

```bash
cp tools/env.example .env
# Edit .env with your keys
source .env
```

## Workflow

The script processes each ERC-7730 file in the target folder:

### 1. Schema Migration

For files using `erc7730-v1.schema.json`:

```
┌─────────────────┐     ┌─────────────────┐
│   v1 Schema     │ ──► │   v2 Schema     │
│   (original)    │     │   (migrated)    │
└─────────────────┘     └─────────────────┘
```

Transformations applied:
- Schema reference updated
- `metadata.contractName` added from `context.$id`
- `metadata.info.legalName` removed
- `context.contract.abi` removed (format keys now human-readable)
- `context.eip712.schemas` removed (format keys now encodeType)
- `required`/`excluded` converted to `visible` modifiers
- `screens` removed
- Null values cleaned

### 2. Validation

After migration:

```
┌─────────────────┐     ┌─────────────────┐
│   Migrated      │ ──► │   erc7730       │
│   File          │     │   lint          │
└─────────────────┘     └─────────────────┘
                              │
                              ▼
                        ┌─────────────────┐
                        │   Binary        │
                        │   Comparison*   │
                        └─────────────────┘
                        
* Placeholder - pending erc7730 calldata command
```

### 3. Test Generation

For files without test files:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Descriptor    │ ──► │   Block         │ ──► │   Test File     │
│   (.json)       │     │   Explorer API  │     │   (.tests.json) │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### 4. PR Creation

When changes are detected:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Create        │ ──► │   Stage &       │ ──► │   Create PR     │
│   Branch        │     │   Commit        │     │   via gh CLI    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Output

### Console Output

```
ERC-7730 Batch Processor
========================
Target: registry/1inch

Found 10 ERC-7730 files to process

============================================================
📦 Processing Files
============================================================

ℹ️ Processing: registry/1inch/eip712-1inch-limit-order.json
  → v1 schema detected, migrating to v2...
  → Linting migrated file...
  → Binary comparison (placeholder)...
  → No test file found, generating tests...

[...]

============================================================
📊 BATCH PROCESSING SUMMARY
============================================================

📁 Files processed: 10

🔄 Migrations:
   Attempted:  3
   Successful: 3
   Skipped:    7

🔍 Linting:
   Passed:  10
   Skipped: 0

🔢 Binary Comparison (placeholder):
   Passed:  0
   Skipped: 10

🧪 Test Generation:
   Attempted:  5
   Successful: 4
   Skipped:    5
   Failed:     1
     - eip712-example.json: No transactions found

📝 Changes:
   Modified files: 3
     - registry/1inch/eip712-1inch-limit-order.json
     - [...]
   New files:      4
     - registry/1inch/tests/calldata-example.tests.json
     - [...]

🔗 PR Created: https://github.com/LedgerHQ/clear-signing-erc7730-registry/pull/123

============================================================
```

### Generated PR

The script creates a PR with:

- **Title**: `[Batch Update] <folder> - schema migration and test generation`
- **Body**: Detailed summary with:
  - List of changes made
  - Modified and new files
  - Validation status table
  - Test plan checklist

## Example Workflow

### Processing a New Protocol

```bash
# 1. Preview what will happen
node tools/batch-process.js newprotocol --dry-run --verbose

# 2. Run the actual processing
source .env  # Load API keys
node tools/batch-process.js newprotocol

# 3. Review the PR
# The script outputs the PR URL
```

### Migrating All v1 Files in a Folder

```bash
# Skip test generation, just migrate
node tools/batch-process.js oldprotocol --skip-tests
```

### Generating Missing Tests Only

```bash
# Skip migration, just generate tests
node tools/batch-process.js protocol --skip-migration
```

## Binary Comparison (Placeholder)

The binary comparison feature is currently a placeholder. When the `erc7730 calldata` command becomes available, this will:

1. Generate binary descriptors for both v1 and v2 versions
2. Compare the outputs byte-by-byte
3. Report any differences

This ensures that the migration doesn't change the semantic meaning of the descriptor.

## Troubleshooting

### "erc7730 CLI not found"

Install the Python library:

```bash
pip install erc7730
# or
pip install git+https://github.com/LedgerHQ/python-erc7730.git
```

### "GitHub CLI (gh) not installed"

Install gh:

```bash
# macOS
brew install gh

# Linux
sudo apt install gh

# Then authenticate
gh auth login
```

### "No tests could be generated"

This usually means:
- No matching transactions found on-chain
- Missing API keys (ETHERSCAN_API_KEY)
- The contract is new with low activity

Try:
```bash
# Increase search depth
node tools/generate-tests.js registry/file.json --depth 500

# Check with verbose output
node tools/batch-process.js folder --verbose
```

### Migration fails

Check the specific error in the output. Common issues:
- Invalid JSON in the source file
- File is not a valid ERC-7730 descriptor

### PR creation fails

Ensure:
1. You have push access to the repository
2. `gh` CLI is authenticated (`gh auth status`)
3. The branch doesn't already exist

## Related Scripts

- [`migrate-v1-to-v2.js`](./migrate-v1-to-v2.README.md) - Single-file migration
- [`generate-tests.js`](./generate-tests.README.md) - Single-file test generation
