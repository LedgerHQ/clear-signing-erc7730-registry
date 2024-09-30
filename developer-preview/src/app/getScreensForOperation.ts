import type { DisplayItem, Operation } from "~/types/PreviewData";

export const getScreensForOperation = (operation: Operation) => {
  const { displays } = operation;
  const itemsPerScreen = 4;

  const screens: Screen[] = [];
  let screen: DisplayItem[] = [];

  for (let i = 0; i < displays.length; i++) {
    const isLastItem = i === displays.length - 1;

    screen.push(displays[i]!);

    if (screen.length === itemsPerScreen || isLastItem) {
      screens.push(screen);
      screen = [];
    }
  }

  return screens;
};

export type Screen = DisplayItem[];
