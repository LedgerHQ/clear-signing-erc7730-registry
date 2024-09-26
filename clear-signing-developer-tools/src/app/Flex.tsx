import type { ReactNode } from "react";

// Dimensions of the area to display the fields:
// Stax : 400px x 546px
// Flex : 480px x 464px
// Number of lines for tags & values:
// Stax : 10
// Flex : 9
// If a value exceeds 10 (or 9) lines, it should be automatically truncated with “...” at the end of the last line, along with a “More” button

export const Flex = {
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
  Bezel: ({ children }: { children: ReactNode }) => (
    <div className="h-[416.5px] w-[301.5px] bg-[url(/assets/DeviceBezel-Flex.png)] bg-contain p-[29.5px]">
      <div className="flex h-[320px] w-[240px] bg-white">{children}</div>
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
    <div className="flex flex-col">{children}</div>
  ),
};
