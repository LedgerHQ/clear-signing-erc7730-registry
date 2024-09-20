"use client";
import { type ERC7730Schema, type Metadata } from "~/types";
import callData from "../../../../registry/paraswap/calldata-AugustusSwapper.json";

export type PreviewData = {
  owner: Metadata;
  displays: DisplayItem[];
};

interface DisplayItem {
  label: string;
  displayValue: string;
}

function extractDisplayFields(data: ERC7730Schema): PreviewData {
  const displays: DisplayItem[] = [];

  const displayObject = data.display;
  console.log(displayObject);

  for (const formatKey in displayObject.formats) {
    const format = displayObject.formats[formatKey];

    if (format?.fields && Array.isArray(format.fields)) {
      format.fields.forEach((field) => {
        let label: string | undefined;
        const displayValue = field.path;

        if (field.$ref) {
          const definitionKey = field.$ref.split(".").pop();
          if (definitionKey && displayObject.definitions[definitionKey]) {
            label = displayObject.definitions[definitionKey].label;
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

  return { displays, owner: data.metadata };
}

export default function Page() {
  const parsedData = extractDisplayFields(callData as unknown as ERC7730Schema);
  return (
    <>
      <pre>{JSON.stringify(parsedData, null, 2)}</pre>
    </>
  );
}
