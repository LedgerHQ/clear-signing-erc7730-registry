"use client";
import { type ERC7730Schema } from "~/types";
import callData from "../../../../registry/paraswap/calldata-AugustusSwapper.json";

export type PreviewData = {
  intent: string;
  metadata: {
    owner: string;
    info: {
      legalName: string;
      lastUpdate: string;
      url: string;
    };
  };
  displays: DisplayItem[];
};

interface DisplayItem {
  label: string;
  displayValue: string;
}

function extractDisplayFields(data: ERC7730Schema): PreviewData {
  const displays: DisplayItem[] = [];

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

export default function Page() {
  const parsedData = extractDisplayFields(callData as unknown as ERC7730Schema);
  return (
    <>
      <pre>{JSON.stringify(parsedData, null, 2)}</pre>
    </>
  );
}
