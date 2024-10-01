import { type Dispatch, type SetStateAction } from "react";
import { UI } from "~/app/UI";

export const SelectDevice = ({
  selectedDevice,
  setSelectedDevice,
}: {
  selectedDevice: "flex" | "stax";
  setSelectedDevice: Dispatch<SetStateAction<"flex" | "stax">>;
}) => {
  const onChangeDevice = ({ target }: React.ChangeEvent<HTMLSelectElement>) => {
    const selection = target.value;
    localStorage.setItem("selectedDevice", selection);
    if (selection === "flex" || selection === "stax") {
      setSelectedDevice(selection);
    }
  };

  return (
    <UI.Select defaultValue={selectedDevice} onChange={onChangeDevice}>
      <option value="flex">Ledger Flex</option>
      <option value="stax">Ledger Stax</option>
    </UI.Select>
  );
};
