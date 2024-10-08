import { Device } from "~/app/Device";

export const TitleScreen = ({
  chainId,
  owner,
  type,
}: {
  chainId: number;
  owner: string;
  type: string;
}) => (
  <>
    <Device.OperationSummary
      chainId={chainId}
      type={type}
    >{`Review ${type} from ${owner}?`}</Device.OperationSummary>
    <Device.InfoBlock owner={owner} />
  </>
);
