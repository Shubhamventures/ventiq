"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            padding: "32px",
            background: "#08111f",
            color: "#e5eefc",
            fontFamily: "Arial, sans-serif",
          }}
        >
          <section style={{ maxWidth: "620px", textAlign: "center" }}>
            <h1 style={{ marginBottom: "12px" }}>VENTIQ encountered an unexpected error.</h1>
            <p style={{ lineHeight: 1.6, color: "#b9c9e5" }}>
              The incident has been captured for operational review. Please reload the page.
              If the issue continues, contact your VENTIQ administrator.
            </p>
          </section>
        </main>
      </body>
    </html>
  );
}
