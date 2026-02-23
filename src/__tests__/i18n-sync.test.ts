import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// Read all locale files and verify they have the same keys
const MESSAGES_DIR = path.join(process.cwd(), "messages");
const LOCALES = ["en", "es", "pt", "fr"];

function readLocale(locale: string): Record<string, unknown> {
  const filePath = path.join(MESSAGES_DIR, `${locale}.json`);
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function flattenKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      keys.push(...flattenKeys(value as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys.sort();
}

describe("i18n Key Sync", () => {
  const localeData: Record<string, Record<string, unknown>> = {};
  const localeKeys: Record<string, string[]> = {};

  // Load all locale files
  for (const locale of LOCALES) {
    localeData[locale] = readLocale(locale);
    localeKeys[locale] = flattenKeys(localeData[locale]);
  }

  it("all locale files exist", () => {
    for (const locale of LOCALES) {
      const filePath = path.join(MESSAGES_DIR, `${locale}.json`);
      expect(fs.existsSync(filePath), `Missing ${locale}.json`).toBe(true);
    }
  });

  it("all locales have the same number of keys", () => {
    const enCount = localeKeys["en"].length;
    for (const locale of LOCALES) {
      expect(
        localeKeys[locale].length,
        `${locale} has ${localeKeys[locale].length} keys, expected ${enCount}`
      ).toBe(enCount);
    }
  });

  it("all locales have identical key sets (no missing/extra keys)", () => {
    const enKeys = new Set(localeKeys["en"]);

    for (const locale of LOCALES.filter((l) => l !== "en")) {
      const otherKeys = new Set(localeKeys[locale]);

      const missingInOther = localeKeys["en"].filter((k) => !otherKeys.has(k));
      const extraInOther = localeKeys[locale].filter((k) => !enKeys.has(k));

      expect(
        missingInOther,
        `Keys missing in ${locale}: ${missingInOther.slice(0, 5).join(", ")}${missingInOther.length > 5 ? "..." : ""}`
      ).toEqual([]);
      expect(
        extraInOther,
        `Extra keys in ${locale}: ${extraInOther.slice(0, 5).join(", ")}${extraInOther.length > 5 ? "..." : ""}`
      ).toEqual([]);
    }
  });

  it("no empty string values in any locale", () => {
    for (const locale of LOCALES) {
      const keys = localeKeys[locale];
      for (const key of keys) {
        const parts = key.split(".");
        let val: unknown = localeData[locale];
        for (const part of parts) {
          val = (val as Record<string, unknown>)[part];
        }
        expect(
          val !== "",
          `Empty value for ${locale}.${key}`
        ).toBe(true);
      }
    }
  });

  it("has at least 500 translation keys", () => {
    expect(localeKeys["en"].length).toBeGreaterThanOrEqual(500);
  });

  it("has expected top-level namespaces", () => {
    const topLevel = Object.keys(localeData["en"]);
    const requiredNamespaces = [
      "common",
      "dashboard",
      "projects",
      "phases",
      "budget",
      "notifications",
      "settings",
      "help",
    ];
    for (const ns of requiredNamespaces) {
      expect(topLevel, `Missing namespace: ${ns}`).toContain(ns);
    }
  });
});
