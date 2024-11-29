import {
  type AbiFunction,
  createPublicClient,
  decodeFunctionData,
  http,
  isAddress,
  isHex,
  parseAbiItem,
} from "viem";
import { mainnet } from "viem/chains";

import { type Operation, type PreviewData } from "~/types/PreviewData";
import type { ERC7730Schema, FieldFormatter } from "~/types/ERC7730Schema";

const publicClient = createPublicClient({ chain: mainnet, transport: http() });

const processFields = (
  fields: FieldFormatter[],
  definitions: Record<string, { label?: string; format?: string }>,
  values: Record<string, string>,
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
        const value = values[field.path];
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
              displayValue = value;
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
): Promise<Operation[]> {
  const formats = display.formats;
  const definitions = display.definitions ?? {};

  if (!formats) return [];

  return Promise.all(
    Object.entries(formats).map(async ([signature, format]) => {
      const id = typeof format.$id === "string" ? format.$id : "";
      const intent =
        typeof format.intent === "string"
          ? format.intent
          : JSON.stringify(format.intent);

      const values: Record<string, string> = {};
      if (isHex(callData) && !isHex(signature)) {
        const abiItem = parseAbiItem(`function ${signature}`) as AbiFunction;
        try {
          const { args } = decodeFunctionData({
            abi: [abiItem],
            data: callData,
          });
          for (const [index, { name }] of abiItem.inputs.entries()) {
            if (name) values[name] = String(args[index]);
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
