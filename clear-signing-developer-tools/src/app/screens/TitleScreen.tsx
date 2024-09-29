import { Device } from "~/app/Device";

export const TitleScreen = ({
  owner,
  type,
}: {
  owner: string;
  type: string;
}) => (
  <>
    <Device.OperationSummary>{`Review ${type} from ${owner}?`}</Device.OperationSummary>
    <Device.InfoBlock owner={owner} />
  </>
);
