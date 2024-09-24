"use client";

import { useEffect, useState } from "react";
import { DevicesDemo } from "~/app/DevicesDemo";
import { PreviewForm } from "~/app/PreviewForm";
import { UI } from "~/app/UI";
import { getPreviewData } from "~/utils/getPreviewData";
import poapMetaDataFile from "../../../registry/poap/calldata-PoapBridge.json";
import { type ERC7730Schema } from "~/types";
import { calculateScreensForDevice } from "~/app/calculateScreensForDevice";

export default function HomePage() {
  const [mounted, setMounted] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState("");

  useEffect(() => {
    setMounted(true);
    setSelectedDevice(localStorage.getItem("selectedDevice") ?? "stax");
  }, []);

  if (!mounted) {
    return null;
  }

  const metaDataFile = poapMetaDataFile as unknown as ERC7730Schema;
  const previewData = getPreviewData(metaDataFile);
  const data = calculateScreensForDevice(selectedDevice, previewData);

  return (
    <main>
      <div className="container p-16 text-lg">
        <UI.Heading1>Open Clear Signing Format preview</UI.Heading1>
        <PreviewForm
          data={data}
          selectedDevice={selectedDevice}
          setSelectedDevice={setSelectedDevice}
        />
      </div>
      <DevicesDemo data={data} />
      <pre className="container p-16">
        {JSON.stringify(getPreviewData(metaDataFile), null, 2)}
      </pre>
    </main>
  );
}
