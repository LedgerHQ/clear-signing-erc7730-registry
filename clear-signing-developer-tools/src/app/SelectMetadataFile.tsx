import { type Dispatch, type SetStateAction } from "react";
import { UI } from "~/app/UI";
import { type ERC7730Schema } from "~/types";
import { type PreviewData } from "~/types/PreviewData";
import { getPreviewData } from "~/utils/getPreviewData";

export const SelectMetadataFile = ({
  fileKey,
  jsonInRegistry,
  setPreviewData,
  setFileKey,
}: {
  fileKey: string;
  jsonInRegistry: string[];
  setPreviewData: Dispatch<SetStateAction<PreviewData | null>>;
  setFileKey: Dispatch<SetStateAction<string>>;
}) => {
  const onChangeFile = ({ target }: React.ChangeEvent<HTMLSelectElement>) => {
    const selection = target.value;

    fetch("http://localhost:3000/api/file/?label=" + selection)
      .then((res) => {
        res
          .json()
          .then((metadata: ERC7730Schema | null) => {
            if (metadata) {
              const previewData = getPreviewData(metadata);
              console.log("previewData:", previewData);
              setPreviewData(previewData);
              localStorage.setItem("selectedFileKey", selection);
              setFileKey(selection);
            }
          })
          .catch((error) => {
            console.error("Error:", error);
          });
      })
      .catch((error) => {
        console.error("Error:", error);
      });
  };

  return (
    <div>
      <UI.HeadingField>Metadata file</UI.HeadingField>
      <UI.Select defaultValue={fileKey} onChange={onChangeFile}>
        {jsonInRegistry.map((key) => (
          <option key={key} value={key} disabled={disabled(key)}>
            {key}
          </option>
        ))}
      </UI.Select>
    </div>
  );
};

function disabled(key: string): boolean | undefined {
  return key === "eip712-UniswapX-ExclusiveDutchOrder.json";
}
