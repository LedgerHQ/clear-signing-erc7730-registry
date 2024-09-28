import { Device } from "~/app/Device";
import { getScreensForOperation } from "~/app/getScreensForOperation";
import { InfoScreen } from "~/app/screens/InfoScreen";
import { ReviewScreen } from "~/app/screens/ReviewScreen";
import { SignScreen } from "~/app/screens/SignScreen";
import { TitleScreen } from "~/app/screens/TitleScreen";
import { type Operation } from "~/types/PreviewData";

interface Props {
  contractAddress: string;
  chosenOperation: Operation;
  info: { lastUpdate: string; legalName: string; url: string };
  owner: string;
  operationType: string;
}

export const Screens = ({
  contractAddress,
  chosenOperation,
  info,
  owner,
  operationType,
}: Props) => {
  const screens = getScreensForOperation(chosenOperation);
  const totalPages = screens.length + 2;

  return (
    <>
      <Device.Frame>
        <TitleScreen owner={owner} type={operationType} />
        <Device.Pagination current={1} total={totalPages} />
      </Device.Frame>

      <Device.Frame>
        <InfoScreen info={info} address={contractAddress} />
      </Device.Frame>

      {screens.map((screen, index) => (
        <Device.Frame key={`review-screen-${index}`}>
          <ReviewScreen screen={screen} />
          <Device.Pagination current={index + 2} total={totalPages} />
        </Device.Frame>
      ))}

      <Device.Frame>
        <SignScreen owner={owner} type={operationType} />
        <Device.Pagination current={totalPages} total={totalPages} />
      </Device.Frame>
    </>
  );
};
