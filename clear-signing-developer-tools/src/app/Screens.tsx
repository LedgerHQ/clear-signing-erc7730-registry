import { Device } from "~/app/Device";
import {
  getScreensForOperation,
  type Screen,
} from "~/app/getScreensForOperation";
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

const ReviewScreens = ({
  pageTotal,
  screens,
}: {
  pageTotal: number;
  screens: Screen[];
}) => {
  return (
    <>
      {screens.map((display, index) => (
        <Device.Bezel key={`display-${index}`}>
          <Device.Wrapper>
            <>
              {display.map(({ label, displayValue }) => (
                <div key={label}>
                  <Device.Label>{label}</Device.Label>
                  <Device.Value>{displayValue}</Device.Value>
                </div>
              ))}
              <Device.Pagination current={index + 1} total={pageTotal} />
            </>
          </Device.Wrapper>
        </Device.Bezel>
      ))}
    </>
  );
};

const SignScreen = ({
  owner,
  pageTotal,
  type,
}: {
  owner: string;
  pageTotal: number;
  type: string;
}) => (
  <Device.Bezel>
    <Device.Wrapper>
      {`Sign ${type} from ${owner}?`}
      <>
        <Device.Pagination current={pageTotal} total={pageTotal} />
      </>
    </Device.Wrapper>
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
  const screens = getScreensForOperation(chosenOperation);
  const pageTotal = screens.length + 1;

  return (
    <>
      <IntroScreen owner={owner} type={operationType} />
      <InfoScreen info={info} address={contractAddress} />
      <ReviewScreens pageTotal={pageTotal} screens={screens} />
      <SignScreen owner={owner} pageTotal={pageTotal} type={operationType} />
    </>
  );
};
