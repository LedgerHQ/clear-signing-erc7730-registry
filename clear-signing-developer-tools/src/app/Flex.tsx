import { type ReactNode } from "react";

// Dimensions of the area to display the fields: 480px x 464px
// Number of lines for tags & values: 9

export const Flex = {
  Bezel: ({ children }: { children: ReactNode }) => (
    <div className="h-[416.5px] w-[301.5px] bg-[url(/assets/DeviceBezel-Flex.png)] bg-contain p-[29.5px]">
      <div className="flex h-[300px] w-[240px] overflow-hidden rounded-[8px]">
        {children}
      </div>
    </div>
  ),
};
