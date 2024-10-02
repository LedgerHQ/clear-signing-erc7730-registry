import { type Dispatch, type SetStateAction } from "react";
import { UI } from "~/ui/UI";
import { type PreviewData } from "~/types/PreviewData";

export const SelectOperation = ({
  data,
  selectedOperation,
  setSelectedOperation,
}: {
  data: PreviewData;
  selectedOperation: string;
  setSelectedOperation: Dispatch<SetStateAction<string>>;
}) => {
  const onChangeOperation = (selection: string) => {
    localStorage.setItem("selectedOperation", selection);
    setSelectedOperation(selection);
  };

  const items = data.operations.map(({ id, intent }) => ({
    value: id || intent,
    label: intent,
  }));

  return (
    <div>
      <UI.HeadingField>Operation</UI.HeadingField>
      <UI.Select
        items={items}
        onChange={onChangeOperation}
        placeholder="Operation"
        value={selectedOperation}
      ></UI.Select>
    </div>
  );
};
