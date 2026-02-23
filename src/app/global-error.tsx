"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
        <h1 style={{ color: "#dc2626" }}>Something went wrong</h1>
        <pre style={{ background: "#fef2f2", padding: "1rem", borderRadius: "0.5rem", overflow: "auto", whiteSpace: "pre-wrap" }}>
          {error.message}
        </pre>
        {error.digest && (
          <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>
            Digest: {error.digest}
          </p>
        )}
        <pre style={{ background: "#f3f4f6", padding: "1rem", borderRadius: "0.5rem", overflow: "auto", whiteSpace: "pre-wrap", fontSize: "0.75rem", marginTop: "1rem" }}>
          {error.stack}
        </pre>
        <button
          onClick={() => reset()}
          style={{
            marginTop: "1rem",
            padding: "0.5rem 1rem",
            background: "#3b82f6",
            color: "white",
            border: "none",
            borderRadius: "0.375rem",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
