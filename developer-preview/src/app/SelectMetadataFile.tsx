import { type Dispatch, type SetStateAction } from "react";
import { UI } from "~/ui/UI";

export const SelectMetadataFile = ({
  fileKey,
  jsonInRegistry,
  setFileKey,
}: {
  fileKey: string;
  jsonInRegistry: string[];
  setFileKey: Dispatch<SetStateAction<string>>;
}) => {
  const onChangeFile = (value: string) => {
    localStorage.setItem("selectedFileKey", value);
    setFileKey(value);
  };

  return (
    <div>
      <UI.Label>Metadata file</UI.Label>
      <UI.Select
        value={fileKey}
        onChange={onChangeFile}
        items={jsonInRegistry}
        placeholder="Metadata file"
      />
    </div>
  );
};
