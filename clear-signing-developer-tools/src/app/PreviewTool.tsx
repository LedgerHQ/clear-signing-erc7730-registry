"use client";

import { useEffect, useState } from "react";
import { DevicesDemo } from "~/app/DevicesDemo";
import { PreviewForm } from "~/app/PreviewForm";
import { UI } from "~/app/UI";
import { SelectMetadataFile } from "~/app/SelectMetadataFile";

import { type PreviewData } from "~/types/PreviewData";
import { getPreviewData } from "~/utils/getPreviewData";
import { type ERC7730Schema } from "~/types";

interface Props {
  jsonInRegistry: string[];
}

export default function PreviewTool({ jsonInRegistry }: Props) {
  const [mounted, setMounted] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState("");
  const [fileKey, setFileKey] = useState("");
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    setMounted(true);
    setSelectedDevice(localStorage.getItem("selectedDevice") ?? "stax");
    setFileKey(
      localStorage.getItem("selectedFileKey") ?? "calldata-PoapBridge.json",
    );
  }, []);

  useEffect(() => {
    if (fileKey) {
      fetch("http://localhost:3000/api/file/?label=" + fileKey)
        .then((res) => {
          res
            .json()
            .then((metadata: ERC7730Schema | null) => {
              if (!metadata) {
                setPreviewData(null);
                return;
              }

              const { data, error } = getPreviewData(metadata);
              if (error) {
                setPreviewData(null);
                setErrorMessage(error);
              } else {
                setErrorMessage("");
                setPreviewData(data);
              }
            })
            .catch((error) => {
              console.log("Error parsing JSON: ", error);
            });
        })
        .catch((error) => {
          console.error("Error fetching file: ", error);
          setPreviewData(null);
        });
    }
  }, [fileKey]);

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
        {errorMessage && <UI.Error>{errorMessage}</UI.Error>}
      </div>

      {previewData && (
        <DevicesDemo data={previewData} selectedDevice={selectedDevice} />
      )}
    </main>
  );
}
