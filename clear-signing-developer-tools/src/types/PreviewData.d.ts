export type PreviewData = {
  intent: string;
  type: "transaction" | "message";
  metadata: {
    owner: string;
    info: {
      legalName: string;
      lastUpdate: string;
      url: string;
    };
  };
  displays: DisplayItem[];
};

interface DisplayItem {
  label: string;
  displayValue: string;
}
