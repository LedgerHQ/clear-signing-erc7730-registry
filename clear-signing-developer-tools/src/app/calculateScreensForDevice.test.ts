import { calculateScreensForDevice } from "~/app/calculateScreensForDevice";
import { type PreviewData } from "~/types/PreviewData";

const exampleInput: PreviewData = {
  type: "transaction",
  metadata: {
    owner: "owner",
    info: { legalName: "legalName", url: "url", lastUpdate: "lastUpdate" },
  },
  contract: {
    name: "",
    deployments: [],
  },
  operations: [],
};

describe("given a Stax", () => {
  test("passes the input data out", () => {
    const result = calculateScreensForDevice("stax", exampleInput);
    expect(result).toEqual(exampleInput);
  });
});
