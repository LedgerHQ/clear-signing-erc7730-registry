import { type PreviewData } from "../types/PreviewData";
import type { ERC7730Schema } from "~/types";

export function getPreviewData(data: ERC7730Schema): PreviewData {
  const displays: PreviewData["displays"] = [];

  const { display, metadata } = data;
  console.log(display);

  for (const formatKey in display.formats) {
    const format = display.formats[formatKey];

    if (format?.fields && Array.isArray(format.fields)) {
      format.fields.forEach((field) => {
        let label: string | undefined;
        const displayValue = field.path;

        if (field.$ref) {
          const definitionKey = field.$ref.split(".").pop();
          if (definitionKey && display.definitions[definitionKey]) {
            label = display.definitions[definitionKey].label;
          }
        } else {
          label = field.label;
        }

        if (label && displayValue) {
          displays.push({ label, displayValue });
        }
      });
    }
  }

  return { displays, metadata, intent: "TODO" };
}
