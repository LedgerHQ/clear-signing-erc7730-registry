import { type Dispatch, type SetStateAction } from "react";
import { formatShortAddress } from "~/app/formatShortAddress";
import { UI } from "~/app/UI";
import { type PreviewData } from "~/types/PreviewData";

export const PreviewForm = ({
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
    <>
      <div>
        <UI.HeadingField>Contract</UI.HeadingField>
        <div>
          {data.contract.id} (
          <UI.BlueLink
            href={`https://etherscan.io/address/${data.contract.address}`}
            title={data.contract.address}
            target="_blank"
          >
            {formatShortAddress(data.contract.address)}
          </UI.BlueLink>
          )
        </div>
      </div>
      <div>
        <UI.HeadingField>Operation</UI.HeadingField>
        <UI.Select onChange={() => null}>
          {data.operations.map(({ intent }) => (
            <UI.Option key={intent} value={intent}>
              {intent}
            </UI.Option>
          ))}
        </UI.Select>
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
    </>
  );
};
