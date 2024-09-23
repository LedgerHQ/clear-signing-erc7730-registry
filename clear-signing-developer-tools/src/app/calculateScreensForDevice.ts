import type { PreviewData } from "~/types/PreviewData";

export const calculateScreensForDevice = (
  selectedDevice: "stax",
  data: PreviewData,
): PreviewData => {
  if (selectedDevice === "stax") {
    return data;
  }
  return data;
};
