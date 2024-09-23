/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { type Operation, type PreviewData } from "../types/PreviewData";
import type { ERC7730Schema } from "~/types";

function transformSimpleFormatToOperations(display: any): Operation[] {
  const formats = display.formats;

  if (!formats) return [];

  return Object.keys(formats).map((key) => {
    const format = formats[key];

    const displays = format.fields.map((field: any) => {
      return {
        label: field.label,
        displayValue: field.format || "unknown",
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

  return { operations, metadata, type };
}
