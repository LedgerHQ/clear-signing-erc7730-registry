import Image from "next/image";
import { type ReactNode } from "react";
import { Device } from "~/app/Device";
import staxChevronLeft from "~/app/screens/assets/stax-chevron-left.svg";
import staxChevronRight from "../app/screens/assets/stax-chevron-right.svg";
import { cn } from "~/lib/utils";

export const Stax = {
  Bezel: ({ children }: { children: ReactNode }) => (
    <div className="h-[355px] w-[226px] bg-[url(/assets/DeviceBezel-Stax.png)] bg-contain px-[13px] py-[10px]">
      <div className="flex h-[335px] w-[200px] overflow-hidden rounded-[15px] rounded-l-none">
        {children}
      </div>
    </div>
  ),
  Pagination: ({ current, total }: { current: number; total: number }) => {
    const first = current === 1;
    const last = current === total;

    return (
      <div className="flex border-t border-light-grey">
        <div className="flex-grow border-r border-light-grey px-[8px] py-[15px] text-center">
          <Device.ActionText>Reject</Device.ActionText>
        </div>
        <div className="flex items-center justify-center gap-5 px-3 text-dark-grey">
          <Image
            src={staxChevronLeft as string}
            alt="left"
            className={cn("inline-block h-[15px]", { "opacity-15": first })}
          />
          <Device.ContentText>
            {current} of {total}
          </Device.ContentText>
          <Image
            src={staxChevronRight as string}
            alt="left"
            className={cn("inline-block h-[15px]", { "opacity-15": last })}
          />
        </div>
      </div>
    );
  },
};
