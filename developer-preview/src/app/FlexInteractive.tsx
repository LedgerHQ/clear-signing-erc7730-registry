import Image from "next/image";
import { type ReactNode } from "react";
import { Device } from "~/app/Device";
import flexChevronLeft from "~/app/screens/assets/flex-chevron-left.svg";
import flexChevronRight from "../app/screens/assets/flex-chevron-right.svg";
import { cn } from "~/lib/utils";

export const FlexInteractive = {
  Bezel: ({ children }: { children: ReactNode }) => (
    <div className="h-[416.5px] w-[301.5px] bg-[url(/assets/DeviceBezel-Flex.png)] bg-contain p-[29.5px]">
      <div className="flex h-[300px] w-[240px] overflow-hidden rounded-[8px]">
        {children}
      </div>
    </div>
  ),
  Pagination: ({
    current,
    total,
    onPrevious,
    onNext,
  }: {
    current: number;
    total: number;
    onPrevious?: () => void;
    onNext?: () => void;
  }) => {
    const first = current === 1;
    const last = current === total;

    return (
      <div className="flex border-t border-light-grey">
        <div className="border-r border-light-grey px-[26.5px] py-[14px]">
          <Device.ActionText>Reject</Device.ActionText>
        </div>
        <div className="flex w-full items-center justify-center gap-4 px-4 text-dark-grey">
          <Image
            src={flexChevronLeft as string}
            alt="left"
            className={cn("inline-block h-[15px] cursor-pointer", {
              "opacity-15": first,
              "cursor-default": first,
            })}
            onClick={() => !first && onPrevious?.()}
          />
          <Device.ContentText>
            {current} of {total}
          </Device.ContentText>
          <Image
            src={flexChevronRight as string}
            alt="right"
            className={cn("inline-block h-[15px] cursor-pointer", {
              "opacity-15": last,
              "cursor-default": last,
            })}
            onClick={() => !last && onNext?.()}
          />
        </div>
      </div>
    );
  },
};
