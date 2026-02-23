import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const SRC_DIR = path.join(process.cwd(), "src");
const ACTIONS_DIR = path.join(SRC_DIR, "actions");
const COMPONENTS_DIR = path.join(SRC_DIR, "components");

function readFile(filePath: string): string {
  return fs.readFileSync(filePath, "utf-8");
}

function listFiles(dir: string, ext?: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(fullPath, ext));
    } else if (!ext || entry.name.endsWith(ext)) {
      files.push(fullPath);
    }
  }
  return files;
}

describe("Architecture Smoke Tests", () => {
  describe("Server actions", () => {
    const actionFiles = listFiles(ACTIONS_DIR, ".ts");

    it("has at least 20 server action files", () => {
      expect(actionFiles.length).toBeGreaterThanOrEqual(20);
    });

    it("all action files have 'use server' directive", () => {
      for (const file of actionFiles) {
        const content = readFile(file);
        const relPath = path.relative(process.cwd(), file);
        expect(
          content.includes('"use server"') || content.includes("'use server'"),
          `${relPath} missing "use server" directive`
        ).toBe(true);
      }
    });

    it("action files only export async functions (no const/type/interface exports)", () => {
      for (const file of actionFiles) {
        const content = readFile(file);
        const relPath = path.relative(process.cwd(), file);
        const lines = content.split("\n");

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          // Skip non-export lines
          if (!line.startsWith("export ")) continue;
          // Skip async function exports (these are valid)
          if (line.startsWith("export async function")) continue;
          // Skip export default (allowed)
          if (line.startsWith("export default")) continue;
          // Type exports are allowed (they're erased at compile time)
          if (line.startsWith("export type") || line.startsWith("export interface")) continue;

          // Anything else (export const, export function without async, export class) is a build-breaker
          expect(
            false,
            `${relPath}:${i + 1} has non-async export: "${line.slice(0, 60)}..."`
          ).toBe(true);
        }
      }
    });
  });

  describe("Components", () => {
    const componentFiles = listFiles(COMPONENTS_DIR, ".tsx");

    it("has at least 40 component files", () => {
      expect(componentFiles.length).toBeGreaterThanOrEqual(40);
    });

    it("client components have 'use client' directive", () => {
      // Components using hooks or browser APIs need "use client"
      const clientIndicators = ["useState", "useEffect", "useRef", "onClick", "onChange"];
      let clientMissing = 0;
      const issues: string[] = [];

      for (const file of componentFiles) {
        const content = readFile(file);
        const relPath = path.relative(process.cwd(), file);
        const hasClientIndicator = clientIndicators.some((indicator) =>
          content.includes(indicator)
        );
        const hasUseClient =
          content.includes('"use client"') || content.includes("'use client'");

        if (hasClientIndicator && !hasUseClient) {
          clientMissing++;
          issues.push(relPath);
        }
      }

      expect(
        clientMissing,
        `Components using hooks/events without "use client": ${issues.slice(0, 3).join(", ")}${issues.length > 3 ? "..." : ""}`
      ).toBe(0);
    });
  });

  describe("Key files exist", () => {
    const criticalFiles = [
      "src/middleware.ts",
      "src/lib/permissions.ts",
      "src/lib/auth.ts",
      "src/lib/db.ts",
      "src/lib/offline-queue.ts",
      "src/lib/offline-action.ts",
      "src/lib/offline-handlers.ts",
      "src/hooks/useOfflineSync.ts",
      "src/components/ui/OfflineIndicator.tsx",
      "src/components/ui/OfflineSyncProvider.tsx",
      "prisma/schema.prisma",
      "public/sw.js",
      "public/manifest.json",
      "messages/en.json",
      "messages/es.json",
      "messages/pt.json",
      "messages/fr.json",
    ];

    for (const file of criticalFiles) {
      it(`${file} exists`, () => {
        const fullPath = path.join(process.cwd(), file);
        expect(fs.existsSync(fullPath), `Missing: ${file}`).toBe(true);
      });
    }
  });

  describe("Prisma schema", () => {
    const schema = readFile(path.join(process.cwd(), "prisma/schema.prisma"));

    it("has at least 30 models", () => {
      const modelCount = (schema.match(/^model /gm) || []).length;
      expect(modelCount).toBeGreaterThanOrEqual(30);
    });

    it("has at least 10 enums", () => {
      const enumCount = (schema.match(/^enum /gm) || []).length;
      expect(enumCount).toBeGreaterThanOrEqual(10);
    });

    it("includes core models", () => {
      const requiredModels = [
        "User",
        "Project",
        "Phase",
        "ProjectMember",
        "Checklist",
        "Notification",
        "ChangeOrder",
        "DailyLog",
        "Inspection",
        "Material",
      ];
      for (const model of requiredModels) {
        expect(schema, `Missing model: ${model}`).toContain(`model ${model}`);
      }
    });
  });

  describe("PWA manifest", () => {
    const manifest = JSON.parse(
      readFile(path.join(process.cwd(), "public/manifest.json"))
    );

    it("has required PWA fields", () => {
      expect(manifest.name).toBeDefined();
      expect(manifest.short_name).toBeDefined();
      expect(manifest.start_url).toBeDefined();
      expect(manifest.display).toBe("standalone");
      expect(manifest.icons).toBeDefined();
      expect(manifest.icons.length).toBeGreaterThan(0);
    });
  });
});
