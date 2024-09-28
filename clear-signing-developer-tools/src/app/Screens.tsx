import { getScreensForOperation } from "~/app/getScreensForOperation";
import { InfoScreen } from "~/app/screens/InfoScreen";
import { ReviewScreens } from "~/app/screens/ReviewScreens";
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
      <TitleScreen owner={owner} totalPages={totalPages} type={operationType} />
      <InfoScreen info={info} address={contractAddress} />
      <ReviewScreens totalPages={totalPages} screens={screens} />
      <SignScreen owner={owner} totalPages={totalPages} type={operationType} />
    </>
  );
};
