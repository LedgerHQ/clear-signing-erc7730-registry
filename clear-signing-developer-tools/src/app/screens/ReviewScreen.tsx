import { Device } from "~/app/Device";
import { type Screen } from "~/app/getScreensForOperation";

export const ReviewScreen = ({ screen }: { screen: Screen }) => {
  return (
    <>
      {screen.map(({ label, displayValue }) => (
        <div key={label}>
          <Device.Label>{label}</Device.Label>
          <Device.Value>{displayValue}</Device.Value>
        </div>
      ))}
    </>
  );
};
