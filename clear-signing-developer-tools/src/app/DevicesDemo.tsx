import { type ReactNode } from "react";
import { type DisplayItem, type PreviewData } from "~/types/PreviewData";

// Dimensions of the area to display the fields:
// Stax : 400px x 546px
// Flex : 480px x 464px

// Number of lines for tags & values:
// Stax : 10
// Flex : 9
// If a value exceeds 10 (or 9) lines, it should be automatically truncated with “...” at the end of the last line, along with a “More” button

const Screen = {
  Action: ({ children }: { children: string }) => (
    <div className="font-medium">{children}</div>
  ),
  BackHeader: ({ children }: { children: string }) => (
    <div className="flex p-1">
      <div> &lt;--</div>
      <div className="text-center font-medium">{children}</div>
    </div>
  ),
  Content: ({ children }: { children: string }) => (
    <div className="">{children}</div>
  ),
  InfoButton: () => (
    <div className="h-5 w-5 self-center rounded-full border-2 border-black text-center align-middle text-xs leading-4">
      i
    </div>
  ),
  Label: ({ children }: { children: string }) => <div>{children}</div>,

  Logo: () => <div className="h-3 w-2 self-center bg-black p-4"></div>,
  RejectButton: () => <div className="p-2 text-center">Reject transaction</div>,
  ReviewSummary: ({ children }: { children: string }) => (
    <div className="text-sm">{children}</div>
  ),
  ReviewTitle: ({ children }: { children: string }) => (
    <div className="text-center text-lg font-medium">{children}</div>
  ),
  Section: ({ children }: { children: ReactNode }) => (
    <div className="flex flex-col gap-2 border-b border-neutral-300 px-4 py-1 last:border-0">
      {children}
    </div>
  ),
  TapToContinue: () => (
    <div className="p-1 text-center text-neutral-400">Tap to continue</div>
  ),
  Value: ({ children }: { children: string }) => <div>{children}</div>,
  Wrapper: ({ children }: { children: ReactNode }) => (
    <div className="ml-3 flex flex-col border-l border-neutral-200">
      {children}
    </div>
  ),
};

const StaxDisplay = ({ children }: { children: ReactNode }) => (
  <div className="flex h-[342px] w-[220px] rounded-xl rounded-l-none border-8 border-l-0 border-black bg-white">
    {children}
  </div>
);

const ReviewIntro = ({ owner, type }: { owner: string; type: string }) => (
  <StaxDisplay>
    <Screen.Wrapper>
      <Screen.Section>
        <Screen.Logo />
        <Screen.ReviewTitle>{`Review ${type} from ${owner}?`}</Screen.ReviewTitle>
        <Screen.InfoButton />
        <Screen.ReviewSummary>
          {`You're interacting with a smart contract from ${owner}.`}
        </Screen.ReviewSummary>
        <Screen.TapToContinue />
      </Screen.Section>
      <Screen.Section>
        <Screen.RejectButton />
      </Screen.Section>
    </Screen.Wrapper>
  </StaxDisplay>
);

const ContractInformation = ({
  address,
  info: { lastUpdate, legalName, url },
}: {
  address: string;
  info: { lastUpdate: string; legalName: string; url: string };
}) => (
  <StaxDisplay>
    <Screen.Wrapper>
      <Screen.Section>
        <Screen.BackHeader>Smart contract information</Screen.BackHeader>
      </Screen.Section>
      <Screen.Section>
        <Screen.Action>Contract owner</Screen.Action>
        <Screen.Content>{legalName}</Screen.Content>
        <Screen.Content>{url}</Screen.Content>
      </Screen.Section>
      <Screen.Section>
        <Screen.Action>Last updated</Screen.Action>
        <Screen.Content>{new Date(lastUpdate).toDateString()}</Screen.Content>
      </Screen.Section>
      <Screen.Section>
        <Screen.Action>Contract address</Screen.Action>
        <Screen.Content>{address}</Screen.Content>
      </Screen.Section>
    </Screen.Wrapper>
  </StaxDisplay>
);

const FieldsToReview = ({ displays }: { displays: DisplayItem[] }) =>
  displays.map(({ displayValue, label }) => (
    <StaxDisplay key={label}>
      <Screen.Wrapper>
        <Screen.Label>{label}</Screen.Label>
        <Screen.Value>{displayValue}</Screen.Value>
      </Screen.Wrapper>
    </StaxDisplay>
  ));

const HoldToSign = ({ owner, type }: { owner: string; type: string }) => (
  <StaxDisplay>
    <Screen.Wrapper>{`Sign ${type} from ${owner}?`}</Screen.Wrapper>
  </StaxDisplay>
);

export const DevicesDemo = ({
  data: {
    contract,
    type,
    metadata: { owner, info },
    operations,
  },
}: {
  data: PreviewData;
}) => {
  const chosenOperation = operations[0]; // TODO: handle multiple operations
  const chosenDeployment = contract.deployments[0]; // TODO: handle multiple deployments
  if (!chosenOperation || !chosenDeployment) return null;

  const { address } = chosenDeployment;
  const { displays } = chosenOperation;
  return (
    <div className="overflow-x-scroll bg-[#383838] p-16">
      <div className="flex w-fit space-x-10 pe-16 font-inter text-sm">
        <ReviewIntro owner={owner} type={type} />
        <ContractInformation info={info} address={address} />
        <FieldsToReview displays={displays} />
        <HoldToSign owner={owner} type={type} />
      </div>
    </div>
  );
};
