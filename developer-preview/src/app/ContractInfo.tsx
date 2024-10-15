import { UI } from "~/ui/UI";
import { type PreviewData } from "~/types/PreviewData";
import { formatShortAddress } from "~/app/formatShortAddress";

export const ContractInfo = ({ data }: { data: PreviewData }) => {
  if (data.contract.deployments.length === 0) {
    return <UI.FauxInput error>No deployments found</UI.FauxInput>;
  }

  const uniqueAddresses = Array.from(
    new Set(data.contract.deployments.map(({ address }) => address)),
  );

  return (
    <div>
      <UI.FauxInput>
        <div className="flex items-center justify-between">
          <UI.InputText>{data.contract.name}</UI.InputText>

          <div className="flex gap-5">
            {uniqueAddresses.map((address: string) => (
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
        </div>
      </UI.FauxInput>
    </div>
  );
};
