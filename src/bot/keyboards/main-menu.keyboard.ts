import { Keyboard } from "grammy";
import {
  defaultLanguage,
  supportedLanguages,
  SupportedLanguage,
} from "../i18n/language";
import { getMessages, MenuMessages } from "../i18n/translations";

type MenuButtonKey = keyof MenuMessages;

const MAIN_MENU_LAYOUT: MenuButtonKey[][] = [
  ["reportDay"],
  [ "history", "moreReports"],
  [ "addFamilyExpense", "addPersonalExpense"],
  [ "addIncome", "deleteLast" ],
  ["settings", "help"],
];

export function createMainMenuKeyboard(
  language: SupportedLanguage = defaultLanguage
): Keyboard {
  const menu = getMessages(language).menu;
  const keyboard = new Keyboard();

  MAIN_MENU_LAYOUT.forEach((row, rowIndex) => {
    row.forEach((key) => {
      keyboard.text(menu[key]);
    });

    if (rowIndex < MAIN_MENU_LAYOUT.length - 1) {
      keyboard.row();
    }
  });

  return keyboard.resized();
}

export function getMainMenuButtonTexts(key: MenuButtonKey): string[] {
  return supportedLanguages.map((language) => getMessages(language).menu[key]);
}

export function isMainMenuButtonText(text: string): boolean {
  return supportedLanguages.some((language) =>
    Object.values(getMessages(language).menu).includes(text)
  );
}
