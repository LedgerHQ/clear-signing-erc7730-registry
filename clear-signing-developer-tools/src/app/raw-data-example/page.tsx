"use client";
import { type ERC7730Schema } from "~/types";
import callData from "../../../../registry/paraswap/calldata-AugustusSwapper.json";
import { getPreviewData } from "~/utils/getPreviewData";

export default function Page() {
  const parsedData = getPreviewData(callData as unknown as ERC7730Schema);
  return (
    <>
      <pre>{JSON.stringify(parsedData, null, 2)}</pre>
    </>
  );
}
