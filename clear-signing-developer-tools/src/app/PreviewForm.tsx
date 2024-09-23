import { type Dispatch, type SetStateAction } from "react";
import { UI } from "~/app/UI";

export const PreviewForm = ({
  selectedDevice,
  setSelectedDevice,
}: {
  selectedDevice: string;
  setSelectedDevice: Dispatch<SetStateAction<string>>;
}) => {
  const onChangeDevice = ({ target }: React.ChangeEvent<HTMLSelectElement>) => {
    const selection = target.value;
    localStorage.setItem("selectedDevice", selection);
    setSelectedDevice(selection);
  };

  return (
    <form className="flex flex-col gap-6">
      <div>
        <UI.HeadingField>Contract</UI.HeadingField>
        <div>
          Uniswap_V3 (<UI.BlueLink href="#">0x4c…cbe9de5</UI.BlueLink>)
        </div>
      </div>
      <div>
        <UI.HeadingField>Function</UI.HeadingField>
        <div>
          swap_1: “Swap with Uniswap (
          <UI.BlueLink href="#">0xfc6f7865</UI.BlueLink>)
        </div>
      </div>
      <div>
        <UI.HeadingField>Preview example</UI.HeadingField>
        <UI.Select onChange={() => null}>
          <UI.Option value="">tx1 (0xbe936…e403e7b62)</UI.Option>
        </UI.Select>
      </div>
      <div>
        <UI.HeadingField>Preview on</UI.HeadingField>
        <UI.Select defaultValue={selectedDevice} onChange={onChangeDevice}>
          <option value="flex">Ledger Flex</option>
          <option value="stax">Ledger Stax</option>
        </UI.Select>
      </div>
    </form>
  );
};
