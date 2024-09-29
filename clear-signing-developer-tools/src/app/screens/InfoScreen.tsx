import { Device } from "~/app/Device";

export const InfoScreen = ({
  address,
  info: { lastUpdate, legalName, url },
}: {
  address: string;
  info: { lastUpdate: string; legalName: string; url: string };
}) => (
  <>
    <Device.Section>
      <Device.BackHeader>Smart contract information</Device.BackHeader>
    </Device.Section>
    <Device.Section>
      <Device.Action>Contract owner</Device.Action>
      <Device.ContentText>{legalName}</Device.ContentText>
      <Device.ContentText>{url}</Device.ContentText>
    </Device.Section>
    <Device.Section>
      <Device.Action>Last updated</Device.Action>
      <Device.ContentText>
        {new Date(lastUpdate).toDateString()}
      </Device.ContentText>
    </Device.Section>
    <Device.Section>
      <Device.Action>Contract address</Device.Action>
      <Device.ContentText>{address}</Device.ContentText>
    </Device.Section>
  </>
);
