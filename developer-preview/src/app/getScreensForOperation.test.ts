import { getScreensForOperation } from "~/app/getScreensForOperation";
import { type Operation } from "~/types/PreviewData";

describe("For both devices", () => {
  test("returns one screen for four display values", () => {
    const input: Operation = {
      id: "",
      intent: "",
      displays: [
        { displayValue: "test value 1", label: "Field 1" },
        { displayValue: "test value 2", label: "Field 2" },
        { displayValue: "test value 3", label: "Field 3" },
        { displayValue: "test value 4", label: "Field 4" },
      ],
    };

    const expectedOutput = [
      [
        { displayValue: "test value 1", label: "Field 1" },
        { displayValue: "test value 2", label: "Field 2" },
        { displayValue: "test value 3", label: "Field 3" },
        { displayValue: "test value 4", label: "Field 4" },
      ],
    ];

    const result = getScreensForOperation(input);

    expect(result).toEqual(expectedOutput);
  });

  test("returns two screens for five display values", () => {
    const input: Operation = {
      id: "",
      intent: "",
      displays: [
        { displayValue: "test value 1", label: "Field 1" },
        { displayValue: "test value 2", label: "Field 2" },
        { displayValue: "test value 3", label: "Field 3" },
        { displayValue: "test value 4", label: "Field 4" },
        { displayValue: "test value 5", label: "Field 5" },
      ],
    };

    const expectedOutput = [
      [
        { displayValue: "test value 1", label: "Field 1" },
        { displayValue: "test value 2", label: "Field 2" },
        { displayValue: "test value 3", label: "Field 3" },
        { displayValue: "test value 4", label: "Field 4" },
      ],
      [{ displayValue: "test value 5", label: "Field 5" }],
    ];

    const result = getScreensForOperation(input);

    expect(result).toEqual(expectedOutput);
  });

  test("returns two screens for eight display values", () => {
    const input: Operation = {
      id: "",
      intent: "",
      displays: [
        { displayValue: "test value 1", label: "Field 1" },
        { displayValue: "test value 2", label: "Field 2" },
        { displayValue: "test value 3", label: "Field 3" },
        { displayValue: "test value 4", label: "Field 4" },
        { displayValue: "test value 5", label: "Field 5" },
        { displayValue: "test value 6", label: "Field 6" },
        { displayValue: "test value 7", label: "Field 7" },
        { displayValue: "test value 8", label: "Field 8" },
      ],
    };

    const expectedOutput = [
      [
        { displayValue: "test value 1", label: "Field 1" },
        { displayValue: "test value 2", label: "Field 2" },
        { displayValue: "test value 3", label: "Field 3" },
        { displayValue: "test value 4", label: "Field 4" },
      ],
      [
        { displayValue: "test value 5", label: "Field 5" },
        { displayValue: "test value 6", label: "Field 6" },
        { displayValue: "test value 7", label: "Field 7" },
        { displayValue: "test value 8", label: "Field 8" },
      ],
    ];

    const result = getScreensForOperation(input);

    expect(result).toEqual(expectedOutput);
  });

  test("returns three screens for nine display values", () => {
    const input: Operation = {
      id: "",
      intent: "",
      displays: [
        { displayValue: "test value 1", label: "Field 1" },
        { displayValue: "test value 2", label: "Field 2" },
        { displayValue: "test value 3", label: "Field 3" },
        { displayValue: "test value 4", label: "Field 4" },
        { displayValue: "test value 5", label: "Field 5" },
        { displayValue: "test value 6", label: "Field 6" },
        { displayValue: "test value 7", label: "Field 7" },
        { displayValue: "test value 8", label: "Field 8" },
        { displayValue: "test value 9", label: "Field 9" },
      ],
    };

    const expectedOutput = [
      [
        { displayValue: "test value 1", label: "Field 1" },
        { displayValue: "test value 2", label: "Field 2" },
        { displayValue: "test value 3", label: "Field 3" },
        { displayValue: "test value 4", label: "Field 4" },
      ],
      [
        { displayValue: "test value 5", label: "Field 5" },
        { displayValue: "test value 6", label: "Field 6" },
        { displayValue: "test value 7", label: "Field 7" },
        { displayValue: "test value 8", label: "Field 8" },
      ],
      [{ displayValue: "test value 9", label: "Field 9" }],
    ];

    const result = getScreensForOperation(input);

    expect(result).toEqual(expectedOutput);
  });
});
