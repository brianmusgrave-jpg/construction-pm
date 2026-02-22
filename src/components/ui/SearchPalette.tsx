"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { globalSearch, type SearchResult } from "@/actions/search";
import {
  Search,
  X,
  FolderKanban,
  Layers,
  FileText,
  Users,
} from "lucide-react";

const typeIcons: Record<string, typeof FolderKanban> = {
  project: FolderKanban,
  phase: Layers,
  document: FileText,
  staff: Users,
};

const typeLabels: Record<string, string> = {
  project: "Project",
  phase: "Phase",
  document: "Document",
  staff: "Staff",
};

export function SearchPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setResults([]);
      setSelectedIdx(0);
    }
  }, [open]);

  // Debounced search
  const doSearch = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await globalSearch(q);
        setResults(r);
        setSelectedIdx(0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
  }, []);

  function handleInputChange(value: string) {
    setQuery(value);
    doSearch(value);
  }

  function navigate(result: SearchResult) {
    setOpen(false);
    router.push(result.href);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && results[selectedIdx]) {
      navigate(results[selectedIdx]);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100]" onClick={() => setOpen(false)}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Palette */}
      <div
        className="relative max-w-lg w-full mx-auto mt-[15vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
          {/* Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
            <Search className="w-5 h-5 text-gray-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search projects, phases, documents, staff…"
              className="flex-1 text-sm text-gray-900 placeholder-gray-400 outline-none bg-transparent"
            />
            {query && (
              <button
                onClick={() => {
                  setQuery("");
                  setResults([]);
                  inputRef.current?.focus();
                }}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium text-gray-400 bg-gray-100 rounded border border-gray-200">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-[50vh] overflow-y-auto">
            {loading && (
              <div className="px-4 py-6 text-center text-sm text-gray-400">
                Searching…
              </div>
            )}

            {!loading && query.length >= 2 && results.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-gray-400">
                No results for &ldquo;{query}&rdquo;
              </div>
            )}

            {!loading && results.length > 0 && (
              <ul className="py-2">
                {results.map((result, i) => {
                  const Icon = typeIcons[result.type] || FolderKanban;
                  return (
                    <li key={`${result.type}-${result.id}`}>
                      <button
                        onClick={() => navigate(result)}
                        onMouseEnter={() => setSelectedIdx(i)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                          i === selectedIdx
                            ? "bg-[var(--color-primary-bg)]"
                            : "hover:bg-gray-50"
                        }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            i === selectedIdx
                              ? "bg-[var(--color-primary)] text-white"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {result.title}
                          </p>
                          {result.subtitle && (
                            <p className="text-xs text-gray-500 truncate">
                              {result.subtitle}
                            </p>
                          )}
                        </div>
                        <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide shrink-0">
                          {typeLabels[result.type]}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {!loading && query.length < 2 && (
              <div className="px-4 py-6 text-center text-sm text-gray-400">
                Type at least 2 characters to search
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-gray-100 flex items-center gap-4 text-[10px] text-gray-400">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-gray-100 rounded border border-gray-200 text-[10px]">↑↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-gray-100 rounded border border-gray-200 text-[10px]">↵</kbd>
              Open
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-gray-100 rounded border border-gray-200 text-[10px]">esc</kbd>
              Close
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Small trigger button for the sidebar */
export function SearchButton() {
  return (
    <button
      onClick={() => {
        window.dispatchEvent(
          new KeyboardEvent("keydown", { key: "k", metaKey: true })
        );
      }}
      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
    >
      <Search className="w-5 h-5" />
      <span className="flex-1 text-left">Search…</span>
      <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium text-gray-400 bg-gray-100 rounded border border-gray-200">
        ⌘K
      </kbd>
    </button>
  );
}
