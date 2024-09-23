import type { PreviewData } from "~/types/PreviewData";

export const calculateScreensForDevice = (
  selectedDevice: string,
  data: PreviewData,
): PreviewData => {
  if (selectedDevice === "stax") {
    return data;
  }
  return data;
};
