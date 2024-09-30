import { useContext, type ReactNode } from "react";
import Image from "next/image";
import { DeviceContext } from "~/app/DeviceContext";
import { Flex } from "~/app/Flex";
import { Stax } from "~/app/Stax";
import flexChevronLeft from "~/app/screens/assets/flex-chevron-left.svg";
import flexChevronRight from "../app/screens/assets/flex-chevron-right.svg";
import info from "~/app/screens/assets/info.svg";
import signButton from "~/app/screens/assets/sign-button.svg";
import { cn } from "~/utils/cn";

export const Device = {
  ActionText: ({ children }: { children: string }) => (
    <div className="text-[14px] font-semibold leading-[18px]">{children}</div>
  ),
  ContentText: ({ children }: { children: ReactNode }) => (
    <div className="break-words text-[14px] leading-[18px]">{children}</div>
  ),
  Frame: ({ children }: { children: ReactNode }) => {
    const selectedDevice = useContext(DeviceContext);
    const Component = selectedDevice === "stax" ? Stax : Flex;
    return (
      <Component.Bezel>
        <div className="flex w-full flex-col justify-between antialiased">
          {children}
        </div>
      </Component.Bezel>
    );
  },
  HeadingText: ({ children }: { children: ReactNode }) => {
    const selectedDevice = useContext(DeviceContext);
    const Component = selectedDevice === "stax" ? Stax : Flex;
    return <Component.HeadingText>{children}</Component.HeadingText>;
  },
  InfoBlock: ({ owner }: { owner: string }) => (
    <div className="flex items-center gap-4 px-4 py-3">
      <div>
        <Device.ContentText>
          {`You're interacting with a smart contract from ${owner}.`}
        </Device.ContentText>
      </div>
      <div>
        <div className="border-light-grey flex h-[32px] w-[32px] items-center justify-center rounded-full border">
          <Image src={info} alt="More info" width={20} height={20} />
        </div>
      </div>
    </div>
  ),
  IconEth: () => (
    <div className="h-[32px] w-[32px] self-center bg-[url(/assets/eth.svg)] bg-contain bg-no-repeat"></div>
  ),
  IconMessage: () => (
    <div className="h-[32px] w-[32px] self-center bg-[url(/assets/scroll.svg)] bg-contain bg-no-repeat"></div>
  ),
  OperationSummary: ({
    children,
    type,
  }: {
    children: string;
    type: string;
  }) => {
    const selectedDevice = useContext(DeviceContext);

    return (
      <div
        className={cn(
          "align-center border-light-grey flex grow flex-col justify-center gap-3 border-b",
          selectedDevice === "stax" ? "p-3" : "p-4",
        )}
      >
        {type === "message" ? <Device.IconMessage /> : <Device.IconEth />}
        <Device.HeadingText>
          <div className="text-center">{children}</div>
        </Device.HeadingText>
      </div>
    );
  },
  Pagination: ({ current, total }: { current: number; total: number }) => {
    const first = current === 1;
    const last = current === total;

    return (
      <div className="border-light-grey leading-1 flex border-t text-[14px]">
        <div className="border-light-grey border-r px-[26.5px] py-[14px] font-medium">
          Reject
        </div>
        <div className="text-dark-grey flex w-full items-center justify-center gap-4 px-4">
          <Image
            src={flexChevronLeft as string}
            alt="left"
            className={cn("inline-block h-[15px]", { "opacity-15": first })}
          />
          {current} of {total}
          <Image
            src={flexChevronRight as string}
            alt="left"
            className={cn("inline-block h-[15px]", { "opacity-15": last })}
          />
        </div>
      </div>
    );
  },
  Section: ({ children }: { children: ReactNode }) => (
    <div className="border-light-grey flex flex-col gap-[6px] border-b px-4 py-[14px] last:border-0">
      {children}
    </div>
  ),
  SignButton: () => (
    <div className="flex items-center justify-between p-4">
      <Device.HeadingText>Hold to sign</Device.HeadingText>
      <div className="border-light-grey flex h-[44px] w-[44px] items-center justify-center rounded-full border">
        <Image src={signButton} alt="Sign" width={44} height={44} />
      </div>
    </div>
  ),
};
