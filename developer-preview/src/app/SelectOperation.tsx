import { type Dispatch, type SetStateAction } from "react";
import { UI } from "~/app/UI";
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
  const onChangeOperation = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selection = e.target.value;
    localStorage.setItem("selectedOperation", selection);
    setSelectedOperation(selection);
  };

  return (
    <div>
      <UI.HeadingField>Operation</UI.HeadingField>
      <UI.Select defaultValue={selectedOperation} onChange={onChangeOperation}>
        {data.operations.map(({ id, intent }) => (
          <UI.Option key={`${data.contract.name}-${id}`} value={id}>
            {intent}
          </UI.Option>
        ))}
      </UI.Select>
    </div>
  );
};
