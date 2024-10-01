import { UI } from "~/app/UI";

export const SelectValues = () => {
  return (
    <div>
      <UI.HeadingField>Preview with</UI.HeadingField>
      <UI.Select disabled onChange={() => null}>
        <UI.Option value="">Placeholder values</UI.Option>
      </UI.Select>
    </div>
  );
};
