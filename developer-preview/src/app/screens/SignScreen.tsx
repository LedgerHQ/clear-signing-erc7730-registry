import { Device } from "~/app/Device";

export const SignScreen = ({
  chainId,
  owner,
  type,
}: {
  chainId: number;
  owner: string;
  type: string;
}) => (
  <>
    <Device.OperationSummary chainId={chainId} type={type}>
      {`Sign ${type} from ${owner}?`}
    </Device.OperationSummary>
    <Device.SignButton />
  </>
);
