import { useContext } from "react";
import { Device } from "~/app/Device";
import { DeviceContext } from "~/app/DeviceContext";
import { type Screen } from "~/app/getScreensForOperation";
import { cn } from "~/lib/utils";

export const ReviewScreen = ({ screen }: { screen: Screen }) => {
  const isStax = useContext(DeviceContext) === "stax";

  return (
    <div
      className={cn(
        "flex flex-col items-start",
        isStax ? "mt-4 gap-[6px] p-3" : "mt-5 gap-3 px-4",
      )}
    >
      {screen.map(({ label, displayValue }, index) => (
        <div className="w-full" key={`${label}-field-${index}`}>
          <Device.ContentText>
            <span className="text-dark-grey">{label}</span>
          </Device.ContentText>
          <Device.HeadingText>{displayValue}</Device.HeadingText>
        </div>
      ))}
    </div>
  );
};
