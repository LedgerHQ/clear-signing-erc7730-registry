import { formatShortAddress } from "~/app/formatShortAddress";
import { UI } from "~/app/UI";
import { type Deploymnent, type PreviewData } from "~/types/PreviewData";

export const ContractInfo = ({ data }: { data: PreviewData }) => {
  return (
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
  );
};
