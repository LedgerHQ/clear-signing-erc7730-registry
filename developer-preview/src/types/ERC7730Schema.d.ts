export interface ERC7730Schema {
  $schema: string;
  includes?: string;
  context: Context;
  metadata: Metadata;
  display: Display;
}

type Context =
  | { $id: string; contract: ContractBindingContext }
  | { eip712: EIP712BindingContext };

interface ContractBindingContext {
  abi: ABI | string;
  deployments: Deployment[];
  addressMatcher?: string;
  factory?: FactoryConstraint;
}

interface EIP712BindingContext {
  schemas: (EIP712Schema | string)[];
  domain: { name: string };
  domainSeparator?: string;
  deployments: Deployment[];
}

interface Deployment {
  chainId: number; // eip155 format
  address: string; // eip55 format
}

interface FactoryConstraint {
  deployments: Deployment[];
  deployEvent: string;
}

interface Metadata {
  owner: string;
  info: OwnerInfo;
  token?: TokenDescription;
  constants?: Record<string, string>;
  enums?: Record<string, Enum>;
}

interface OwnerInfo {
  legalName: string;
  deploymentDate: string;
  url: string;
}

interface TokenDescription {
  name: string;
  ticker: string;
  decimals: number;
}

interface Display {
  definitions?: Record<string, FieldFormatter>;
  formats: Record<string, StructuredDataFormat>;
}

interface FieldFormatter {
  $id?: string;
  $ref?: string;
  label?: string;
  format?: FieldFormat;
  path?: string;
  params?: Record<string, unknown>;
  fields?: FieldFormatter[];
}

type FieldFormat =
  | "amount"
  | "tokenAmount"
  | "nftName"
  | "date"
  | "duration"
  | "unit"
  | "enum"
  | "raw"
  | "calldata"
  | "addressName";

interface StructuredDataFormat {
  $id?: string;
  intent?: Intent;
  fields: FieldFormatter[];
  required?: string[];
  screens?: Record<string, Screen[]>;
}

type Intent = string | Record<string, string>;

interface EIP712Schema {
  types: {
    EIP712Domain: unknown[];
    [key: string]: unknown[];
  };
  primaryType: string;
}

type ABI = ABIEntry[];

interface ABIEntry {
  inputs: ABIParameter[];
  name: string;
  outputs: ABIParameter[];
  stateMutability: "pure" | "view" | "nonpayable" | "payable";
  type: "function" | "constructor" | "receive" | "fallback";
}

interface ABIParameter {
  name: string;
  type: string;
  internalType?: string;
  components?: ABIParameter[];
}

type Enum = Record<string, string>;
