import { type ERC7730Schema } from "~/types";
import { getPreviewData } from "./getPreviewData";

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const minimumERC7730Schema: ERC7730Schema = {
  display: {
    format: {},
  },
  context: {
    contract: {},
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

  describe("operation", () => {
    it('should return an empty array if "formats" is not present', () => {
      const result = getPreviewData({
        ...minimumERC7730Schema,
        display: {
          formats: {},
        },
      });

      expect(result.operations).toEqual([]);
    });
    it("should map a simple format to operation", () => {
      const result = getPreviewData({
        ...minimumERC7730Schema,
        display: {
          formats: {
            "mintToken(uint256 eventId, uint256 tokenId, address receiver, uint256 expirationTime, bytes signature)":
              {
                intent: "Mint POAP",
                fields: [
                  {
                    path: "tokenId",
                    label: "Token",
                    format: "raw",
                  },
                  {
                    path: "receiver",
                    label: "Beneficiary",
                    format: "addressName",
                  },
                  {
                    path: "expirationTime",
                    label: "Expiration time",
                    format: "date",
                    params: {
                      encoding: "timestamp",
                    },
                  },
                ],
                required: ["tokenId", "recipient"],
              },
          },
        },
      });

      expect(result.operations).toEqual([
        {
          intent: "Mint POAP",
          displays: [
            {
              label: "Token",
              displayValue: "raw",
            },
            {
              label: "Beneficiary",
              displayValue: "addressName",
            },
            {
              label: "Expiration time",
              displayValue: "date",
            },
          ],
        },
      ]);
    });
    it("should look at the $ root identifier to fetch the data elsewhere", () => {
      const result = getPreviewData({
        ...minimumERC7730Schema,
        display: {
          definitions: {
            beneficiary: {
              label: "Beneficiary",
              format: "addressName",
            },
          },
          formats: {
            functionName: {
              intent: "Mint POAP",
              fields: [
                {
                  path: "data.beneficiary",
                  $ref: "$.display.definitions.beneficiary",
                },
              ],
              required: [],
            },
          },
        },
      });

      expect(result.operations).toEqual([
        {
          intent: "Mint POAP",
          displays: [
            {
              label: "Beneficiary",
              displayValue: "addressName",
            },
          ],
        },
      ]);
    });
  });
});
