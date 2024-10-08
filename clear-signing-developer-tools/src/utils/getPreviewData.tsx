/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { type Operation, type PreviewData } from "../types/PreviewData";
import type { ERC7730Schema } from "~/types";

function transformSimpleFormatToOperations(display: any): Operation[] {
  const formats = display.formats;
  const definitions = display.definitions || {};

  if (!formats) return [];

  return Object.keys(formats).map((key) => {
    const format = formats[key];

    const displays = format.fields.map((field: any) => {
      let label = field.label;
      let displayValue = field.format || "unknown";

      if (field.$ref) {
        const refPath = field.$ref.split(".").pop();
        if (refPath && definitions[refPath]) {
          label = definitions[refPath].label || label;
          displayValue = definitions[refPath].format || displayValue;
        }
      }

      return {
        label,
        displayValue,
      };
    });

    return {
      intent: format.intent,
      displays,
    };
  });
}

export function getPreviewData(data: ERC7730Schema): PreviewData {
  const { display, metadata } = data;
  const operations = transformSimpleFormatToOperations(display);

  const type = "contract" in data.context ? "transaction" : "message";

  return {
    contract: {
      id: "PoapBridge",
      address: "0x0bb4d3e88243f4a057db77341e6916b0e449b158",
    },
    operations,
    metadata,
    type,
  };
}
