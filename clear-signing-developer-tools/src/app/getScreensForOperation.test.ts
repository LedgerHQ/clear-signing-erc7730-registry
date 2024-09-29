import { getScreensForOperation } from "~/app/getScreensForOperation";
import { type Operation } from "~/types/PreviewData";

test("returns one screen for three display values", () => {
  const input: Operation = {
    id: "",
    intent: "",
    displays: [
      { displayValue: "test value 1", label: "Field 1" },
      { displayValue: "test value 2", label: "Field 2" },
      { displayValue: "test value 3", label: "Field 3" },
    ],
  };

  const expectedOutput = [
    [
      { displayValue: "test value 1", label: "Field 1" },
      { displayValue: "test value 2", label: "Field 2" },
      { displayValue: "test value 3", label: "Field 3" },
    ],
  ];

  const result = getScreensForOperation(input);

  expect(result).toEqual(expectedOutput);
});

test("returns two screens for four display values", () => {
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
    ],
    [{ displayValue: "test value 4", label: "Field 4" }],
  ];

  const result = getScreensForOperation(input);

  expect(result).toEqual(expectedOutput);
});

test("returns two screens for six display values", () => {
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
    ],
  };

  const expectedOutput = [
    [
      { displayValue: "test value 1", label: "Field 1" },
      { displayValue: "test value 2", label: "Field 2" },
      { displayValue: "test value 3", label: "Field 3" },
    ],
    [
      { displayValue: "test value 4", label: "Field 4" },
      { displayValue: "test value 5", label: "Field 5" },
      { displayValue: "test value 6", label: "Field 6" },
    ],
  ];

  const result = getScreensForOperation(input);

  expect(result).toEqual(expectedOutput);
});

test("returns three screens for seven display values", () => {
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
    ],
  };

  const expectedOutput = [
    [
      { displayValue: "test value 1", label: "Field 1" },
      { displayValue: "test value 2", label: "Field 2" },
      { displayValue: "test value 3", label: "Field 3" },
    ],
    [
      { displayValue: "test value 4", label: "Field 4" },
      { displayValue: "test value 5", label: "Field 5" },
      { displayValue: "test value 6", label: "Field 6" },
    ],
    [{ displayValue: "test value 7", label: "Field 7" }],
  ];

  const result = getScreensForOperation(input);

  expect(result).toEqual(expectedOutput);
});
