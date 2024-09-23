import { type ERC7730Schema } from "~/types";
import { getPreviewData } from "./getPreviewData";

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const minimumERC7730Schema: ERC7730Schema = {
  display: {
    format: {},
    context: {},
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

describe("getPreviewData", () => {
  describe("general information", () => {
    it("should return the metadata", () => {
      const metadata = {
        owner: "POAP",
        info: {
          url: "https://poap.xyz/",
          legalName: "legalName",
          lastUpdate: "2022-03-03T17:56:02Z",
        },
      };

      const result = getPreviewData({
        ...minimumERC7730Schema,
        metadata,
      });

      expect(result.metadata).toBe(metadata);
    });

    it("should indicate if it is a transaction", () => {
      const result = getPreviewData({
        ...minimumERC7730Schema,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
        context: {
          contract: {},
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
      });

      expect(result.type).toBe("transaction");
    });

    it("should indicate if it is a message", () => {
      const result = getPreviewData({
        ...minimumERC7730Schema,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
        context: {
          eip712: {},
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
      });

      expect(result.type).toBe("message");
    });
  });
});
