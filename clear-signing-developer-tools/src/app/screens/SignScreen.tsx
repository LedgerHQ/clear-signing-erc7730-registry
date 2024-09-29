import Image from "next/image";
import { Device } from "~/app/Device";
import signButton from "./assets/sign-button.svg";

export const SignScreen = ({
  owner,
  type,
}: {
  owner: string;
  type: string;
}) => (
  <>
    <Device.OperationSummary>
      {`Sign ${type} from ${owner}?`}
    </Device.OperationSummary>
    <div className="flex items-center justify-between p-4">
      <Device.Heading>Hold to sign</Device.Heading>
      <div className="border-light-grey flex h-[44px] w-[44px] items-center justify-center rounded-full border">
        <Image src={signButton} alt="Sign" width={44} height={44} />
      </div>
    </div>
  </>
);
