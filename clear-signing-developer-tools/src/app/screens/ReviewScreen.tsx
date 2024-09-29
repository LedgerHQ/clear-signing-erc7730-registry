import { Device } from "~/app/Device";
import { type Screen } from "~/app/getScreensForOperation";

export const ReviewScreen = ({ screen }: { screen: Screen }) => {
  return (
    <div className="flex flex-col items-start gap-3 px-4 py-5">
      {screen.map(({ label, displayValue }, index) => (
        <div key={`${label}-field-${index}`}>
          <Device.ContentText>
            <span className="text-dark-grey">{label}</span>
          </Device.ContentText>
          <Device.HeadingText>{displayValue}</Device.HeadingText>
        </div>
      ))}
    </div>
  );
};
