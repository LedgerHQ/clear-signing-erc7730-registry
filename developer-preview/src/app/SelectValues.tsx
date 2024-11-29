import type { Dispatch, SetStateAction } from "react";

import { UI } from "~/ui/UI";

export const SelectValues = ({
  callData,
  setCallData,
}: {
  callData: string;
  setCallData: Dispatch<SetStateAction<string>>;
}) => {
  return (
    <div>
      <UI.Label>Preview with</UI.Label>
      <UI.Input
        placeholder="Calldata (0x...)"
        value={callData}
        onChange={({ target: { value } }) => {
          localStorage.setItem("callData", value);
          setCallData(value);
        }}
      />
    </div>
  );
};
