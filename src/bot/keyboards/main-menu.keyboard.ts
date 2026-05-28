import { Keyboard } from "grammy";
import {
  defaultLanguage,
  supportedLanguages,
  SupportedLanguage,
} from "../i18n/language";
import { getMessages, MenuMessages } from "../i18n/translations";
import { ExpenseScopeMode } from "../../infrastructure/database/models/user.model";

type MenuButtonKey = keyof MenuMessages;

const MAIN_MENU_LAYOUT: MenuButtonKey[][] = [
  ["reportDay"],
  [ "history", "moreReports"],
  [ "addFamilyExpense", "addPersonalExpense"],
  [ "addIncome", "deleteLast" ],
  ["settings", "help"],
];

const SINGLE_EXPENSE_MENU_LAYOUT: MenuButtonKey[][] = [
  ["reportDay"],
  [ "history", "moreReports"],
  [ "addExpense", "addIncome"],
  [ "settings", "help" ],
];

export function createMainMenuKeyboard(
  language: SupportedLanguage = defaultLanguage,
  expenseScopeMode: ExpenseScopeMode = "separate"
): Keyboard {
  const menu = getMessages(language).menu;
  const keyboard = new Keyboard();
  const layout =
    expenseScopeMode === "separate"
      ? MAIN_MENU_LAYOUT
      : SINGLE_EXPENSE_MENU_LAYOUT;

  layout.forEach((row, rowIndex) => {
    row.forEach((key) => {
      keyboard.text(menu[key]);
    });

    if (rowIndex < layout.length - 1) {
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
