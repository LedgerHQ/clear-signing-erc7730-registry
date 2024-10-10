import Image from "next/image";
import { useContext } from "react";
import { Device } from "~/app/Device";
import { DeviceContext } from "~/app/DeviceContext";
import flexBackArrow from "~/app/screens/assets/flex-back-arrow.svg";
import staxBackArrow from "~/app/screens/assets/stax-back-arrow.svg";
import { cn } from "~/lib/utils";

export const InfoScreen = ({
  address,
  info: { legalName, url } = {
    legalName: "{metadata.info.legalName}",
    url: "{metadata.info.url}",
  },
}: {
  address: string;
  info: { legalName: string; url: string };
}) => {
  const isStax = useContext(DeviceContext) === "stax";

  return (
    <>
      <div className="relative border-b border-light-grey">
        <div
          className={cn(
            "absolute bottom-0 left-0 top-0 flex items-center justify-center",
            isStax ? "w-[44px]" : "w-[52px]",
          )}
        >
          {isStax ? (
            <Image
              className="inline-block w-4"
              src={staxBackArrow}
              alt="Back"
              width={16}
              height={16}
            />
          ) : (
            <Image
              className="inline-block w-5"
              src={flexBackArrow}
              alt="Back"
              width={20}
              height={20}
            />
          )}
        </div>
        <div
          className={cn(
            "py-[6px] text-center",
            isStax ? "px-[44px]" : "px-[52px]",
          )}
        >
          <Device.ActionText>Smart contract information</Device.ActionText>
        </div>
      </div>
      <div className="grow">
        <Device.Section>
          <Device.ActionText>Contract owner</Device.ActionText>
          <Device.ContentText>
            {legalName}
            <br />
            {url}
          </Device.ContentText>
        </Device.Section>
        <Device.Section>
          <Device.ActionText>Contract address</Device.ActionText>
          <Device.ContentText>{address}</Device.ContentText>
        </Device.Section>
      </div>
      <div></div>
    </>
  );
};
