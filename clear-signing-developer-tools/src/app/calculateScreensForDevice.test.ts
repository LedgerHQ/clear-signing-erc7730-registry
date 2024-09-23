import { calculateScreensForDevice } from "~/app/calculateScreensForDevice";
import { type PreviewData } from "~/types/PreviewData";

const exampleInput = {
  displays: [{ displayValue: "displayValue", label: "label" }],
  intent: "intent",
  type: "transaction",
  metadata: {
    owner: "owner",
    info: { legalName: "legalName", url: "url", lastUpdate: "lastUpdate" },
  },
} satisfies PreviewData;

describe("given a Stax", () => {
  test("passes the input data out", () => {
    const result = calculateScreensForDevice("stax", exampleInput);
    expect(result).toEqual(exampleInput);
  });
});
