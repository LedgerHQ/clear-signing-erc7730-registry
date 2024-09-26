import { type Operation, type PreviewData } from "../types/PreviewData";
import type { ERC7730Schema } from "~/types";

function transformSimpleFormatToOperations(
  display: ERC7730Schema["display"],
): Operation[] {
  const formats = display.formats;
  const definitions = display.definitions ?? {};

  if (!formats) return [];

  return Object.values(formats).map((format) => {
    // TODO: Handle complex intent messages
    // https://ledgerhq.atlassian.net/browse/EDEV-7541
    const intent =
      typeof format.intent === "string"
        ? format.intent
        : JSON.stringify(format.intent);

    const displays = format.fields.map((field) => {
      let label = field.label ?? "unknown";
      let displayValue = field.format ?? "unknown";

      if (field.$ref) {
        const refPath = field.$ref.split(".").pop();
        if (refPath && definitions[refPath]) {
          label = definitions[refPath].label ?? label;
          displayValue = definitions[refPath].format ?? displayValue;
        }
      }

      return { label, displayValue };
    });

    return { intent, displays };
  });
}

type PreviewDataResponse =
  | { data: PreviewData; error: null }
  | { data: null; error: string };

export function getPreviewData(data: ERC7730Schema): PreviewDataResponse {
  try {
    const { context, display, metadata } = data;
    const operations = transformSimpleFormatToOperations(display);
    const name =
      "contract" in context ? context.$id : context.eip712.domain.name;

    const type = "contract" in context ? "transaction" : "message";
    const inContextDeployments =
      "contract" in context
        ? context.contract.deployments
        : context.eip712.deployments;

    const deployments = inContextDeployments.map(({ address }) => ({
      address,
    }));

    return {
      data: {
        contract: { name, deployments },
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
      error: "Error parsing selected file (see Browser Console for details)",
      data: null,
    };
  }
}
