import { Device } from "~/app/DeviceInteractive";
import { getScreensForOperation } from "~/app/getScreensForOperation";
import { InfoScreen } from "~/app/screens-interactive/InfoScreen";
import { ReviewScreen } from "~/app/screens-interactive/ReviewScreen";
import { SignScreen } from "~/app/screens-interactive/SignScreen";
import { TitleScreen } from "~/app/screens-interactive/TitleScreen";
import { type Operation } from "~/types/PreviewData";
import { useState } from "react";

interface Props {
  chainId: number;
  contractAddress: string;
  chosenOperation: Operation;
  info: { lastUpdate: string; legalName: string; url: string };
  owner: string;
  operationType: string;
}

export const ScreensInteractive = ({
  chainId,
  contractAddress,
  chosenOperation,
  info,
  owner,
  operationType,
}: Props) => {
  const screens = getScreensForOperation(chosenOperation);
  const totalPages = screens.length + 2;
  const [currentPage, setCurrentPage] = useState(1);
  const [isInfoActive, setIsInfoActive] = useState(false);

  const handleNext = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevious = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleInfoClick = () => {
    console.log("info");

    setIsInfoActive(true);
  };

  const handleInfoBack = () => {
    setIsInfoActive(false);
  };

  return (
    <>
      {isInfoActive ? (
        <Device.Frame>
          <InfoScreen
            info={info}
            address={contractAddress}
            onBack={handleInfoBack}
          />
        </Device.Frame>
      ) : (
        <>
          {currentPage === 1 && (
            <Device.Frame>
              <TitleScreen
                chainId={chainId}
                owner={owner}
                type={operationType}
                onInfoClick={handleInfoClick}
              />
              <Device.Pagination
                current={currentPage}
                total={totalPages}
                onNext={handleNext}
                onPrevious={handlePrevious}
              />
            </Device.Frame>
          )}

          {currentPage > 1 &&
            currentPage < totalPages &&
            screens[currentPage - 2] && (
              <Device.Frame>
                <ReviewScreen screen={screens[currentPage - 2]!} />
                <Device.Pagination
                  current={currentPage}
                  total={totalPages}
                  onNext={handleNext}
                  onPrevious={handlePrevious}
                />
              </Device.Frame>
            )}

          {currentPage === totalPages && (
            <Device.Frame>
              <SignScreen
                chainId={chainId}
                owner={owner}
                type={operationType}
              />
              <Device.Pagination
                current={currentPage}
                total={totalPages}
                onNext={handleNext}
                onPrevious={handlePrevious}
              />
            </Device.Frame>
          )}
        </>
      )}
    </>
  );
};
