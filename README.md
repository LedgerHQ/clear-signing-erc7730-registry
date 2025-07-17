# ERC-7730 (Clear Signing Metadata) Registry

The objective of ERC-7730 is to establish a standardized method for clear signing contracts and messages on EVM chains, by offering metadata formatting that complements ABIs and message types. To learn more about the ERC-7730 standard, visit [Ledger Developer Portal](https://developers.ledger.com/docs/clear-signing/erc7730).

This repository maintains records of past and current metadata files in the `registry` directory.

## Registry structure

```
README.md                                    # top-level README file with submission process
specs/
  erc-7730.md                                # most advanced version of the spec but reference should be the ERC
  erc7730-v1.schema.json                     # the json schema of the latest version of the extension
registry/
  $entity_name/                              # official entity name submitting metadata information
    calldata-$contractName1.json             # metadata for contract $contractName1, including the contract version in name
    calldata-$contractName2.json
    eip712-$messageName.json                 # metadata for EIP712 message $messageName
    common-$sharedDefinition.json            # common definitions shared between descriptors (without prefix)
    tests/
       calldata-$contractName1/
         sample_tx1.hex                      # sample tx1, format to be specified
         sample_tx2.hex                      # sample tx2, format to be specified
       calldata-$contractName2/
          ...
       eip712-$messageName/
          sample_message1.json               # Sample eip 712 message in json format
ercs/
  erc20.json                                 # standard ERC token metadata files
  erc721.json
  erc4626.json
  ...
```

## Submission Process

- Submit the files through a pull request to this registry repository, following the requirements below.
- After your PR is accepted, the submitted files are automatically imported in the Ledger Cryptoassets list, which allows users to clear sign.

## Pull Request content requirements

- The PR is submitted by a user whose email matches the entity's name.
- Each PR modifies **only one entity**, meaning it affects only one sub-folder within the top-level `registry` directory.
- Each entity folder includes **at least one file that is compatible with ERC-7730**, located at the root of the entity's folder.
- All ERC-7730 compatible files are prefixed with either `calldata` for smart contracts or `eip712` for EIP-712 messages.
- All ERC-7730 compatible files are correctly validated against the schema file located at `specs/erc7730-v1.schema.json`.
- Do not use the `calldata` or `eip712` prefixes for common files which are included by the ERC-7730 files and placed at the top level of the entity folder.

## How to validate

The `erc7730` Python package is available for validating and formatting ERC-7730 descriptors:

```bash
# Install the erc7730 package (requires Python 3.12+)
pip install erc7730

# Validate all descriptors
erc7730 lint registry/**/eip712-*.json registry/**/calldata-*.json

# Validate a specific file
erc7730 lint registry/entity/calldata-Contract.json

# Format all descriptors
erc7730 format

# Generate a new descriptor from Etherscan
erc7730 generate --address 0xContractAddress --chain-id 1 --owner "Entity Name" --url "https://entity.url"
```

For more information about the ERC-7730 tools, visit the [erc7730 package on PyPI](https://pypi.org/project/erc7730/).
