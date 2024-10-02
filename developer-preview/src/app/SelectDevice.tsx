import { type Dispatch, type SetStateAction } from "react";
import { UI } from "~/ui/UI";

export const SelectDevice = ({
  selectedDevice,
  setSelectedDevice,
}: {
  selectedDevice: "flex" | "stax";
  setSelectedDevice: Dispatch<SetStateAction<"flex" | "stax">>;
}) => {
  const onChangeDevice = (selection: string) => {
    localStorage.setItem("selectedDevice", selection);
    if (selection === "flex" || selection === "stax") {
      setSelectedDevice(selection);
    }
  };

  return (
    <UI.Select
      fullWidth={false}
      items={[
        { value: "flex", label: "Ledger Flex" },
        { value: "stax", label: "Ledger Stax" },
      ]}
      onChange={onChangeDevice}
      placeholder="Device"
      value={selectedDevice}
    ></UI.Select>
  );
};
