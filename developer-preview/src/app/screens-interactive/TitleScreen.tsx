import { Device } from "~/app/DeviceInteractive";

interface Props {
  chainId: number;
  owner: string;
  type: string;
  onInfoClick?: () => void;
}

export const TitleScreen = ({ chainId, owner, type, onInfoClick }: Props) => {
  return (
    <>
      <Device.OperationSummary chainId={chainId} type={type}>
        {type === "message" ? "Sign message" : "Sign transaction"}
      </Device.OperationSummary>
      <Device.InfoBlock owner={owner} onInfoClick={onInfoClick} />
    </>
  );
};
