import { Device } from "~/app/Device";
import { type Screen } from "~/app/getScreensForOperation";

export const ReviewScreens = ({
  totalPages,
  screens,
}: {
  totalPages: number;
  screens: Screen[];
}) => {
  return (
    <>
      {screens.map((display, index) => (
        <Device.Frame key={`display-${index}`}>
          <>
            {display.map(({ label, displayValue }) => (
              <div key={label}>
                <Device.Label>{label}</Device.Label>
                <Device.Value>{displayValue}</Device.Value>
              </div>
            ))}
            <Device.Pagination current={index + 2} total={totalPages} />
          </>
        </Device.Frame>
      ))}
    </>
  );
};
