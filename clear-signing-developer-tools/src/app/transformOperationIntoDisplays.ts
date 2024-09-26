import type { Operation } from "~/types/PreviewData";

export const transformOperationIntoDisplays = (
  operation: Operation,
  selectedDevice: string,
) => {
  if (selectedDevice === "stax") {
    return operation.displays.map((display) => [display]);
  }
  return operation.displays.map((display) => [display]);
};
