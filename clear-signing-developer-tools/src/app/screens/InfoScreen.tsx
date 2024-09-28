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
      <Device.Content>{legalName}</Device.Content>
      <Device.Content>{url}</Device.Content>
    </Device.Section>
    <Device.Section>
      <Device.Action>Last updated</Device.Action>
      <Device.Content>{new Date(lastUpdate).toDateString()}</Device.Content>
    </Device.Section>
    <Device.Section>
      <Device.Action>Contract address</Device.Action>
      <Device.Content>{address}</Device.Content>
    </Device.Section>
  </>
);
