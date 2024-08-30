# ERC 7730 (Clear Signing Metadata) Registry

The goal of ERC 7730 is to standardize how to clear sign contracts and messages on EVM chains, by providing formatting metadata complementing ABIs amd message types. 

This repository tracks past and ongoing metadata files in the `registry` folder.

## Registry structure

```
README.md                                    # top-level README file with submission process and how to use the simulation tool
specs/
  erc7730.md                                 # most advanced version of the spec but reference should be the ERC
  eip7730.schema.json                        # the json schema of the latest version of the extension 
registry/
  $entity_name/                              # official entity name submitting metadata information
    calldata_$contractName1.json             # metadata for contract $contractName1, typically including the contract version in name
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

- Submit files though a PR on this registry repository
- A PR should only touch one entity, ie one sub-folder of the top-level `registry`
- It should contain at least one eip 7730 compatible file at the root of the entity folder.
- All eip 7730 files should be prefixed with `calldata` or `eip712` based on what structure they describe
- All eip 7730 files should be correctly validated against the schema file in `specs/eip7730.schema.json`
- It is possible to put common files (files included by the eip 7730 files) at the top level of the entity folder, they should NOT use a common prefix (`calldata` or `eip712`) 

## How to test

TODO: How to use tool to visualize end result of applying metadata to Tx and messages
