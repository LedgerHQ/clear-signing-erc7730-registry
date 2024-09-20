import { type ReactNode } from "react";

const Device = {
  BackHeader: ({ children }: { children: string }) => (
    <div>&lt;-- {children}</div>
  ),
  InfoButton: () => <div>InfoButton</div>,
  Label: ({ children }: { children: string }) => <div>{children}</div>,

  Logo: () => <div>Logo</div>,
  RejectButton: () => <div>RejectButton</div>,
  ReviewSummary: ({ children }: { children: string }) => <div>{children}</div>,
  ReviewTitle: ({ children }: { children: string }) => <div>{children}</div>,
  Screen: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TapToContinue: () => <div>TapToContinue</div>,
  Value: ({ children }: { children: string }) => <div>{children}</div>,
};

const StaxDisplay = ({ children }: { children: ReactNode }) => (
  <div className="h-[342px] w-[220px] rounded-xl rounded-l-none border-8 border-l-0 border-black bg-white">
    {children}
  </div>
);

const ReviewIntro = () => (
  <Device.Screen>
    <Device.Logo />
    <Device.ReviewTitle>Review swap with Uniswap?</Device.ReviewTitle>
    <Device.InfoButton />
    <Device.ReviewSummary>
      You&apos;re interacting with a smart contract from Uniswap Labs.
    </Device.ReviewSummary>
    <Device.TapToContinue />
    <Device.RejectButton />
  </Device.Screen>
);

const ContractInformation = () => (
  <div>
    <Device.BackHeader>Smart contract information</Device.BackHeader>
  </div>
);

const FieldsReview = () => (
  <div>
    <Device.Label>Send</Device.Label>
    <Device.Value>2.325196105098179072 ETH</Device.Value>
  </div>
);

const HoldToSign = () => <div>Sign swap transaction with Uniswap?</div>;

export const DevicesDemo = () => (
  <div className="flex w-fit space-x-10 bg-neutral-200 p-16">
    <StaxDisplay>
      <ReviewIntro />
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
