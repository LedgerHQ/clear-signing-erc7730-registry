import { transformOperationIntoDisplays } from "~/app/transformOperationIntoDisplays";
import { type Operation } from "~/types/PreviewData";

const exampleInput: Operation = {
  intent: "",
  displays: [
    {
      label: "Field 1",
      displayValue: "test value 1",
    },
  ],
};

describe("For a Flex", () => {
  const selectedDevice = "flex";
  describe("when there is a single display item to show", () => {
    test("returns a single review field", () => {
      const expectedOutput = [
        { displayValue: "test value 1", label: "Field 1" },
      ];

      const result = transformOperationIntoDisplays(
        exampleInput,
        selectedDevice,
      );

      expect(result).toEqual(expectedOutput);
    });
  });
});
