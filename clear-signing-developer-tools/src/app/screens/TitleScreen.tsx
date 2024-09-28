import { Device } from "~/app/Device";

export const TitleScreen = ({
  owner,
  type,
}: {
  owner: string;
  type: string;
}) => (
  <>
    <div>
      <Device.Logo />
      <Device.ReviewTitle>{`Review ${type} from ${owner}?`}</Device.ReviewTitle>
    </div>
    <div>
      <div>
        {`You're interacting with a smart contract from ${owner}.`}
        <div className="h-5 w-5 self-center rounded-full border-2 border-black text-center align-middle text-xs leading-4">
          i
        </div>
      </div>
    </div>
  </>
);
