export type PreviewData = {
  type: "transaction" | "message";
  contract: {
    name: string;
    deployments: Deployment[];
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

type Deploymnent = { address: string };

interface Operation {
  intent: string;
  displays: DisplayItem[];
}

interface DisplayItem {
  label: string;
  displayValue: string;
}
