import {
  type AbiFunction,
  bytesToHex,
  createPublicClient,
  decodeFunctionData,
  erc20Abi,
  getAbiItem,
  hexToBytes,
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
  path.split(".").reduce((acc, key) => {
    if (!acc) return;
    const slice = /^\[(-?\d+)?(?::(-?\d+))?\]$/.exec(key);
    if (slice && isHex(acc)) {
      return bytesToHex(
        hexToBytes(acc).slice(
          Number(slice[1]),
          slice[2]
            ? Number(slice[2]) >= 0
              ? Number(slice[2]) + 1
              : Number(slice[2]) === -1
                ? undefined
                : Number(slice[2])
            : undefined,
        ),
      );
    }
    return (acc as Record<string, unknown>)[key];
  }, values);

const fetchAndParse = async (url: string, parse: (json: unknown) => ABI) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error();
  return parse(await response.json());
};

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
            case "unit":
              displayValue = `${
                Number(value) / 10 ** Number(field.params?.decimals ?? 0)
              }${field.params?.base ? ` ${String(field.params.base)}` : ""}`;
              break;
            case "tokenAmount":
              if (typeof field.params?.tokenPath === "string") {
                const token = get(values, field.params.tokenPath);
                if (isHex(token) && isAddress(token)) {
                  try {
                    const [decimals, symbol] = await Promise.all([
                      publicClient.readContract({
                        abi: erc20Abi,
                        address: token,
                        functionName: "decimals",
                      }),
                      publicClient.readContract({
                        abi: erc20Abi,
                        address: token,
                        functionName: "symbol",
                      }),
                    ]);
                    displayValue = `${Number(value) / 10 ** decimals}${symbol ? ` ${symbol}` : ""}`;
                    break;
                  } catch {}
                }
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
      ? await (
          abiOrURL.startsWith("https://api.etherscan.io/")
            ? fetchAndParse(
                abiOrURL.replace(
                  /^https:\/\/api\.etherscan\.io\/(.*)$/,
                  `https://api.etherscan.io/$1&apikey=${process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY}`,
                ),
                (json) => {
                  const data = json as { message?: string; result?: string };
                  if (!data?.result || data.message !== "OK") throw new Error();
                  return JSON.parse(data.result) as ABI;
                },
              )
            : fetchAndParse(
                abiOrURL.replace(
                  /^https:\/\/github\.com\/([^/]+\/[^/]+\/)blob\//,
                  "https://raw.githubusercontent.com/$1",
                ),
                (json) => {
                  if (!Array.isArray(json)) throw new Error();
                  return json as ABI;
                },
              )
        ).catch(() => undefined)
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
