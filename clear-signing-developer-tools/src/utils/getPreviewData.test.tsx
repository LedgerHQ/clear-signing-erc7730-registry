import { ERC7730Schema } from "~/types";
import { getPreviewData } from "./getPreviewData";

describe("getPreviewData", () => {
  it("should return the correct PreviewData object", () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
    const result = getPreviewData({
      display: {
        format: {},
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    // Expected output
    const expectedPreviewData = {
      intent: "Mint POAP",
      type: "transaction",
      displays: [],
      metadata: undefined,
    };

    expect(result).toEqual(expectedPreviewData);
  });
});
