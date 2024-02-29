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

<!--
  READ EIP-1 (https://eips.ethereum.org/EIPS/eip-1) BEFORE USING THIS TEMPLATE!

  This is the suggested template for new EIPs. After you have filled in the requisite fields, please delete these comments.

  Note that an EIP number will be assigned by an editor. When opening a pull request to submit your EIP, please use an abbreviated title in the filename, `eip-draft_title_abbrev.md`.

  The title should be 44 characters or less. It should not repeat the EIP number in title, irrespective of the category.

  TODO: Remove this comment before submitting
-->

## Abstract

<!--
  The Abstract is a multi-sentence (short paragraph) technical summary. This should be a very terse and human-readable version of the specification section. Someone should be able to read only the abstract to get the gist of what this specification does.

  TODO: Remove this comment before submitting
-->
This specification defines a JSON format carrying additional information required to correctly display structured data to a human for review

## Motivation

<!--
  This section is optional.

  The motivation section should include a description of any nontrivial problems the EIP solves. It should not describe how the EIP solves those problems, unless it is not immediately obvious. It should not describe why the EIP should be made into a standard, unless it is not immediately obvious.

  With a few exceptions, external links are not allowed. If you feel that a particular resource would demonstrate a compelling case for your EIP, then save it as a printer-friendly PDF, put it in the assets folder, and link to that copy.

  TODO: Remove this comment before submitting
-->
Hardware Wallets / Clear Signing

## Specification

<!--
  The Specification section should describe the syntax and semantics of any new feature. The specification should be detailed enough to allow competing, interoperable implementations for any of the current Ethereum platforms (besu, erigon, ethereumjs, go-ethereum, nethermind, or others).

  It is recommended to follow RFC 2119 and RFC 8170. Do not remove the key word definitions if RFC 2119 and RFC 8170 are followed.

  TODO: Remove this comment before submitting
-->

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in RFC 2119 and RFC 8174.

| Solidity type | Format name | Parameters | Format Description | Examples |
| ------------- | ----------- | ---------- | ------------------ | -------- |
| uint / int    | raw         | n/a        | Raw int value  | Value 1000 displayed as `1000` |
| uint / int    | tokenAmount | tokenPath  | Convert value using magnitude of token, and append ticker name.    | Value 1000000, for ticker DAI, magnitude 6 displayed as `1 DAI` |
| uint / int    | allowanceAmount | tokenPath <br> threshold | If value >= threshold, display as unlimited allowance appended with ticker, otherwise as tokenAmount  | Value 1000000, for ticker DAI, magnitude 6, threshold 0xFFFFFFFF displayed as `1 DAI`. <br> Value 0xFFFFFFFF, for ticker DAI, magnitude 6, threshold 0xFFFFFFFF displayed as `Unlimited DAI` |
| uint / int    | date        | encoding  | Display int as a date, using specified encoding. <br>Encoding *timestamp*, value is encoded as a unix timestamp. <br>Encoding *blockheight*, value is a blockheight and is converted to an approximate unix timestamp. <br>Date display RECOMMENDED use of RFC 3339 | Value 1709191632, with encoding timestamp is displayed as `2024-02-29T08:27:12`. <br> Value 19332140, encoding blockheight is displayed as `2024-02-29T09:00:35` |
| uint / int    | percentage  | magnitude  | Value is converted using magnitude and displayed as a precentage | Value 3000 displayed as `1000` |
| address       | raw         | n/a        | Display address as an EIP55 formatted string  | Value 0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed displayed as `0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed` |
| address       | addressOrName  | n/a     | Display address as a trusted name if a resolution exists, an EIP55 formatted address otherwise   | Value 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 displayed as `vitalik.eth` |
| string        | raw         | n/a        | Display as an UTF-8 encoded string  | Value ['4c','65','64','67','65','72'] displayed as `Ledger` |
| bytes         | raw         | n/a        | Display byte array as an hex-encoded string | Value ['12','34','56','78','9a'] displayed as `123456789A` |
| bytes         | calldata    | url <br> selector | Data contains a call to another smartcontract. url points to the clear signing file describing target contract. If selector is not set, it is read from the calldata itself. Formatted as ? | ? |

## Rationale

<!--
  The rationale fleshes out the specification by describing what motivated the design and why particular design decisions were made. It should describe alternate designs that were considered and related work, e.g. how the feature is supported in other languages.

  The current placeholder is acceptable for a draft.

  TODO: Remove this comment before submitting
-->

TBD

## Backwards Compatibility

<!--

  This section is optional.

  All EIPs that introduce backwards incompatibilities must include a section describing these incompatibilities and their severity. The EIP must explain how the author proposes to deal with these incompatibilities. EIP submissions without a sufficient backwards compatibility treatise may be rejected outright.

  The current placeholder is acceptable for a draft.

  TODO: Remove this comment before submitting
-->

No backward compatibility issues found.

## Test Cases

<!--
  This section is optional for non-Core EIPs.

  The Test Cases section should include expected input/output pairs, but may include a succinct set of executable tests. It should not include project build files. No new requirements may be be introduced here (meaning an implementation following only the Specification section should pass all tests here.)
  If the test suite is too large to reasonably be included inline, then consider adding it as one or more files in `../assets/eip-####/`. External links will not be allowed

  TODO: Remove this comment before submitting
-->

## Reference Implementation

<!--
  This section is optional.

  The Reference Implementation section should include a minimal implementation that assists in understanding or implementing this specification. It should not include project build files. The reference implementation is not a replacement for the Specification section, and the proposal should still be understandable without it.
  If the reference implementation is too large to reasonably be included inline, then consider adding it as one or more files in `../assets/eip-####/`. External links will not be allowed.

  TODO: Remove this comment before submitting
-->

## Security Considerations

<!--
  All EIPs must contain a section that discusses the security implications/considerations relevant to the proposed change. Include information that might be important for security discussions, surfaces risks and can be used throughout the life cycle of the proposal. For example, include security-relevant design decisions, concerns, important discussions, implementation-specific guidance and pitfalls, an outline of threats and risks and how they are being addressed. EIP submissions missing the "Security Considerations" section will be rejected. An EIP cannot proceed to status "Final" without a Security Considerations discussion deemed sufficient by the reviewers.

  The current placeholder is acceptable for a draft.

  TODO: Remove this comment before submitting
-->

Needs discussion.

## Copyright

Copyright and related rights waived via [CC0](../LICENSE.md).