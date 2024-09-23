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
        <UI.HeadingField>Metadata file</UI.HeadingField>
        <UI.Select onChange={() => null}>
          <option value="calldata-PoapBridge">calldata-PoapBridge.json</option>
        </UI.Select>
      </div>
      <div>
        <UI.HeadingField>Contract</UI.HeadingField>
        <div>
          PoapBridge (
          <UI.BlueLink
            href="https://etherscan.io/address/0x0bb4d3e88243f4a057db77341e6916b0e449b158"
            target="_blank"
          >
            0x0b…449b158
          </UI.BlueLink>
          )
        </div>
      </div>
      <div>
        <UI.HeadingField>Function</UI.HeadingField>
        <div>
          mintToken: &quot;Mint POAP&quot; (
          <UI.BlueLink
            href="https://etherscan.io/address/0x0bb4d3e88243f4a057db77341e6916b0e449b158#writeContract#F1"
            target="_blank"
          >
            0xaf68b302
          </UI.BlueLink>
          )
        </div>
      </div>
      <div>
        <UI.HeadingField>Preview with</UI.HeadingField>
        <UI.Select disabled onChange={() => null}>
          <UI.Option value="">Placeholder values</UI.Option>
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
