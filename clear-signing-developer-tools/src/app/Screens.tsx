import { Device } from "~/app/Device";
import {
  getScreensForOperation,
  type Screen,
} from "~/app/getScreensForOperation";
import { type Operation } from "~/types/PreviewData";

const IntroScreen = ({
  owner,
  totalPages,
  type,
}: {
  owner: string;
  totalPages: number;
  type: string;
}) => (
  <Device.Frame>
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

    <Device.Pagination current={1} total={totalPages} />
  </Device.Frame>
);

const InfoScreen = ({
  address,
  info: { lastUpdate, legalName, url },
}: {
  address: string;
  info: { lastUpdate: string; legalName: string; url: string };
}) => (
  <Device.Frame>
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
  </Device.Frame>
);

const ReviewScreens = ({
  totalPages,
  screens,
}: {
  totalPages: number;
  screens: Screen[];
}) => {
  return (
    <>
      {screens.map((display, index) => (
        <Device.Frame key={`display-${index}`}>
          <>
            {display.map(({ label, displayValue }) => (
              <div key={label}>
                <Device.Label>{label}</Device.Label>
                <Device.Value>{displayValue}</Device.Value>
              </div>
            ))}
            <Device.Pagination current={index + 2} total={totalPages} />
          </>
        </Device.Frame>
      ))}
    </>
  );
};

const SignScreen = ({
  owner,
  totalPages,
  type,
}: {
  owner: string;
  totalPages: number;
  type: string;
}) => (
  <Device.Frame>
    {`Sign ${type} from ${owner}?`}
    <>
      <Device.Pagination current={totalPages} total={totalPages} />
    </>
  </Device.Frame>
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
  const screens = getScreensForOperation(chosenOperation);
  const totalPages = screens.length + 2;

  return (
    <>
      <IntroScreen owner={owner} totalPages={totalPages} type={operationType} />
      <InfoScreen info={info} address={contractAddress} />
      <ReviewScreens totalPages={totalPages} screens={screens} />
      <SignScreen owner={owner} totalPages={totalPages} type={operationType} />
    </>
  );
};
