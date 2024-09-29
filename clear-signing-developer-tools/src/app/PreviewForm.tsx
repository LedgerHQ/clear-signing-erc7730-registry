import { type Dispatch, type SetStateAction } from "react";
import { formatShortAddress } from "~/app/formatShortAddress";
import { UI } from "~/app/UI";
import { type Deploymnent, type PreviewData } from "~/types/PreviewData";

export const PreviewForm = ({
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
    <>
      <div>
        <UI.HeadingField>Contract</UI.HeadingField>
        <div>
          {data.contract.name}
          {data.contract.deployments.map(({ address }: Deploymnent) => (
            <span key={address}>
              {" "}
              (
              <UI.BlueLink
                href={`https://etherscan.io/address/${address}`}
                title={address}
                target="_blank"
              >
                {formatShortAddress(address)}
              </UI.BlueLink>
              )
            </span>
          ))}
        </div>
      </div>
      <div>
        <UI.HeadingField>Operation</UI.HeadingField>
        <UI.Select
          defaultValue={selectedOperation}
          onChange={onChangeOperation}
        >
          {data.operations.map(({ intent }, index) => (
            <UI.Option
              key={`${data.contract.name}${intent}${index}`}
              value={intent}
            >
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
    </>
  );
};
