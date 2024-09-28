import { Device } from "~/app/Device";

export const TitleScreen = ({
  owner,
  type,
}: {
  owner: string;
  type: string;
}) => (
  <>
    <Device.Logo />
    <Device.ReviewTitle>{`Review ${type} from ${owner}?`}</Device.ReviewTitle>
    <Device.InfoButton />
    <Device.ReviewSummary>
      {`You're interacting with a smart contract from ${owner}.`}
    </Device.ReviewSummary>
    <Device.RejectButton />
  </>
);
