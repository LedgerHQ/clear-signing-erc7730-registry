import { type Dispatch, type SetStateAction } from "react";
import { UI } from "~/app/UI";
import { type PreviewData } from "~/types/PreviewData";

export const SelectDevice = ({
  data,
  selectedDevice,
  setSelectedDevice,
}: {
  data: PreviewData;
  selectedDevice: string;
  setSelectedDevice: Dispatch<SetStateAction<string>>;
}) => {
  const onChangeDevice = ({ target }: React.ChangeEvent<HTMLSelectElement>) => {
    const selection = target.value;
    localStorage.setItem("selectedDevice", selection);
    setSelectedDevice(selection);
  };

  return (
    <div>
      <UI.HeadingField>Preview on</UI.HeadingField>
      <UI.Select defaultValue={selectedDevice} onChange={onChangeDevice}>
        <option value="flex">Ledger Flex</option>
        <option value="stax">Ledger Stax</option>
      </UI.Select>
    </div>
  );
};
