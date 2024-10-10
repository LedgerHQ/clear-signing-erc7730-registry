export const formatShortAddress = (address: string) =>
  `${address.slice(0, 4)}…${address.slice(-7)}`;
