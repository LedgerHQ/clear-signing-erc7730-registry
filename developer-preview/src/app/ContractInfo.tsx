import { UI } from "~/ui/UI";
import { type Deploymnent, type PreviewData } from "~/types/PreviewData";
import { formatShortAddress } from "~/app/formatShortAddress";

export const ContractInfo = ({ data }: { data: PreviewData }) => {
  if (data.contract.deployments.length === 0) {
    return <UI.FauxInput error>No deployments found</UI.FauxInput>;
  }

  return (
    <div>
      <UI.FauxInput>
        <div className="flex items-center justify-between">
          <UI.InputText>{data.contract.name}</UI.InputText>

          {data.contract.deployments.map(({ address }: Deploymnent) => (
            <UI.GreyLink
              href={`https://etherscan.io/address/${address}`}
              key={address}
              title={address}
              target="_blank"
            >
              {formatShortAddress(address)}
            </UI.GreyLink>
          ))}
        </div>
      </UI.FauxInput>
    </div>
  );
};
