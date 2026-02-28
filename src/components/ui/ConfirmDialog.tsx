"use client";

/**
 * @file ConfirmDialog.tsx
 * @description Global async confirm dialog replacing native window.confirm().
 * Wrap the app with <ConfirmDialogProvider>; call `const confirm = useConfirmDialog()`
 * in any client component and `await confirm(message, opts?)` returns a Promise<boolean>.
 * Supports a `danger` variant (red button) for destructive actions.
 */

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { AlertTriangle, HelpCircle } from "lucide-react";

/* ── Types ── */

type ConfirmOptions = {
  danger?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  title?: string;
};

type ConfirmFn = (message: string, opts?: ConfirmOptions) => Promise<boolean>;

type DialogState = {
  open: boolean;
  message: string;
  opts: ConfirmOptions;
};

/* ── Context ── */

const ConfirmContext = createContext<ConfirmFn>(async () => false);

/* ── Provider ── */

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<DialogState>({
    open: false,
    message: "",
    opts: {},
  });

  // Stable ref to the resolver so we don't close over stale state
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm: ConfirmFn = useCallback((message, opts = {}) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setDialog({ open: true, message, opts });
    });
  }, []);

  function handleConfirm() {
    setDialog((d) => ({ ...d, open: false }));
    resolverRef.current?.(true);
    resolverRef.current = null;
  }

  function handleCancel() {
    setDialog((d) => ({ ...d, open: false }));
    resolverRef.current?.(false);
    resolverRef.current = null;
  }

  const { open, message, opts } = dialog;
  const isDanger = opts.danger ?? false;
  const confirmLabel = opts.confirmLabel ?? (isDanger ? "Delete" : "Confirm");
  const cancelLabel = opts.cancelLabel ?? "Cancel";
  const title = opts.title ?? (isDanger ? "Confirm deletion" : "Confirm action");

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
        >
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={handleCancel}
          />

          {/* Modal */}
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm mx-auto p-6 animate-in fade-in zoom-in-95 duration-150">
            {/* Icon + title */}
            <div className="flex items-start gap-3 mb-3">
              <div
                className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
                  isDanger ? "bg-red-100" : "bg-blue-50"
                }`}
              >
                {isDanger ? (
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                ) : (
                  <HelpCircle className="w-5 h-5 text-blue-600" />
                )}
              </div>
              <div>
                <h2
                  id="confirm-dialog-title"
                  className="text-sm font-semibold text-gray-900"
                >
                  {title}
                </h2>
                <p className="mt-1 text-sm text-gray-500 leading-snug">{message}</p>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-300"
                autoFocus={!isDanger}
              >
                {cancelLabel}
              </button>
              <button
                onClick={handleConfirm}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                  isDanger
                    ? "bg-red-600 hover:bg-red-700 focus:ring-red-500"
                    : "bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] focus:ring-[var(--color-primary)]"
                }`}
                autoFocus={isDanger}
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

/* ── Hook ── */

export function useConfirmDialog(): ConfirmFn {
  return useContext(ConfirmContext);
}
