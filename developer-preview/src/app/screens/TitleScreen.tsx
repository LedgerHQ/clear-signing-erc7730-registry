import { Device } from "~/app/Device";

export const TitleScreen = ({
  owner,
  type,
}: {
  owner: string;
  type: string;
}) => (
  <>
    <Device.OperationSummary
      type={type}
    >{`Review ${type} from ${owner}?`}</Device.OperationSummary>
    <Device.InfoBlock owner={owner} />
  </>
);
