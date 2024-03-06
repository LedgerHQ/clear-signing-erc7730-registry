---
title: Structured Data Clear Signing Format
description: Draft specification of a json format enabling providing additional description of how to clear-sign smartcontract calls and EIP712 messages on wallets  
author: Laurent Castillo(@lcastillo-ledger)
discussions-to: [github](https://github.com/LedgerHQ/clear-signing-format-spec/issues)
status: Draft
type: Standards Track
category: Interface
created: 2024-02-07
requires: 20, 712
---

## Abstract

This specification defines a JSON format carrying additional information required to correctly display structured data to a human for review on a wallet screen, before signature by the wallet.

## Motivation

Hardware Wallets / Clear Signing

## Specification

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in RFC 2119 and RFC 8174.

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

## Rationale

<!--
  The rationale fleshes out the specification by describing what motivated the design and why particular design decisions were made. It should describe alternate designs that were considered and related work, e.g. how the feature is supported in other languages.

  The current placeholder is acceptable for a draft.

  TODO: Remove this comment before submitting
-->

What is structured data?

"Structured data" is any data with a well defined structure, splitting the data into *fields*, each field clearly identified with a *path*. In the context of this specification, structured data is assumed to have a json based definition of the structure, a *schema*, a well defined *serialization* and *signature scheme*. 


## Security Considerations

<!--
  All EIPs must contain a section that discusses the security implications/considerations relevant to the proposed change. Include information that might be important for security discussions, surfaces risks and can be used throughout the life cycle of the proposal. For example, include security-relevant design decisions, concerns, important discussions, implementation-specific guidance and pitfalls, an outline of threats and risks and how they are being addressed. EIP submissions missing the "Security Considerations" section will be rejected. An EIP cannot proceed to status "Final" without a Security Considerations discussion deemed sufficient by the reviewers.

  The current placeholder is acceptable for a draft.

  TODO: Remove this comment before submitting
-->

Needs discussion.

## Copyright

Copyright and related rights waived via [CC0](../LICENSE.md).