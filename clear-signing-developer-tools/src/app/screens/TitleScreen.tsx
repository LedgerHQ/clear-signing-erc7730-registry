import { Device } from "~/app/Device";
import info from "./assets/info.svg";
import Image from "next/image";

export const TitleScreen = ({
  owner,
  type,
}: {
  owner: string;
  type: string;
}) => (
  <>
    <Device.OperationSummary>{`Review ${type} from ${owner}?`}</Device.OperationSummary>
    <div className="flex items-center gap-4 px-4 py-3">
      <div>
        <Device.ContentText>
          {`You're interacting with a smart contract from ${owner}.`}
        </Device.ContentText>
      </div>
      <div>
        <div className="border-light-grey flex h-[32px] w-[32px] items-center justify-center rounded-full border">
          <Image src={info} alt="More info" width={20} height={20} />
        </div>
      </div>
    </div>
  </>
);
