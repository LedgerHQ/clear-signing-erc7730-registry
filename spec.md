---
title: Structured Data Clear Signing Format
description: Draft specification of a json format providing additional
  description of how to clear-sign smartcontract calls and EIP712 messages on
  wallets
author: Laurent Castillo(@lcastillo-ledger)
discussions-to: https://github.com/LedgerHQ/clear-signing-format-spec/issues
status: Draft
type: Standards Track
category: Interface
created: 2024-02-07
requires: 20, 712 
---

## Abstract

This specification defines a JSON format carrying additional information required to correctly display structured data to a human for review on a wallet screen, before signature by the wallet. In the current scope, structured data supported are smart contract calls in EVM transactions and EIP 712 structured messages. 

## Motivation

Properly validating a transaction on a Hardware Wallets screen (also known as Clear Signing) is a key element of good security practices for end users when interacting with any Blockchain. Unfortunately, most data to sign, even enriched with the data structure description (ABI or EIP712 types) are not self-sufficient in term of correctly displaying them to the user for review. Among other things:

* Function name or main message type is often a convoluted name and does not translate to a clear intent for the user
* Fields in the data to sign are tied to primitive types only, but those can be displayed many different ways. For instance, integers can be displayed as percentages, dates, etc...
* Some fields require additional metadata to by displayed correctly, for instance token amounts requires knowledge of the magnitude and the ticker, as well as where to find the token address itself to be correctly formatted.

This specification intends to provide a simple, open standard format to provide wallets with the additional information required to properly format a structured data to sign for review by users.

Providing this additional formatting information requires deep knowledge of the way a smartcontract or message is going to be used, it is expected that DApps developers will be the best placed to write such a file. The intent of an open standard is to write this file only once and have it work with most wallets supporting this standard.

> Deployment model options:
> - In each dapps repository (discoverability?)
> - Foundation operated repository
> - Ledger repository

## Specification

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in RFC 2119 and RFC 8174.

### Simple example

The following is a simple example of how to clear sign a `transfer` function call on an ERC20 contract.

```json
{
    "$schema": "https://github.com/LedgerHQ/clear-signing-format-spec/blob/master/schemas/clear-signing-schema.json",

    "context": {
        "$id": "Tether USD",
        "contract" : {
            "chainId": 1,
            "address": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
            "abi": "https://api.etherscan.io/api?module=contract&action=getabi&address=0xdac17f958d2ee523a2206206994597c13d831ec7"
        }
    }, 

    "metadata": {
        "owner": "Tether",
        "info": {
            "legalName": "Tether Limited",
            "url": "https://tether.to/",
            "lastUpdate": "2017-11-28T12:41:21Z"  
        }
    },

    "display": {
        "formats": {
            "0xa9059cbb": {
                "$id" : "transfer",
                "intent": "Send",
                "fields": {
                    "_to" : {
                        "label": "To",
                        "format": "addressOrName"
                    },
                    "_value" : {
                        "label": "Amount",
                        "format": "tokenAmount",
                        "params": {
                            "tokenPath": "$.context.contract.address"
                        }
                    }
                },
                "required": ["_to", "_value"]
            }
        }
    }
}
```

The `$schema` key refers to the latest version of this specification json schema (currently version XXX).

The `context` key is used to provide binding context information for this file. A wallet MUST ensure this file is applied only if the context information matches the data being signed. 

In this example, the context section refers to the USDT smartcontract address on ethereum mainnet and its reference abi. Note that the abi is used to define unique *path* references to fields that must be formatted according to this file, so it is mandatory for all contracts clear signed.

The `metadata` section contains relevant constants for the given context, typically used to:
* Provide displayable information about the recipient of the contract call / message
* Provide constants used by the various formats defined in the file

In this example, the metadata section contains only the recipient information, in the form of a displayable name (`owner` key) and additional information (`info` key) that MAY be used by wallets to provide details about the recipient.

