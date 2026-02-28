export type SearchResult = {
  type: "project" | "phase" | "document" | "staff";
  id: string;
  title: string;
  subtitle?: string;
  href: string;
};
