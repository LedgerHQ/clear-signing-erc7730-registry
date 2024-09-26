import { type Operation, type PreviewData } from "../types/PreviewData";
import type { ERC7730Schema, FieldFormatter } from "~/types";

const processFields = (
  fields: FieldFormatter[],
  definitions: Record<string, { label?: string; format?: string }>,
): { label: string; displayValue: string }[] => {
  return fields.flatMap((field) => {
    let label = field.label ?? "unknown";
    let displayValue = field.format ?? "unknown";

    if (field.$ref) {
      const refPath = field.$ref.split(".").pop();
      if (refPath && definitions[refPath]) {
        label = definitions[refPath].label ?? label;
        displayValue = definitions[refPath].format ?? displayValue;
      }
    }

    if (field.fields) {
      if (field.path?.endsWith("[]")) {
        const simulatedArrayLength = field.fields.length;
        return Array(simulatedArrayLength)
          .fill(null)
          .flatMap(() => processFields(field.fields ?? [], definitions));
      } else {
        return processFields(field.fields, definitions);
      }
    }

    return { label, displayValue };
  });
};

function transformSimpleFormatToOperations(
  display: ERC7730Schema["display"],
): Operation[] {
  const formats = display.formats;
  const definitions = display.definitions ?? {};

  if (!formats) return [];

  return Object.values(formats).map((format) => {
    const intent =
      typeof format.intent === "string"
        ? format.intent
        : JSON.stringify(format.intent);

    const displays = processFields(format.fields, definitions);

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
