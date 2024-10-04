# ERC-7730 (Clear Signing Metadata) Registry

The objective of ERC-7730 is to establish a standardized method for clear signing contracts and messages on EVM chains, by offering metadata formatting that complements ABIs and message types. To learn more about the ERC-7730 standard, visit [Ledger Developer Portal](https://developers.ledger.com/docs/clear-signing/eip7730).

This repository maintains records of past and current metadata files in the `registry` directory.

## Registry structure

```
README.md                                    # top-level README file with submission process and how to use the simulation tool
specs/
  erc7730.md                                 # most advanced version of the spec but reference should be the ERC
  eip7730.schema.json                        # the json schema of the latest version of the extension
registry/
  $entity_name/                              # official entity name submitting metadata information
    calldata_$contractName1.json             # metadata for contract $contractName1, including the contract version in name
    calldata_$contractName2.json
    eip712_$messageName.json                 # metadata for EIP712 message $messageName
    tests/
       README.md                             # How to test uniswap specific contracts and messages
       config.json                           # edition tool configuration file
       calldata_$contractName1/
         sample_tx1.hex                      # sample tx1, format to be specified
         sample_tx2.hex                      # sample tx2, format to be specified
       calldata_$contractName2/
          ...
       eip712_$messageName/
          sample_message1.json               # Sample eip 712 message in json format
```

## Submission Process

- Submit the files through a pull request to this registry repository, following the requirements below.
- After your PR is accepted, the submitted files are automatically imported in the Ledger Cryptoassets list, which allows users to clear sign.

## Pull Request content requirements

- The PR is submitted by a user whose email matches the entity's name.
- Each PR modifies **only one entity**, meaning it affects only one sub-folder within the top-level `registry` directory.
- Each entity folder includes **at least one file that is compatible with EIP-7730**, located at the root of the entity's folder.
- All EIP-7730 compatible files are prefixed with either `calldata` for smart contracts or `eip712` for EIP-712 messages.
- All EIP-7730 compatible files are correctly validated against the schema file located at `specs/eip7730.schema.json`.
- Do not use the `calldata` or `eip712` prefixes for common files which are included by the EIP-7730 files and placed at the top level of the entity folder.

## How to test

- Inside the [developer-preview](/developer-preview) directory you'll find a [README](/developer-preview#readme) for a Node web application. It runs at localhost:3000 and can be used to preview the results of your clear signing metadata files.
