import { type Dispatch, type SetStateAction } from "react";
import { UI } from "~/app/UI";
import { type ERC7730Schema } from "~/types";

export const SelectMetadataFile = ({
  files,
  fileKey,
  setFileKey,
}: {
  files: Record<string, ERC7730Schema>;
  fileKey: string;
  setFileKey: Dispatch<SetStateAction<string>>;
}) => {
  const onChangeFile = ({ target }: React.ChangeEvent<HTMLSelectElement>) => {
    const selection = target.value;
    localStorage.setItem("selectedFileKey", selection);
    setFileKey(selection);
  };

  return (
    <div>
      <UI.HeadingField>Metadata file</UI.HeadingField>
      <UI.Select defaultValue={fileKey} onChange={onChangeFile}>
        {Object.keys(files).map((key) => (
          <option key={key} value={key}>
            {key}
          </option>
        ))}
      </UI.Select>
    </div>
  );
};
