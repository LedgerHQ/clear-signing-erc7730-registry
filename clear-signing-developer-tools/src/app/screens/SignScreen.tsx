import { Device } from "~/app/Device";

export const SignScreen = ({
  owner,
  type,
}: {
  owner: string;
  type: string;
}) => (
  <>
    <Device.OperationSummary type={type}>
      {`Sign ${type} from ${owner}?`}
    </Device.OperationSummary>
    <Device.SignButton />
  </>
);
