export type PreviewData = {
  type: "transaction" | "message";
  contract: {
    id: string;
    address: string;
  };
  metadata: {
    owner: string;
    info: {
      legalName: string;
      lastUpdate: string;
      url: string;
    };
  };
  operations: Operation[];
};

interface Operation {
  intent: string;
  displays: DisplayItem[];
}

interface DisplayItem {
  label: string;
  displayValue: string;
}
