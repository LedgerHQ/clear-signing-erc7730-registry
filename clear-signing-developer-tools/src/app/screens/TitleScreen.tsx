import { Device } from "~/app/Device";

export const TitleScreen = ({
  owner,
  totalPages,
  type,
}: {
  owner: string;
  totalPages: number;
  type: string;
}) => (
  <Device.Frame>
    <Device.Section>
      <Device.Logo />
      <Device.ReviewTitle>{`Review ${type} from ${owner}?`}</Device.ReviewTitle>
      <Device.InfoButton />
      <Device.ReviewSummary>
        {`You're interacting with a smart contract from ${owner}.`}
      </Device.ReviewSummary>
      <Device.TapToContinue />
    </Device.Section>
    <Device.Section>
      <Device.RejectButton />
    </Device.Section>

    <Device.Pagination current={1} total={totalPages} />
  </Device.Frame>
);
