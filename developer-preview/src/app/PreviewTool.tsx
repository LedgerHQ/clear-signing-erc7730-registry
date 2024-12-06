"use client";

import { type Dispatch, type SetStateAction, useEffect, useState } from "react";
import { ContractInfo } from "~/app/ContractInfo";
import { UI } from "~/ui/UI";
import { SelectMetadataFile } from "~/app/SelectMetadataFile";

import { type PreviewData } from "~/types/PreviewData";
import { getPreviewData } from "~/lib/getPreviewData";
import { type ERC7730Schema } from "~/types/ERC7730Schema";
import { SelectDevice } from "~/app/SelectDevice";
import { SelectOperation } from "~/app/SelectOperation";
import { SelectValues } from "~/app/SelectValues";
import { DevicesDemoInteractive } from "./DevicesDemoInteractive";

interface Props {
  jsonInRegistry: string[];
}

export default function PreviewTool({ jsonInRegistry }: Props) {
  const [mounted, setMounted] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<"flex" | "stax">("flex");
  const [selectedOperation, setSelectedOperation] = useState("");
  const [fileKey, setFileKey] = useState("");
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    setMounted(true);

    const operation =
      localStorage.getItem("selectedOperation") ??
      previewData?.operations[0]?.id ??
      "";

    setSelectedOperation(operation);

    const storedDevice = localStorage.getItem("selectedDevice");
    if (storedDevice === "flex" || storedDevice === "stax") {
      setSelectedDevice(storedDevice);
    }
    setFileKey(
      localStorage.getItem("selectedFileKey") ?? "calldata-PoapBridge.json",
    );
  }, [previewData?.operations]);

  useEffect(() => {
    if (fileKey) {
      fetchPreviewData(fileKey, setPreviewData, setErrorMessage);

      const interval = setInterval(() => {
        fetchPreviewData(fileKey, setPreviewData, setErrorMessage);
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [fileKey]);

  if (!mounted) {
    return null;
  }

  return (
    <>
      <div className="border-b border-[#fff2] bg-[#fff1] text-tool-neutral-70 antialiased">
        <UI.Container as="header" className="flex justify-between">
          <UI.Heading1>Open Clear Signing Format preview</UI.Heading1>
          <div className="flex gap-4">
            <UI.ButtonLink
              href="https://github.com/LedgerHQ/clear-signing-erc7730-registry/blob/master/specs/erc-7730.md"
              target="_blank"
            >
              Whitepaper
            </UI.ButtonLink>
            <UI.ButtonLink
              href="https://developers.ledger.com/docs/clear-signing/erc7730"
              target="_blank"
            >
              View documentation
            </UI.ButtonLink>
          </div>
        </UI.Container>

        <UI.Container className="grid grid-cols-3 gap-3">
          <SelectMetadataFile
            fileKey={fileKey}
            jsonInRegistry={jsonInRegistry}
            setFileKey={setFileKey}
          />

          {errorMessage && (
            <div className="col-span-2 row-start-2">
              <UI.FauxInput error>{errorMessage}</UI.FauxInput>
            </div>
          )}

          {previewData && (
            <>
              <SelectValues />
              <SelectOperation
                data={previewData}
                selectedOperation={selectedOperation}
                setSelectedOperation={setSelectedOperation}
              />
              <div className="col-span-3">
                <ContractInfo data={previewData} />
              </div>
            </>
          )}
        </UI.Container>
      </div>

      {previewData && (
        <>
          <div className="bg-tool-background">
            <UI.Container>
              <SelectDevice
                selectedDevice={selectedDevice}
                setSelectedDevice={setSelectedDevice}
              />
            </UI.Container>
            <DevicesDemoInteractive
              data={previewData}
              selectedDevice={selectedDevice}
              selectedOperation={selectedOperation}
            />
          </div>
        </>
      )}
    </>
  );
}

function fetchPreviewData(
  fileKey: string,
  setPreviewData: Dispatch<SetStateAction<PreviewData | null>>,
  setErrorMessage: Dispatch<SetStateAction<string>>,
) {
  fetch("/api/file/?label=" + fileKey)
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
