"use client";

import { useEffect, useState } from "react";
import { DevicesDemo } from "~/app/DevicesDemo";
import { PreviewForm } from "~/app/PreviewForm";
import { UI } from "~/app/UI";
import { getPreviewData } from "~/utils/getPreviewData";
import { type ERC7730Schema } from "~/types";
import { calculateScreensForDevice } from "~/app/calculateScreensForDevice";
import { SelectMetadataFile } from "~/app/SelectMetadataFile";

import poapBridgeFile from "../../../registry/poap/calldata-PoapBridge.json";
import paraswapFile from "../../../registry/paraswap/calldata-AugustusSwapper.json";
import d from "../../../registry/uniswap/eip712-UniswapX-ExclusiveDutchOrder copy.json";

export default function PreviewTool() {
  const [mounted, setMounted] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState("");
  const [fileKey, setFileKey] = useState("calldata-PoapBridge.json");

  useEffect(() => {
    setMounted(true);
    setSelectedDevice(localStorage.getItem("selectedDevice") ?? "stax");
  }, []);

  if (!mounted) {
    return null;
  }

  const files: Record<string, ERC7730Schema> = {
    "calldata-PoapBridge.json": poapBridgeFile as unknown as ERC7730Schema,
    "calldata-AugustusSwapper.json": paraswapFile as unknown as ERC7730Schema,
    "eip712-UniswapX-ExclusiveDutchOrder.json": d as unknown as ERC7730Schema,
  } as const;

  const metaDataFile = files[fileKey];
  const previewData = getPreviewData(metaDataFile!);
  const data = calculateScreensForDevice(selectedDevice, previewData);

  return (
    <main>
      <div className="container p-16 text-lg">
        <UI.Heading1>Open Clear Signing Format preview</UI.Heading1>
        <form className="flex flex-col gap-6">
          <SelectMetadataFile
            files={files}
            fileKey={fileKey}
            setFileKey={setFileKey}
          />
          <PreviewForm
            data={data}
            selectedDevice={selectedDevice}
            setSelectedDevice={setSelectedDevice}
          />
        </form>
      </div>

      <DevicesDemo data={data} />

      <pre className="container p-16">{JSON.stringify(data, null, 2)}</pre>
    </main>
  );
}
