import { Device } from "~/app/Device";
import { DeviceContext } from "~/app/DeviceContext";
import { transformOperationIntoDisplays } from "~/app/transformOperationIntoDisplays";
import {
  type Operation,
  type Deploymnent,
  type PreviewData,
} from "~/types/PreviewData";

const ReviewIntro = ({ owner, type }: { owner: string; type: string }) => (
  <Device.Bezel>
    <Device.Wrapper>
      <Device.Section>
        <Device.Logo />
        <Device.ReviewTitle>{`Review ${type} from ${owner}?`}</Device.ReviewTitle>
        <Device.InfoButton />
        <Device.ReviewSummary>
          {`You're interacting with a smart contract from ${owner}.`}
        </Device.ReviewSummary>
        <Device.TapToContinue />
      </Device.Section>
      <Device.Section>
        <Device.RejectButton />
      </Device.Section>
    </Device.Wrapper>
  </Device.Bezel>
);

const ContractInformation = ({
  address,
  info: { lastUpdate, legalName, url },
}: {
  address: string;
  info: { lastUpdate: string; legalName: string; url: string };
}) => (
  <Device.Bezel>
    <Device.Wrapper>
      <Device.Section>
        <Device.BackHeader>Smart contract information</Device.BackHeader>
      </Device.Section>
      <Device.Section>
        <Device.Action>Contract owner</Device.Action>
        <Device.Content>{legalName}</Device.Content>
        <Device.Content>{url}</Device.Content>
      </Device.Section>
      <Device.Section>
        <Device.Action>Last updated</Device.Action>
        <Device.Content>{new Date(lastUpdate).toDateString()}</Device.Content>
      </Device.Section>
      <Device.Section>
        <Device.Action>Contract address</Device.Action>
        <Device.Content>{address}</Device.Content>
      </Device.Section>
    </Device.Wrapper>
  </Device.Bezel>
);

const FieldsToReview = ({ operation }: { operation: Operation }) => {
  const displays = transformOperationIntoDisplays(operation, "flex");

  return displays.map((display, index) => (
    <Device.Bezel key={`display-${index}`}>
      <Device.Wrapper>
        {display.map(({ label, displayValue }) => (
          <div key={label}>
            <Device.Label>{label}</Device.Label>
            <Device.Value>{displayValue}</Device.Value>
          </div>
        ))}
      </Device.Wrapper>
    </Device.Bezel>
  ));
};

const HoldToSign = ({ owner, type }: { owner: string; type: string }) => (
  <Device.Bezel>
    <Device.Wrapper>{`Sign ${type} from ${owner}?`}</Device.Wrapper>
  </Device.Bezel>
);

interface Props {
  data: PreviewData;
  selectedDevice: string;
}

export const DevicesDemo = ({ data, selectedDevice }: Props) => {
  const {
    contract,
    type,
    metadata: { owner, info },
    operations,
  } = data;

  const chosenOperation = operations[0]; // TODO: handle multiple operations
  const chosenDeployment = contract.deployments[0] as unknown; // TODO: handle multiple deployments
  if (!chosenOperation || !chosenDeployment) return null;

  const { address } = chosenDeployment as Deploymnent;
  return (
    <>
      <DeviceContext.Provider value={selectedDevice}>
        <div className="overflow-x-scroll bg-[#383838] p-16">
          <div className="flex w-fit space-x-10 pe-16 font-inter text-sm">
            <ReviewIntro owner={owner} type={type} />
            <ContractInformation info={info} address={address} />
            <FieldsToReview operation={chosenOperation} />
            <HoldToSign owner={owner} type={type} />
          </div>
        </div>
      </DeviceContext.Provider>
    </>
  );
};
