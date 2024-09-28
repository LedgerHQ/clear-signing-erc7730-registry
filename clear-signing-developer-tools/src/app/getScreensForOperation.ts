import type { DisplayItem, Operation } from "~/types/PreviewData";

const ITEMS_PER_SCREEN = 3;

export const getScreensForOperation = (operation: Operation) => {
  const { displays } = operation;

  const screens: Screen[] = [];
  let screen: DisplayItem[] = [];

  for (let i = 0; i < displays.length; i++) {
    const isLastItem = i === displays.length - 1;

    screen.push(displays[i]!);

    if (screen.length === ITEMS_PER_SCREEN || isLastItem) {
      screens.push(screen);
      screen = [];
    }
  }

  return screens;
};

type Screen = DisplayItem[];
