"use client";

import { useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "../../lib/supabaseClient";

type Fund = {
  id: string;
  name: string;
  fund_type: string;
  category: string | null;
  jurisdiction: string | null;
  currency: string | null;
  committed_capital: number | null;
  called_capital: number | null;
  status: string | null;
};

function formatAmount(value: number | null) {
  if (!value) return "-";

  if (value >= 10000000) {
    return `₹${(value / 10000000).toFixed(1)} Cr`;
  }

  return `₹${value.toLocaleString("en-IN")}`;
}

export default function DatabaseTestPage() {
  const [funds, setFunds] = useState<Fund[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadFunds() {
      if (!isSupabaseConfigured || !supabase) {
        setErrorMessage("Supabase is not configured. Please check .env.local.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("funds")
        .select(
          "id, name, fund_type, category, jurisdiction, currency, committed_capital, called_capital, status"
        )
        .order("created_at", { ascending: false });

      if (error) {
        setErrorMessage(error.message);
      } else {
        setFunds(data ?? []);
      }

      setLoading(false);
    }

    loadFunds();
  }, []);

  return (
    <main className="app-page">
      <section className="app-shell">
        <div className="app-header">
          <div>
            <p className="eyebrow">VENTIQ Backend Test</p>
            <h1>Supabase Connection</h1>
            <p>
              This page checks whether VENTIQ can read fund data from the new
              database.
            </p>
          </div>

          <a className="back-link" href="/">
            Back to Home
          </a>
        </div>

        <div className="preview-card">
          <h2>Funds Table</h2>

          {loading && <p>Loading funds from Supabase...</p>}

          {!loading && errorMessage && (
            <div className="explain-box">
              <strong>Error:</strong> {errorMessage}
            </div>
          )}

          {!loading && !errorMessage && funds.length > 0 && (
            <div
              style={{
                display: "grid",
                gap: "12px",
                marginTop: "24px",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1.2fr 1fr 1fr 0.8fr",
                  gap: "16px",
                  padding: "16px 18px",
                  borderRadius: "14px",
                  background: "rgba(255, 255, 255, 0.04)",
                  color: "#9fb4d1",
                  fontWeight: 700,
                }}
              >
                <span>Fund</span>
                <span>Type</span>
                <span>Committed</span>
                <span>Called</span>
                <span>Status</span>
              </div>

              {funds.map((fund) => (
                <div
                  key={fund.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1.2fr 1fr 1fr 0.8fr",
                    gap: "16px",
                    padding: "18px",
                    border: "1px solid rgba(120, 150, 200, 0.22)",
                    borderRadius: "14px",
                    background: "rgba(3, 8, 18, 0.45)",
                    alignItems: "center",
                  }}
                >
                  <span>{fund.name}</span>
                  <span>{fund.fund_type}</span>
                  <span>{formatAmount(fund.committed_capital)}</span>
                  <span>{formatAmount(fund.called_capital)}</span>
                  <span>{fund.status}</span>
                </div>
              ))}
            </div>
          )}

          {!loading && !errorMessage && funds.length === 0 && (
            <p>No funds found in database.</p>
          )}
        </div>
      </section>
    </main>
  );
}