Finally, the `display` section contains the definitions of how to format each field of targeted contract calls under the `formats` key. 

In this example, the function being described is identified by its selector `0xa9059cbb` (this is the `transfer` function, as reminded by the internal key `$id`). The `intent` key contains a human readable string to display to explain to the user the intent of the function call. The `fields` key contains all the parameters that can be displayed, and the way to format them (with the `required` key indicating which parameters wallet SHOULD display). In this case, the `_to` parameter and the `_value` SHOULD both be displayed, one as an address replaceable by a trusted name (ENS or others), the other as an amount formatted using metadata of the target ERC20 contract (USDT). 

### Common concepts

#### Structured Data

This specification intends to be extensible to describe the display formatting of any kind of structured data. 

By "Structured data", we target any data format that has:
* A well defined *type* system, the data being described itself being of a specific type
* A description of the type system, the *schema*, that should allow splitting the data into *fields*, each field clearly identified with a *path* that can be descrived as a string.
* Structured data can be part of of *container structure*, or be self-contained.
  * Container structure has a well defined *signature* scheme (either a serialization scheme or a hashing scheme, and signature algorithm).
  * The container structure does not necessarily follow the same type system as the structured data.
  * Wallets receive the container structure and uses the signature scheme to generate a signature on the overall structure.

[Show a diagram of internals of a Tx]

