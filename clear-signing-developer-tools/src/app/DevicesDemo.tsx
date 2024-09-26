import { Flex } from "~/app/Flex";
import { transformOperationIntoDisplays } from "~/app/transformOperationIntoDisplays";
import {
  type Operation,
  type Deploymnent,
  type PreviewData,
} from "~/types/PreviewData";

const ReviewIntro = ({ owner, type }: { owner: string; type: string }) => (
  <Flex.Bezel>
    <Flex.Wrapper>
      <Flex.Section>
        <Flex.Logo />
        <Flex.ReviewTitle>{`Review ${type} from ${owner}?`}</Flex.ReviewTitle>
        <Flex.InfoButton />
        <Flex.ReviewSummary>
          {`You're interacting with a smart contract from ${owner}.`}
        </Flex.ReviewSummary>
        <Flex.TapToContinue />
      </Flex.Section>
      <Flex.Section>
        <Flex.RejectButton />
      </Flex.Section>
    </Flex.Wrapper>
  </Flex.Bezel>
);

const ContractInformation = ({
  address,
  info: { lastUpdate, legalName, url },
}: {
  address: string;
  info: { lastUpdate: string; legalName: string; url: string };
}) => (
  <Flex.Bezel>
    <Flex.Wrapper>
      <Flex.Section>
        <Flex.BackHeader>Smart contract information</Flex.BackHeader>
      </Flex.Section>
      <Flex.Section>
        <Flex.Action>Contract owner</Flex.Action>
        <Flex.Content>{legalName}</Flex.Content>
        <Flex.Content>{url}</Flex.Content>
      </Flex.Section>
      <Flex.Section>
        <Flex.Action>Last updated</Flex.Action>
        <Flex.Content>{new Date(lastUpdate).toDateString()}</Flex.Content>
      </Flex.Section>
      <Flex.Section>
        <Flex.Action>Contract address</Flex.Action>
        <Flex.Content>{address}</Flex.Content>
      </Flex.Section>
    </Flex.Wrapper>
  </Flex.Bezel>
);

const FieldsToReview = ({ operation }: { operation: Operation }) => {
  const displays = transformOperationIntoDisplays(operation, "flex");

  return displays.map(({ displayValue, label }) => (
    <Flex.Bezel key={label}>
      <Flex.Wrapper>
        <Flex.Label>{label}</Flex.Label>
        <Flex.Value>{displayValue}</Flex.Value>
      </Flex.Wrapper>
    </Flex.Bezel>
  ));
};

const HoldToSign = ({ owner, type }: { owner: string; type: string }) => (
  <Flex.Bezel>
    <Flex.Wrapper>{`Sign ${type} from ${owner}?`}</Flex.Wrapper>
  </Flex.Bezel>
);

interface Props {
  data: PreviewData;
  selectedDevice: string;
}

export const DevicesDemo = ({ data }: Props) => {
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
      <div className="overflow-x-scroll bg-[#383838] p-16">
        <div className="flex w-fit space-x-10 pe-16 font-inter text-sm">
          <ReviewIntro owner={owner} type={type} />
          <ContractInformation info={info} address={address} />
          <FieldsToReview operation={chosenOperation} />
          <HoldToSign owner={owner} type={type} />
        </div>
      </div>

      <pre className="container p-16">{JSON.stringify(data, null, 2)}</pre>
    </>
  );
};
