"use client";
import { ERC7730Schema } from "~/types";
import callData from "../../../../registry/paraswap/calldata-AugustusSwapper.json";

export type PreviewData = {
  intent: string;
  displays: [{ label: string; displayValue: string }];
};

interface DisplayItem {
  label: string;
  displayValue: string;
}

function extractDisplayFields(data: ERC7730Schema): DisplayItem[] {
  const displays: DisplayItem[] = [];

  const displayObject = data.display;
  console.log(displayObject);

  // Iterate through all the formats in display.formats
  for (const formatKey in displayObject.formats) {
    console.log("formatKey", formatKey);
    const format = displayObject.formats[formatKey];

    console.log("format", format);
    // Iterate over the fields within each format
    if (format?.fields && Array.isArray(format.fields)) {
      format.fields.forEach((field) => {
        let label: string | undefined;
        const displayValue = field.path;

        // If field has a $ref, extract label from definitions
        if (field.$ref) {
          const definitionKey = field.$ref.split(".").pop();
          if (definitionKey && displayObject.definitions[definitionKey]) {
            label = displayObject.definitions[definitionKey].label;
          }
        } else {
          label = field.label;
        }

        // If both label and displayValue are available, push to displays array
        if (label && displayValue) {
          displays.push({ label, displayValue });
        }
      });
    }
  }

  return displays;
}

export default function Page() {
  const parsedData = extractDisplayFields(callData as unknown as ERC7730Schema);
  return (
    <>
      <pre>{JSON.stringify(parsedData, null, 2)}</pre>
    </>
  );
}
