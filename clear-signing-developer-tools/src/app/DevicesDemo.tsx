import { type ReactNode } from "react";
import { type PreviewData } from "~/types/PreviewData";

const Screen = {
  BackHeader: ({ children }: { children: string }) => (
    <div className="flex p-1">
      <div> &lt;--</div>
      <div className="text-center font-medium">{children}</div>
    </div>
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

const ReviewIntro = ({
  intent,
  legalName,
}: {
  intent: string;
  legalName: string;
}) => (
  <Screen.Wrapper>
    <Screen.Section>
      <Screen.Logo />
      <Screen.ReviewTitle>{`Review ${intent}?`}</Screen.ReviewTitle>
      <Screen.InfoButton />
      <Screen.ReviewSummary>
        {`You're interacting with a smart contract from ${legalName}.`}
      </Screen.ReviewSummary>
      <Screen.TapToContinue />
    </Screen.Section>
    <Screen.Section>
      <Screen.RejectButton />
    </Screen.Section>
  </Screen.Wrapper>
);

const ContractInformation = () => (
  <Screen.Wrapper>
    <Screen.Section>
      <Screen.BackHeader>Smart contract information</Screen.BackHeader>
    </Screen.Section>
  </Screen.Wrapper>
);

const FieldsReview = () => (
  <Screen.Wrapper>
    <Screen.Label>Send</Screen.Label>
    <Screen.Value>2.325196105098179072 ETH</Screen.Value>
  </Screen.Wrapper>
);

const HoldToSign = () => (
  <Screen.Wrapper>Sign swap transaction with Uniswap?</Screen.Wrapper>
);

export const DevicesDemo = ({
  data: {
    intent,
    metadata: {
      info: { legalName },
    },
  },
}: {
  data: PreviewData;
}) => (
  <div className="flex w-fit space-x-10 bg-neutral-200 p-16 font-inter text-sm">
    <StaxDisplay>
      <ReviewIntro intent={intent} legalName={legalName} />
    </StaxDisplay>

    <StaxDisplay>
      <ContractInformation />
    </StaxDisplay>

    <StaxDisplay>
      <FieldsReview />
    </StaxDisplay>

    <StaxDisplay>
      <FieldsReview />
    </StaxDisplay>

    <StaxDisplay>
      <HoldToSign />
    </StaxDisplay>
  </div>
);
