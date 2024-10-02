import { UI } from "~/ui/UI";

export const SelectValues = () => {
  return (
    <div>
      <UI.HeadingField>Preview with</UI.HeadingField>
      <UI.Select
        items={[{ value: "placeholders", label: "Placeholder values" }]}
        onChange={() => undefined}
        placeholder="Preview with"
        value="placeholders"
      />
    </div>
  );
};
