import { Device } from "~/app/Device";

export const SignScreen = ({
  owner,
  totalPages,
  type,
}: {
  owner: string;
  totalPages: number;
  type: string;
}) => (
  <Device.Frame>
    {`Sign ${type} from ${owner}?`}
    <>
      <Device.Pagination current={totalPages} total={totalPages} />
    </>
  </Device.Frame>
);
