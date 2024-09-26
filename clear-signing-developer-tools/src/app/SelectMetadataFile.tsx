import { type Dispatch, type SetStateAction } from "react";
import { UI } from "~/app/UI";

export const SelectMetadataFile = ({
  fileKey,
  jsonInRegistry,
  setFileKey,
}: {
  fileKey: string;
  jsonInRegistry: string[];
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
