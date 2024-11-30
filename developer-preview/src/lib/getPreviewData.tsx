import {
  type AbiFunction,
  createPublicClient,
  decodeFunctionData,
  getAbiItem,
  http,
  isAddress,
  isHex,
  parseAbiItem,
  toFunctionSelector,
} from "viem";
import { mainnet } from "viem/chains";

import { type Operation, type PreviewData } from "~/types/PreviewData";
import type { ABI, ERC7730Schema, FieldFormatter } from "~/types/ERC7730Schema";

const publicClient = createPublicClient({ chain: mainnet, transport: http() });

const get = (values: unknown, path: string) =>
  path
    .split(".")
    .reduce((acc, key) => acc && (acc as Record<string, unknown>)[key], values);

const processFields = (
  fields: FieldFormatter[],
  definitions: Record<string, { label?: string; format?: string }>,
  values: Record<string, unknown>,
): Promise<{ label: string; displayValue: string }[]> =>
  Promise.all(
    fields.map(async (field) => {
      let label = field.label ?? "unknown";
      let displayValue = field.format ?? "unknown";

      if (field.$ref) {
        const refPath = field.$ref.split(".").pop();
        if (refPath && definitions[refPath]) {
          label = definitions[refPath].label ?? label;
          displayValue = definitions[refPath].format ?? displayValue;
        }
      }

      if (field.path) {
        const value = get(values, field.path);
        if (value) {
          switch (field.format) {
            case "date":
              if (field.params?.encoding === "timestamp") {
                displayValue = new Date(Number(value) * 1000).toLocaleString(
                  "fr",
                  { timeZone: "UTC" },
                );
                break;
              }
            case "addressName":
              if (
                typeof value === "string" &&
                Array.isArray(field.params?.sources) &&
                field.params.sources.includes("ens") &&
                isAddress(value)
              ) {
                const name = await publicClient.getEnsName({ address: value });
                if (name) {
                  displayValue = name;
                  break;
                }
              }
            default:
              displayValue = String(value);
          }
        }
      }

      if (field.fields) {
        if (field.path?.endsWith("[]")) {
          const simulatedArrayLength = field.fields.length;
          return Promise.all(
            Array(simulatedArrayLength)
              .fill(null)
              .map(() =>
                processFields(field.fields ?? [], definitions, values),
              ),
          ).then((fields) => fields.flat());
        } else {
          return processFields(field.fields, definitions, values);
        }
      }

      return { label, displayValue };
    }),
  ).then((fields) => fields.flat());

async function transformSimpleFormatToOperations(
  display: ERC7730Schema["display"],
  callData?: string,
  abiOrURL?: ABI | string,
): Promise<Operation[]> {
  const formats = display.formats;
  const definitions = display.definitions ?? {};

  if (!formats) return [];

  const abi =
    typeof abiOrURL === "string"
      ? await fetch(
          abiOrURL.replace(
            /^https:\/\/github\.com\/([^/]+\/[^/]+\/)blob\//,
            "https://raw.githubusercontent.com/$1",
          ),
        )
          .then(async (response) => {
            if (!response.ok) throw new Error();
            const json: unknown = await response.json();
            if (!Array.isArray(json)) throw new Error();
            return json as ABI;
          })
          .catch(() => undefined)
      : abiOrURL;

  return Promise.all(
    Object.entries(formats).map(async ([signature, format]) => {
      const id = typeof format.$id === "string" ? format.$id : "";
      const intent =
        typeof format.intent === "string"
          ? format.intent
          : JSON.stringify(format.intent);

      const values: Record<string, unknown> = {};
      if (isHex(callData)) {
        try {
          const abiItem = (abi &&
            getAbiItem({
              abi: abi ?? [parseAbiItem(`function ${signature}`)],
              name: isHex(signature)
                ? signature
                : toFunctionSelector(`function ${signature}`),
            })) as AbiFunction;
          const { args } = decodeFunctionData({
            abi: [abiItem],
            data: callData,
          });
          for (const [index, { name }] of abiItem.inputs.entries()) {
            if (name) values[name] = args[index];
          }
        } catch {}
      }

      const displays = await processFields(format.fields, definitions, values);

      return { id, intent, displays };
    }),
  );
}

type PreviewDataResponse =
  | { data: PreviewData; error: null }
  | { data: null; error: string };

export async function getPreviewData(
  data: ERC7730Schema,
  callData?: string,
): Promise<PreviewDataResponse> {
  try {
    const { context, display, metadata } = data;
    const operations = await transformSimpleFormatToOperations(
      display,
      callData,
      "contract" in context ? context.contract.abi : undefined,
    );
    const name =
      "contract" in context ? context.$id : context.eip712.domain.name;

    const type = "contract" in context ? "transaction" : "message";
    const inContextDeployments =
      "contract" in context
        ? context.contract.deployments
        : context.eip712.deployments;

    const deployments = inContextDeployments.map(({ address, chainId }) => ({
      address,
      chainId,
    }));

    return {
      data: {
        contract: {
          name,
          deployments,
        },
        operations,
        metadata,
        type,
      },
      error: null,
    };
  } catch (error: unknown) {
    const { message } = error as { message: string };
    console.error("Error parsing selected file: ", message);
    return {
      error: "Error parsing selected file. See browser console for details.",
      data: null,
    };
  }
}
