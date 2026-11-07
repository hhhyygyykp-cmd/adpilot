import type { Language } from "./types";
import { ar } from "./messages/ar";
import { en } from "./messages/en";

export type Dict = typeof en;

const dictionaries: Record<Language, Dict> = { en, ar };

export function isLanguage(value: unknown): value is Language {
  return value === "en" || value === "ar";
}

export function getDict(language: Language): Dict {
  return dictionaries[language] ?? en;
}

export function interpolate(template: string, vars?: Record<string, string>) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? "");
}
