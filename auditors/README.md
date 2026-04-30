# Clear Signing Auditor Quick Start

**Your role:** Review ERC-7730 descriptors — the JSON files that tell Ethereum wallets what to display when users sign transactions — and publish a cryptographic attestation confirming your review.

---

## What you're committing to

- Review assigned descriptors within **7 days** of being tagged
- Publish a signed attestation (or open an issue) for each descriptor reviewed
- Maintain your attestation as descriptors evolve — new version = new attestation required

---

## The 4-step review

**1. Project check**
Find the project URL in the descriptor JSON. Confirm the protocol's purpose and that the PR submitter is plausibly affiliated.

**2. Contract verification**
Confirm the contract is verified at [repo.sourcify.dev](https://repo.sourcify.dev). Cross-check the contract address and ABI against the descriptor. If unverified — **do not sign**.

**3. Descriptor accuracy**
- Parameter names, types, and ordering match the ABI
- Function selectors are correct
- Intent fields reflect real user impact — no misleading simplifications
- Approvals, transfers, and privileged actions are correctly flagged
- Payable vs non-payable is accurate
- Cross-chain deployments are consistent

**4. Tester validation**
Run the descriptor through the Tester tool to simulate transactions and confirm the output is unambiguous.

---

## Submitting your attestation

After a full review passes, create an **EAS offchain attestation** (ERC-8176 schema):

```json
{
  "$type": "8176/v1",
  "descriptorHash": "0x...",
  "attester": "eip155:1:0xYourAddress",
  "attesterType": "EOA",
  "issuedAt": <unix timestamp>,
  "expiresAt": null,
  "signature": "0x..."
}
```

`descriptorHash = keccak256(RFC 8785 JCS-canonicalized descriptor JSON)` — do not hash raw file bytes.

**Publish:** Download the attestation `.json` from EAS and submit it via PR to the registry at:

```
registry/<project>/sigs/<descriptor-name>/eip155-1-0xYourAddress.json
```

Note: filenames use dashes (`eip155-1-0x...`) since colons are not valid in file paths.

---

## Key rules

- Sign only after completing the full review
- Sign the **exact file version** you reviewed
- Never modify an existing attestation — issue a new one
- If issues are found: **do not sign** — open a GitHub issue instead
- If your key is compromised or you retract an attestation: submit a revocation on-chain via EAS

---

## Getting listed

Create `auditors/eip155-1-0xYourAddress/profile.json` and submit a PR:

```json
{
  "id": "eip155:1:0xYourAddress",
  "name": "Your Name",
  "ens": "yourname.eth",
  "organization": "Your Org"
}
```

`ens` and `organization` are optional. The folder name is your identifier. Wallets resolve your identity via ENS; revocation is handled via EAS — not this index.

---

*Registry: [github.com/ethereum/clear-signing-erc7730-registry](https://github.com/ethereum/clear-signing-erc7730-registry)*