Current specification covers EVM smart contract calldata:
* Defined in [Solidity](https://docs.soliditylang.org/en/latest/abi-spec.html#)
* The ABI is the schema
* The container structure is an EVM Transaction

It also supports EIP 712 messages
* Defined in [EIP 712](https://eips.ethereum.org/EIPS/eip-712)
* The schema is extracted from the message itself
* An EIP 712 message is self contained, the signature is applied to the message itself.
  
In the future, it could be extended to structured data like [EIP 2771 Meta Transactions](https://eips.ethereum.org/EIPS/eip-2771) or [EIP 4337 User Operations](https://www.erc4337.io/docs/understanding-ERC-4337/user-operation).

The *schema* is referenced and bound to this file under the `context` key. In turn, it enables using *path* strings to target specific fields in the `display` section to describe what formatting should be applied to these fields before display.

Formats are dependent on and defined for the underlying *types* on the structured data. The [Reference](#reference) section covers formats and types supported by this current version of the specification. 

It is sometime necessary for formatting of fields of the structured data to reference values of the *container structure*. These values are dependent on the container structure itself and are defined in the [Reference](#reference) section.

#### Path references

This specification uses a limited [json path](https://datatracker.ietf.org/doc/rfc9535/) notation to reference values that are described in multiple json documents. 

Limitation to the json path specification are the following:
* Pathes MUST use the dot notation 
* Only name, index and slices selectors are supported.
* Slices selectors MUST NOT contain the optional step.
* Additional roots are introduced to support pathes in multiple places.
* When not ambiguous, the structured data root `#` and subsequent `.` step separator can be omitted

The root node identifier indicates which document or data location this path references, according to the following table:

| Root node identifier | Refers to | Value location |
| --- | --- | --- |
| # | Path applies to the structured data *schema* (ABI path for contracts, path in the message types itself for EIP712) | Values can be found in the serialized representation of the structured data | 
| $ | Path applies to the current file describing the structured data formatting, after includes | Values can be found in the merged file itself | 
| @ | Path applies to the container of the structured data to be signed | Values can be found in the serialized container to sign, and are uniquely defined per container in the [Reference](#reference) section |

For pathes referring to structured data fields, if a field has a variable length primitive type (like `bytes` or `string` in solidity), a slice selector can be appended to the path, to refer to the specific set of bytes indicated by the slice.

*Examples*

References to values in the serialized data
* `#.params.amountIn` or `params.amountIn` refers to parameter `amountIn` in top-level structure `params` as defined in the ABI
* `#.data.path[0].path[-1].to` or `data.path[0].path[-1].to` refers to the field `to` taken from last member of `path` array, itself taken from first member of enclosing `path` array, itself part of top level `data` structure.
* `#.params.path[0..19]` refers to the first 20 bytes of the `path` byte array
* `#.params.path[-20:-1]` refers to the last 20 bytes of the `path` byte array

References to values in the format specification file
* `$.context.contract.address` refers to the value of the contract address this file is bound to
* `$.metadata.enums.interestRateMode` refers to the values of an enum defined in the specification file (typically to convert an integer into a displayed string)
* `$.display.definitions.minReceiveAmount` refers to a common definition reused accross fields formatting definition

References to values in the container
* `@.amount` refers to the enclosing transaction native currency amount

#### Organizing files

Smartcontracts and EIP 712 messages are often re-using common interfaces or types that share similar display formatting. This specification supports a basic inclusion mechanism that enables sharing files describing specific interfaces or types.

The `includes` top-level key is an array of URLs, pointing to files that MUST follow this same specification.

A wallet using a file including other files SHOULD merge those files into the top-level file. When merging, conflicts for unique keys are resolved by prioritizing the including file first, then by each included file in the order they appear in the including file.

It is NOT RECOMMENDED to include files beyond one level of depth, to avoid descriptions that would be too complex to handle for some wallets.

*Example*

This file defines a generic ERC20 interface for a single approve function:
```json
{
    "context": {
        "contract" : {
            "abi": [
                {
                    "inputs": [
                        {
                            "name": "_spender",
                            "type": "address"
                        },
                        {
                            "name": "_value",
                            "type": "uint256"
                        }
                    ],
                    "name": "approve",
                    "type": "function"
                }
            ]
        }
    },

    "display": {
        "formats": {
            "0x095ea7b3": {
                "$id" : "approve",
                "intent": "Approve",
                "fields": {
                    "_spender" : {
                        "label": "Spender",
                        "format": "addressOrName"
                    },
                    "_value" : {
                        "label": "Amount",
                        "format": "allowanceAmount",
                        "params": {
                            "tokenPath": "$.context.contract.address",
                            "threshold": "0x8000000000000000000000000000000000000000000000000000000000000000"
                        }
                    }
                },
                "required": ["_spender", "_value"]
            }

        }
    }
}
```
Note that there are no keys for binding the contract to a specific address or owner, nor any contract specific metadata.

The following file would include this generic interface and bind it to the specific USDT contract:
```json
{
    "context": {
        "$id": "Tether USD",
        "contract" : {
            "chainId": 1,
            "address": "0xdAC17F958D2ee523a2206206994597C13D831ec7"
        }
    }, 
    "includes": ["../examples/clear-signing-example-erc20.json"],
    "metadata": {
        "owner": "Tether",
        "info": {
            "legalName": "Tether Limited",
            "url": "https://tether.to/",
            "lastUpdate": "2017-11-28T12:41:21Z"  
        },
        "token": {
            "ticker": "USDT",
            "name": "Tether USD",
            "magnitude": 6
        }
    }
}
```
Note that the keys under `context.contract` would be merged together to construct a full contract binding object.

### Context section

The `context` section describes the context to which this display format description file is bound. A wallet MUST verify that the structured data and container it is trying to sign corresponds to the context in this section.

The current version of this specification only supports two types of binding context, EVM smartcontracts and EIP712 domains. 

* The `$id` sub-key is an internal identifier, not used for formatting the display, only relevant to provide a human readable name to this specification file
* The `contract` sub-key is used to describe an EVM smartcontract binding context, with:
  
  * `chainId`: an [EIP 155 identifier](https://chainid.network/) of the chain the contract described is deployed on
  * `address`: the address of the bound contract
  * `abi`: either an URL of the reference ABI (in json representation), or the ABI itself as a json array
  
* The `eip712` sub-key is used to describe the EIP 712 message type to bind to:

  * The `schema` key is either an URL pointing to the EIP-712 schema or the json schema itself. An EIP 712 schema consists in the json document with just the `types` and `primaryType` keys of the message. 
  * The `domain` key is the domain this file should be bound to. Each key in this `domain` binding MUST match the `domain` keys of the message. Note that the message can have more keys in its `domain` than those listed in the formatting file. An EIP-712 domain is a free-form list of keys, but those are very common to include:
  
    * `name`: the name of the message verifier
    * `version`: the version of the message
    * `chainID`: an [EIP 155 identifier](https://chainid.network/) of the chain the message is bound to 
    * `verifyingContract`: the address the message is bound to

*Examples*

[TBD]

### Metadata section

The `metadata` section contains information 

### Display section

## Reference

### Container structure values

This section describes all container structure supported by this specification and possible references path to relevant values.

#### EVM Transaction container

| Value reference | Value Description | Examples |
| --- | --- | --- |
| @.amount        | The native currency amount of the transaction containing the structured data | |

### Field formats

#### Integer formats

Formats useable for uint/int solidity types 

| Format name | Parameters | Format Description | Examples |
| ----------- | ---------- | ------------------ | -------- |
| raw         | n/a        | Raw int value      | Value 1000 displayed as `1000` |
| amount      | n/a        | Display as an amount in native currency, using best ticker / magnitude match.    | Value 0x2c1c986f1c48000is displayed as `0.19866144 Eth` |
| tokenAmount | tokenPath  | Convert value using magnitude of token, and append ticker name.    | Value 1000000, for ticker DAI, magnitude 6 displayed as `1 DAI` |
| allowanceAmount | tokenPath <br> threshold | If value >= threshold, display as unlimited allowance appended with ticker, otherwise as tokenAmount  | Value 1000000, for ticker DAI, magnitude 6, threshold 0xFFFFFFFF displayed as `1 DAI`. <br> Value 0xFFFFFFFF, for ticker DAI, magnitude 6, threshold 0xFFFFFFFF displayed as `Unlimited DAI` |
| date        | encoding  | Display int as a date, using specified encoding. <br>Encoding *timestamp*, value is encoded as a unix timestamp. <br>Encoding *blockheight*, value is a blockheight and is converted to an approximate unix timestamp. <br>Date display RECOMMENDED use of RFC 3339 | Value 1709191632, with encoding timestamp is displayed as `2024-02-29T08:27:12`. <br> Value 19332140, encoding blockheight is displayed as `2024-02-29T09:00:35` |
| percentage  | magnitude  | Value is converted using magnitude and displayed as a precentage | Value 3000 displayed as `1000` |
| enum        | $ref       | Value is converted to a human readable string using the enumeration in reference  | ... |

#### String / bytes formats

| Solidity type | Format name | Parameters | Format Description | Examples |
| ------------- | ----------- | ---------- | ------------------ | -------- |
| string        | raw         | n/a        | Display as an UTF-8 encoded string  | Value ['4c','65','64','67','65','72'] displayed as `Ledger` |
| bytes         | raw         | n/a        | Display byte array as an hex-encoded string | Value ['12','34','56','78','9a'] displayed as `123456789A` |
| bytes         | calldata    | url <br> selector | Data contains a call to another smartcontract. url points to the clear signing file describing target contract. If selector is not set, it is read from the calldata itself. Formatted as ? | ? |

#### Address

| Format name    | Parameters | Format Description | Examples |
| -------------- | ---------- | ------------------ | -------- |
| raw            | n/a        | Display address as an EIP55 formatted string  | Value 0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed displayed as `0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed` |
| addressOrName  | n/a     | Display address as a trusted name if a resolution exists, an EIP55 formatted address otherwise   | Value 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 displayed as `vitalik.eth` |

### Wallets

#### Ledger

[TBD] Link to ledger specification

### Rationale / Restrictions

Simple human readable format

Flat fields

## Security Considerations

Binding context

Curation model

## Copyright

Copyright and related rights waived via [CC0](../LICENSE.md).