"use client";

import { useEffect, useState } from "react";
import { DevicesDemo } from "~/app/DevicesDemo";
import { PreviewForm } from "~/app/PreviewForm";
import { UI } from "~/app/UI";
import { SelectMetadataFile } from "~/app/SelectMetadataFile";

import { type PreviewData } from "~/types/PreviewData";

interface Props {
  jsonInRegistry: string[];
}

export default function PreviewTool({ jsonInRegistry }: Props) {
  const [mounted, setMounted] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState("");
  const [fileKey, setFileKey] = useState("calldata-PoapBridge.json");
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);

  useEffect(() => {
    setMounted(true);
    setSelectedDevice(localStorage.getItem("selectedDevice") ?? "stax");
    setFileKey(
      localStorage.getItem("selectedFileKey") ?? "calldata-PoapBridge.json",
    );
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <main>
      <div className="container p-16 text-lg">
        <UI.Heading1>Open Clear Signing Format preview</UI.Heading1>
        <form className="flex flex-col gap-6">
          <SelectMetadataFile
            fileKey={fileKey}
            jsonInRegistry={jsonInRegistry}
            setPreviewData={setPreviewData}
            setFileKey={setFileKey}
          />
          {previewData && (
            <PreviewForm
              data={previewData}
              selectedDevice={selectedDevice}
              setSelectedDevice={setSelectedDevice}
            />
          )}
        </form>
      </div>

      {previewData && (
        <DevicesDemo data={previewData} selectedDevice={selectedDevice} />
      )}
    </main>
  );
}
