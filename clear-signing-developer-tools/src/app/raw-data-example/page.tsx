"use client";
import { type ERC7730Schema } from "~/types";
import callData from "../../../../registry/paraswap/calldata-AugustusSwapper.json";
import { extractDisplayFields } from "~/app/raw-data-example/extractDisplayFields";

export default function Page() {
  const parsedData = extractDisplayFields(callData as unknown as ERC7730Schema);
  return (
    <>
      <pre>{JSON.stringify(parsedData, null, 2)}</pre>
    </>
  );
}
