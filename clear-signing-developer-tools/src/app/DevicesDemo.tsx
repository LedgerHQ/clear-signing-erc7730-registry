import { DeviceContext } from "~/app/DeviceContext";
import { Screens } from "~/app/Screens";
import { type Deploymnent, type PreviewData } from "~/types/PreviewData";

interface Props {
  data: PreviewData;
  selectedDevice: string;
  selectedOperation: string;
}

export const DevicesDemo = ({
  data,
  selectedDevice,
  selectedOperation,
}: Props) => {
  const { contract, metadata, operations, type } = data;

  const chosenOperation =
    operations.find(({ id }) => selectedOperation === id) || operations[0];

  if (!chosenOperation || contract.deployments.length < 1) return null;

  const { address: contractAddress } = contract.deployments[0] as Deploymnent;

  return (
    <>
      <DeviceContext.Provider value={selectedDevice}>
        <div className="overflow-x-scroll bg-[#383838] p-16">
          <div className="flex w-fit space-x-10 pe-16 font-inter text-sm">
            <Screens
              contractAddress={contractAddress}
              chosenOperation={chosenOperation}
              info={metadata.info}
              owner={metadata.owner}
              operationType={type}
            />
          </div>
        </div>
      </DeviceContext.Provider>
    </>
  );
};
