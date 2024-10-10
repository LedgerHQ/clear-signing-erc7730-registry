# Clear Signing Developer Preview

Run this web app locally to preview how Clear Signed messages will appear on device.

## Getting started

### Prerequisite

Node.js: https://nodejs.org/en

We recommend using a Node version manager like **nvm** https://github.com/nvm-sh/nvm

### Install dependencies

From inside this directory `/developer-preview`

```
npm i
```

### Run locally

```
npm run dev
```

Open tool at http://localhost:3000

☝️ _or another port if `3000` is already in use_

### Choose your metadata file and preview the results

<img width="1512" alt="Screenshot 2024-10-09 of Clear Signing Preview" src="https://github.com/user-attachments/assets/9550611d-39a6-4775-ab13-37e29bda14ad">

The above demonstrates how a Clear Signed POAP would appear based on the metadata of [/registry/poap/calldata-PoapBridge.json](/blob/10b0241b5e4ab12f53a06b27f4ecda9fbc94b2d8/registry/poap/calldata-PoapBridge.json) stored in this registry.

## Get instant feedback before submitting your pull request

This tool is here to give you immediate feedback as you make your contributions to the registry.

### Having trouble

Please [create an issue](https://github.com/LedgerHQ/clear-signing-erc7730-registry/issues/new) in this repository if you can't find an existing one.
