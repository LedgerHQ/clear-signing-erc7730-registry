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
    label: intent + (id && ` (${id})`),
  }));

  const value = items.some(({ value }) => value === selectedOperation)
    ? selectedOperation
    : (items[0]?.value ?? "");

  return (
    <div>
      <UI.Label>Operation</UI.Label>
      <UI.Select
        items={items}
        onChange={onChangeOperation}
        placeholder="Operation"
        value={value}
      ></UI.Select>
    </div>
  );
};
