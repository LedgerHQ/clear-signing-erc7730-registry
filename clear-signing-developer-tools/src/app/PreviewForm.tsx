import { UI } from "~/app/UI";

export const PreviewForm = () => (
  <form className="flex flex-col gap-6">
    <div>
      <UI.HeadingField>Contract</UI.HeadingField>
      <div>
        Uniswap_V3 (<UI.BlueLink href="#">0x4c…cbe9de5</UI.BlueLink>)
      </div>
    </div>
    <div>
      <UI.HeadingField>Function</UI.HeadingField>
      <div>
        swap_1: “Swap with Uniswap (
        <UI.BlueLink href="#">0xfc6f7865</UI.BlueLink>)
      </div>
    </div>
    <div>
      <UI.HeadingField>Preview example</UI.HeadingField>
      <UI.Select>
        <UI.Option value="">tx1 (0xbe936…e403e7b62)</UI.Option>
      </UI.Select>
    </div>
    <div>
      <UI.HeadingField>Preview on</UI.HeadingField>
      <UI.Select>
        <option value="Stax">Ledger Stax</option>
      </UI.Select>
    </div>
  </form>
);
