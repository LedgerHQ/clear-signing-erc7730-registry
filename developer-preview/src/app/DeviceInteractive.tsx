import { useContext, type ReactNode } from "react";
import Image from "next/image";
import { DeviceContext } from "~/app/DeviceContext";
import { Flex } from "~/app/Flex";
import { Stax } from "~/app/Stax";
import { StaxInteractive } from "~/app/StaxInteractive";
import flexInfo from "~/app/screens/assets/flex-info.svg";
import staxInfo from "~/app/screens/assets/stax-info.svg";
import flexSignButton from "~/app/screens/assets/flex-sign-button.svg";
import staxSignButton from "~/app/screens/assets/stax-sign-button.svg";
import { cn } from "~/lib/utils";
import { getIconFor } from "~/app/screens/getIconFor";
import { FlexInteractive } from "./FlexInteractive";

export const Device = {
  ActionText: ({ children }: { children: string }) => {
    const isStax = useContext(DeviceContext) === "stax";

    return (
      <div
        className={cn(
          "font-semibold",
          isStax ? "text-[12px] leading-[16px]" : "text-[14px] leading-[18px]",
        )}
      >
        {children}
      </div>
    );
  },
  ContentText: ({ children }: { children: ReactNode }) => {
    const isStax = useContext(DeviceContext) === "stax";

    return (
      <div
        className={cn(
          "break-words",
          isStax ? "text-[12px] leading-[16px]" : "text-[14px] leading-[18px]",
        )}
      >
        {children}
      </div>
    );
  },
  Frame: ({ children }: { children: ReactNode }) => {
    const isStax = useContext(DeviceContext) === "stax";
    const Component = isStax ? Stax : Flex;

    return (
      <Component.Bezel>
        <div className="flex w-full flex-col justify-between antialiased">
          {children}
        </div>
      </Component.Bezel>
    );
  },
  HeadingText: ({ children }: { children: ReactNode }) => {
    const isStax = useContext(DeviceContext) === "stax";

    return (
      <div
        className={cn(
          "font-medium leading-[20px]",
          isStax ? "text-[16px]" : "text-[18px]",
        )}
      >
        {children}
      </div>
    );
  },
  InfoBlock: ({
    owner,
    onInfoClick,
  }: {
    owner: string;
    onInfoClick?: () => void;
  }) => {
    const isStax = useContext(DeviceContext) === "stax";

    return (
      <div
        className={cn(
          "flex items-center",
          isStax ? "gap-3 p-3" : "gap-4 px-4 py-3",
        )}
      >
        <div>
          <Device.ContentText>
            {`You're interacting with a smart contract from ${owner}.`}
          </Device.ContentText>
        </div>
        <div>
          <div
            className="flex h-[32px] w-[32px] cursor-pointer items-center justify-center rounded-full border border-light-grey"
            onClick={() => onInfoClick?.()}
          >
            {isStax ? (
              <Image src={staxInfo} alt="More info" width={16} height={16} />
            ) : (
              <Image src={flexInfo} alt="More info" width={20} height={20} />
            )}
          </div>
        </div>
      </div>
    );
  },
  Icon: ({ bgUrl }: { bgUrl: string }) => (
    <div
      className={cn("h-[32px] w-[32px] self-center bg-contain bg-no-repeat")}
      style={{ backgroundImage: `url(${bgUrl})` }}
    />
  ),
  OperationSummary: ({
    chainId,
    children,
    type,
  }: {
    chainId: number;
    children: string;
    type: string;
  }) => {
    const selectedDevice = useContext(DeviceContext);
    const chainIcon = getIconFor(selectedDevice, chainId) ?? "/assets/eth.svg";
    const bgUrl = type === "message" ? "/assets/scroll.svg" : chainIcon;

    const isStax = selectedDevice === "stax";

    return (
      <div
        className={cn(
          "align-center flex grow flex-col justify-center gap-3 border-b border-light-grey",
          isStax ? "p-3" : "p-4",
        )}
      >
        <Device.Icon bgUrl={bgUrl} />
        <Device.HeadingText>
          <div className="text-center">{children}</div>
        </Device.HeadingText>
      </div>
    );
  },
  Pagination: ({
    current,
    total,
    onNext,
    onPrevious,
  }: {
    current: number;
    total: number;
    onNext?: () => void;
    onPrevious?: () => void;
  }) => {
    const isStax = useContext(DeviceContext) === "stax";

    return isStax ? (
      <StaxInteractive.Pagination
        current={current}
        total={total}
        onNext={onNext}
        onPrevious={onPrevious}
      />
    ) : (
      <FlexInteractive.Pagination
        current={current}
        total={total}
        onNext={onNext}
        onPrevious={onPrevious}
      />
    );
  },
  Section: ({ children }: { children: ReactNode }) => {
    const isStax = useContext(DeviceContext) === "stax";

    return (
      <div
        className={cn(
          "flex flex-col border-b border-light-grey py-[14px] last:border-0",
          isStax ? "gap-[8px] px-3" : "gap-[6px] px-4",
        )}
      >
        {children}
      </div>
    );
  },
  SignButton: () => {
    const isStax = useContext(DeviceContext) === "stax";

    const Button = () =>
      isStax ? (
        <Image src={staxSignButton} alt="Sign" width={40} height={40} />
      ) : (
        <Image src={flexSignButton} alt="Sign" width={44} height={44} />
      );

    return (
      <div
        className={cn(
          "flex items-center justify-between",
          isStax ? "px-3 py-[10px]" : "p-4",
        )}
      >
        <Device.HeadingText>Hold to sign</Device.HeadingText>
        <div
          className={cn(
            "flex items-center justify-center rounded-full border border-light-grey",
            isStax ? "h-[40px] w-[40px]" : "h-[44px] w-[44px]",
          )}
        >
          <Button />
        </div>
      </div>
    );
  },
};
