import { Device } from "~/app/Device";
import { getScreensForOperation } from "~/app/getScreensForOperation";
import { type Operation } from "~/types/PreviewData";

const IntroScreen = ({ owner, type }: { owner: string; type: string }) => (
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

const InfoScreen = ({
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

const ReviewScreens = ({ operation }: { operation: Operation }) => {
  const displays = getScreensForOperation(operation);

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

const SignScreen = ({ owner, type }: { owner: string; type: string }) => (
  <Device.Bezel>
    <Device.Wrapper>{`Sign ${type} from ${owner}?`}</Device.Wrapper>
  </Device.Bezel>
);

interface Props {
  contractAddress: string;
  chosenOperation: Operation;
  info: { lastUpdate: string; legalName: string; url: string };
  owner: string;
  operationType: string;
}

export const Screens = ({
  contractAddress,
  chosenOperation,
  info,
  owner,
  operationType,
}: Props) => {
  return (
    <>
      <IntroScreen owner={owner} type={operationType} />
      <InfoScreen info={info} address={contractAddress} />
      <ReviewScreens operation={chosenOperation} />
      <SignScreen owner={owner} type={operationType} />
    </>
  );
};
