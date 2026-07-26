"use client";

import { type FormEvent, useMemo, useState } from "react";

type Lead = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  role: string | null;
  firm_type: string | null;
  primary_interest: string | null;
  message: string | null;
  source: string | null;
  status: string | null;
  created_at: string | null;
};

const statusOptions = ["New", "Contacted", "Qualified", "Not fit", "Closed"];

function formatDate(value: string | null) {
  if (!value) return "Not available";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function FounderLeadsPage() {
  const [founderKey, setFounderKey] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [statusFilter, setStatusFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [updatingLeadId, setUpdatingLeadId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const matchesStatus =
        statusFilter === "All" || (lead.status || "New") === statusFilter;

      const searchText = [
        lead.name,
        lead.email,
        lead.phone,
        lead.company,
        lead.role,
        lead.firm_type,
        lead.primary_interest,
        lead.message,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !searchTerm.trim() ||
        searchText.includes(searchTerm.trim().toLowerCase());

      return matchesStatus && matchesSearch;
    });
  }, [leads, statusFilter, searchTerm]);

  const leadSummary = useMemo(() => {
    return {
      total: leads.length,
      newLeads: leads.filter((lead) => (lead.status || "New") === "New").length,
      contacted: leads.filter((lead) => lead.status === "Contacted").length,
      qualified: leads.filter((lead) => lead.status === "Qualified").length,
    };
  }, [leads]);

  async function loadLeads(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    setIsLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await fetch("/api/founder/leads", {
        method: "GET",
        headers: {
          "x-founder-key": founderKey,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to load founder leads.");
      }

      setLeads(result.leads || []);
      setIsUnlocked(true);
      setSuccessMessage("Founder lead inbox loaded successfully.");
    } catch (error) {
      setIsUnlocked(false);
      setLeads([]);
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to load leads."
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function updateLeadStatus(leadId: string, nextStatus: string) {
    setUpdatingLeadId(leadId);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await fetch("/api/founder/leads", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-founder-key": founderKey,
        },
        body: JSON.stringify({
          id: leadId,
          status: nextStatus,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to update lead status.");
      }

      setLeads((currentLeads) =>
        currentLeads.map((lead) =>
          lead.id === leadId ? { ...lead, status: result.lead.status } : lead
        )
      );

      setSuccessMessage("Lead status updated.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to update lead."
      );
    } finally {
      setUpdatingLeadId("");
    }
  }

  return (
    <main className="app-page">
      <section className="app-shell">
        <div className="app-header">
          <div>
            <p className="eyebrow">Founder Admin · Hidden Page</p>
            <h1>VENTIQ Lead Inbox</h1>
            <p>
              Review walkthrough requests submitted from the VENTIQ homepage.
              This page is hidden from public navigation and protected by your
              founder access key.
            </p>
          </div>

          <a className="back-link" href="/">
            Back to Home
          </a>
        </div>

        <div className="sample-data-ribbon">
          Hidden founder workspace · Walkthrough requests · Lead qualification ·
          Follow-up tracking
        </div>

        <div className="preview-card">
          <h2>Founder Access</h2>

          <form onSubmit={loadLeads}>
            <div className="demo-form-grid">
              <label>
                Founder Access Key
                <input
                  required
                  type="password"
                  placeholder="Enter your founder key"
                  value={founderKey}
                  onChange={(event) => setFounderKey(event.target.value)}
                />
              </label>
            </div>

            <div className="action-row" style={{ marginTop: "18px" }}>
              <button
                className="monitor-btn monitor-btn-primary"
                type="submit"
                disabled={isLoading}
              >
                {isLoading ? "Loading Leads..." : "Unlock Lead Inbox"}
              </button>

              {isUnlocked && (
                <button
                  className="monitor-btn monitor-btn-secondary"
                  type="button"
                  onClick={() => loadLeads()}
                  disabled={isLoading}
                >
                  Refresh Leads
                </button>
              )}
            </div>
          </form>
        </div>

        {successMessage && (
          <div className="explain-box">✅ {successMessage}</div>
        )}

        {errorMessage && <div className="explain-box">⚠️ {errorMessage}</div>}

        {isUnlocked && (
          <>
            <div className="impact-grid">
              <div className="impact-card">
                <h3>{leadSummary.total}</h3>
                <p>Total requests</p>
              </div>

              <div className="impact-card">
                <h3>{leadSummary.newLeads}</h3>
                <p>New leads</p>
              </div>

              <div className="impact-card">
                <h3>{leadSummary.contacted}</h3>
                <p>Contacted</p>
              </div>

              <div className="impact-card">
                <h3>{leadSummary.qualified}</h3>
                <p>Qualified</p>
              </div>
            </div>

            <div className="preview-card">
              <h2>Filter Leads</h2>

              <div className="demo-form-grid">
                <label>
                  Search
                  <input
                    type="text"
                    placeholder="Search by name, email, company, role or message"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                  />
                </label>

                <label>
                  Status
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                  >
                    <option>All</option>
                    {statusOptions.map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="preview-card">
              <h2>Walkthrough Requests</h2>

              {filteredLeads.length === 0 ? (
                <div className="explain-box">
                  No walkthrough requests found for the selected filter.
                </div>
              ) : (
                <div className="queue-grid">
                  {filteredLeads.map((lead) => (
                    <div key={lead.id} className="queue-item">
                      <span className="small-pill">{lead.status || "New"}</span>
                      <br />

                      <strong>{lead.name}</strong>
                      <br />

                      <span>Email: {lead.email}</span>
                      <br />

                      <span>Phone: {lead.phone || "Not provided"}</span>
                      <br />

                      <span>Company: {lead.company || "Not provided"}</span>
                      <br />

                      <span>Role: {lead.role || "Not provided"}</span>
                      <br />

                      <span>Firm type: {lead.firm_type || "Not selected"}</span>
                      <br />

                      <span>
                        Interest: {lead.primary_interest || "Not selected"}
                      </span>
                      <br />

                      <span>Received: {formatDate(lead.created_at)}</span>
                      <br />

                      <span>Source: {lead.source || "useventiq.com"}</span>

                      {lead.message && (
                        <>
                          <br />
                          <br />
                          <strong>Message</strong>
                          <br />
                          <span>{lead.message}</span>
                        </>
                      )}

                      <div className="action-row" style={{ marginTop: "18px" }}>
                        {statusOptions.map((status) => (
                          <button
                            key={status}
                            className={
                              (lead.status || "New") === status
                                ? "monitor-btn monitor-btn-primary"
                                : "monitor-btn monitor-btn-secondary"
                            }
                            type="button"
                            disabled={updatingLeadId === lead.id}
                            onClick={() => updateLeadStatus(lead.id, status)}
                          >
                            {updatingLeadId === lead.id
                              ? "Updating..."
                              : status}
                          </button>
                        ))}
                      </div>

                      <div className="action-row" style={{ marginTop: "12px" }}>
                        <a
                          className="monitor-btn monitor-btn-secondary"
                          href={`mailto:${lead.email}?subject=${encodeURIComponent(
                            "VENTIQ Walkthrough"
                          )}&body=${encodeURIComponent(
                            `Hi ${lead.name},\n\nThanks for your interest in VENTIQ.\n\nHappy to schedule a walkthrough and understand your private capital operations workflow.\n\nRegards,\nShubham`
                          )}`}
                        >
                          Email Lead
                        </a>

                        {lead.phone && (
                          <a
                            className="monitor-btn monitor-btn-secondary"
                            href={`https://wa.me/${lead.phone.replace(
                              /\D/g,
                              ""
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            WhatsApp
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </main>
  );
}