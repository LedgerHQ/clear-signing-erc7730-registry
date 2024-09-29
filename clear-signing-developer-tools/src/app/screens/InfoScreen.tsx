import Image from "next/image";
import { Device } from "~/app/Device";
import flexBackArrow from "~/app/screens/assets/flex-back-arrow.svg";

export const InfoScreen = ({
  address,
  info: { lastUpdate, legalName, url },
}: {
  address: string;
  info: { lastUpdate: string; legalName: string; url: string };
}) => (
  <>
    <div className="border-light-grey relative border-b">
      <div className="absolute bottom-0 left-0 top-0 flex w-[52px] items-center justify-center">
        <Image
          className="inline-block w-5"
          src={flexBackArrow}
          alt="Back"
          width={20}
          height={20}
        />
      </div>
      <div className="px-[52px] py-[6px] text-center">
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
