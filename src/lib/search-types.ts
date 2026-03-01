/**
 * @file search-types.ts
 * @description Shared type for global search results across all entity types.
 *
 * Used by `src/actions/search.ts` (server) and the CommandPalette / SearchBar
 * components (client). The `href` field is a fully-formed internal link that
 * components can pass directly to `next/link`.
 */

/**
 * A single unified search result, regardless of entity type.
 *
 * @example
 *   { type: "phase", id: "...", title: "Foundation Pour", subtitle: "123 Main St", href: "/dashboard/projects/.../phases/..." }
 */
export type SearchResult = {
  /** The kind of entity this result represents. */
  type: "project" | "phase" | "document" | "staff" | "voice_note" | "voice_memo";
  /** The entity's database ID. */
  id: string;
  /** Primary display text (project name, phase name, document title, staff name). */
  title: string;
  /** Secondary display text — typically the parent project or entity detail. */
  subtitle?: string;
  /** Internal navigation URL for `next/link`. */
  href: string;
};
