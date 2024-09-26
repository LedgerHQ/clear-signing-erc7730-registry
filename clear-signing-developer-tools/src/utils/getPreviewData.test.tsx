import { type ERC7730Schema } from "~/types";
import { getPreviewData } from "./getPreviewData";

const exampleTransactionContext = {
  $id: "Contract name",
  contract: {
    abi: "unsused",
    deployments: [{ address: "0xtestAddress", chainId: 1 }],
  },
};

const exampleEIP712Context = {
  eip712: {
    domain: { name: "EIP 712 name" },
    deployments: [{ address: "0xtestEip712Address", chainId: 1 }],
    schemas: ["unused"],
  },
};

const minimumERC7730Schema: ERC7730Schema = {
  display: { formats: {} },
  $schema: "unused",
  metadata: {
    owner: "",
    info: { legalName: "", lastUpdate: "", url: "" },
  },
  context: exampleTransactionContext,
};

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

      const { data } = getPreviewData({
        ...minimumERC7730Schema,
        metadata,
      });

      expect(data!.metadata).toBe(metadata);
    });

    it("should return contract information for a transaction", () => {
      const { data } = getPreviewData({
        ...minimumERC7730Schema,
        context: exampleTransactionContext,
      });

      expect(data!.contract).toEqual({
        name: exampleTransactionContext.$id,
        deployments: [{ address: "0xtestAddress" }],
      });
    });

    it("should return contract information for an eip712 message", () => {
      const { data } = getPreviewData({
        ...minimumERC7730Schema,
        context: exampleEIP712Context,
      });

      expect(data!.contract).toEqual({
        name: "EIP 712 name",
        deployments: [{ address: "0xtestEip712Address" }],
      });
    });

    it("should indicate if it is a transaction", () => {
      const { data } = getPreviewData({
        ...minimumERC7730Schema,
        context: exampleTransactionContext,
      });

      expect(data!.type).toBe("transaction");
    });

    it("should indicate if it is a message", () => {
      const { data } = getPreviewData({
        ...minimumERC7730Schema,
        context: exampleEIP712Context,
      });

      expect(data!.type).toBe("message");
    });
  });

  describe("operation", () => {
    it('should return an empty array if "formats" is not present', () => {
      const { data } = getPreviewData({
        ...minimumERC7730Schema,
        display: {
          formats: {},
        },
      });

      expect(data!.operations).toEqual([]);
    });
    it("should map a simple format to operation", () => {
      const { data } = getPreviewData({
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

      expect(data!.operations).toEqual([
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
      const { data } = getPreviewData({
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

      expect(data!.operations).toEqual([
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

    it("should map nested fields to operations", () => {
      const { data } = getPreviewData({
        ...minimumERC7730Schema,
        display: {
          formats: {
            PermitWitnessTransferFrom: {
              intent: "UniswapX Dutch Order",
              fields: [
                {
                  path: "witness.outputs[]",
                  fields: [
                    {
                      path: "endAmount",
                      label: "Minimum amounts to receive",
                      format: "tokenAmount",
                      params: {
                        tokenPath: "token",
                      },
                    },
                    {
                      path: "recipient",
                      label: "On Addresses",
                      format: "addressName",
                    },
                  ],
                },
              ],
            },
          },
        },
      });

      expect(data!.operations).toEqual([
        {
          intent: "UniswapX Dutch Order",
          displays: [
            {
              label: "Minimum amounts to receive",
              displayValue: "tokenAmount",
            },
            {
              label: "On Addresses",
              displayValue: "addressName",
            },
            {
              label: "Minimum amounts to receive",
              displayValue: "tokenAmount",
            },
            {
              label: "On Addresses",
              displayValue: "addressName",
            },
          ],
        },
      ]);
    });
  });
});
