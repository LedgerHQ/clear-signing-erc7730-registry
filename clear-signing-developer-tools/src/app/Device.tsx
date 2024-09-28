import { useContext, type ReactNode } from "react";
import { DeviceContext } from "~/app/DeviceContext";
import { Flex } from "~/app/Flex";
import { Stax } from "~/app/Stax";

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
  Content: ({ children }: { children: string }) => (
    <div className="">{children}</div>
  ),
  Frame: ({ children }: { children: ReactNode }) => {
    const selectedDevice = useContext(DeviceContext);
    const Component = selectedDevice === "stax" ? Stax : Flex;
    return (
      <Component.Bezel>
        <div className="flex flex-col">{children}</div>
      </Component.Bezel>
    );
  },
  InfoButton: () => (
    <div className="h-5 w-5 self-center rounded-full border-2 border-black text-center align-middle text-xs leading-4">
      i
    </div>
  ),
  Label: ({ children }: { children: string }) => <div>{children}</div>,

  Logo: () => (
    <div className="h-[29px] w-[18px] self-center bg-[url(/assets/eth.svg)] bg-contain bg-no-repeat"></div>
  ),
  Pagination: ({ current, total }: { current: number; total: number }) => (
    <div>
      {current} of {total}
    </div>
  ),
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
};
