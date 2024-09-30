import type { ReactNode } from "react";

// Dimensions of the area to display the fields: 400px x 546px
// Number of lines for tags & values: 10

export const Stax = {
  Bezel: ({ children }: { children: ReactNode }) => (
    <div className="h-[355px] w-[226px] bg-[url(/assets/DeviceBezel-Stax.png)] bg-contain px-[13px] py-[10px]">
      <div className="flex h-[335px] w-[200px] overflow-hidden rounded-[15px] rounded-l-none">
        {children}
      </div>
    </div>
  ),
  HeadingText: ({ children }: { children: ReactNode }) => (
    <div className="text-[16px] font-medium leading-[20px]">{children}</div>
  ),
};
