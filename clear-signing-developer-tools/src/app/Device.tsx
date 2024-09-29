import { useContext, type ReactNode } from "react";
import Image from "next/image";
import { DeviceContext } from "~/app/DeviceContext";
import { Flex } from "~/app/Flex";
import { Stax } from "~/app/Stax";
import flexChevronLeft from "~/app/screens/assets/flex-chevron-left.svg";
import flexChevronRight from "../app/screens/assets/flex-chevron-right.svg";
import info from "~/app/screens/assets/info.svg";
import { cn } from "~/utils/cn";

export const Device = {
  Action: ({ children }: { children: string }) => (
    <div className="font-medium">{children}</div>
  ),
  BackHeader: ({ children }: { children: string }) => (
    <div className="flex p-1">
      <div> &lt;--</div>
      <div className="text-center font-medium">{children}</div>
    </div>
  ),
  ContentText: ({ children }: { children: string }) => (
    <div className="text-[14px] leading-[18px]">{children}</div>
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
  Label: ({ children }: { children: string }) => <div>{children}</div>,

  Logo: () => (
    <div className="h-[29px] w-[18px] self-center bg-[url(/assets/eth.svg)] bg-contain bg-no-repeat"></div>
  ),
  OperationSummary: ({ children }: { children: string }) => (
    <div className="align-center border-light-grey flex grow flex-col justify-center gap-3 border-b px-4 py-4">
      <Device.Logo />
      <Device.Heading>{children}</Device.Heading>
    </div>
  ),
  Pagination: ({ current, total }: { current: number; total: number }) => {
    const first = current === 1;
    const last = current === total;

    return (
      <div className="border-light-grey leading-1 flex border-t text-[14px]">
        <div className="border-light-grey border-r px-[26.5px] py-[14.5px] font-medium">
          Reject
        </div>
        <div className="text-dark-grey flex w-full items-center justify-center gap-4 p-4">
          <Image
            src={flexChevronLeft as string}
            alt="left"
            className={cn("inline-block h-[15px]", { "opacity-25": first })}
          />
          {current} of {total}
          <Image
            src={flexChevronRight as string}
            alt="left"
            className={cn("inline-block h-[15px]", { "opacity-25": last })}
          />
        </div>
      </div>
    );
  },
  Heading: ({ children }: { children: string }) => (
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
};
