"use client";

import { useMemo, useState } from "react";

type CircularRecord = {
  id: string;
  authority: string;
  circularNumber: string;
  title: string;
  savedAs: string;
  topic: string;
  impact: "HIGH" | "MEDIUM" | "LOW";
  effectiveDate: string;
  summary: string;
  whatChanged: string;
  affectedWorkflows: string[];
  impactedFunds: string[];
  recommendedActions: string[];
  checklist: string[];
  relatedCirculars: string[];
  aliases: string[];
  owner: string;
  internalNote: string;
  linkedSop: string;
};

const circulars: CircularRecord[] = [
  {
    id: "valuation-rules",
    authority: "SEBI",
    circularNumber: "SEBI Circular - Valuation Update",
    title: "AIF Valuation and Quarterly Reporting Update",
    savedAs: "Valuation Rules",
    topic: "Valuation",
    impact: "HIGH",
    effectiveDate: "15 June 2026",
    summary:
      "This circular impacts valuation methodology, NAV review, quarterly reporting packs and audit support for AIFs.",
    whatChanged:
      "VENTIQ has identified that the circular requires fund teams to review valuation assumptions, update valuation documentation, strengthen audit evidence and ensure investor reporting is aligned with updated valuation practices.",
    affectedWorkflows: [
      "Valuation",
      "NAV Calculation",
      "Investor Reporting",
      "Quarterly Reporting",
      "Audit Support",
      "QCR",
      "Finance Review",
    ],
    impactedFunds: [
      "Category II AIF",
      "Venture Debt Funds",
      "Private Credit Funds",
      "GIFT City Funds",
    ],
    recommendedActions: [
      "Open Valuation Workspace",
      "Generate Compliance Checklist",
      "Compare Previous Circular",
      "Assign Finance Team",
      "Notify Auditors",
      "Generate Updated SOP",
    ],
    checklist: [
      "Update valuation policy",
      "Review quarterly valuation pack",
      "Inform auditors",
      "Update NAV review process",
      "Train finance team",
      "Check investor reporting templates",
    ],
    relatedCirculars: [
      "AIF Valuation Update",
      "NAV Reporting Circular",
      "QCR Filing Clarification",
      "Investor Reporting Rules",
      "Audit Support Circular",
    ],
    aliases: [
      "Valuation Rules",
      "NAV Circular",
      "Quarterly Valuation",
      "Fair Value",
      "QCR Valuation",
      "Pricing Circular",
    ],
    owner: "Finance Head",
    internalNote:
      "Use this circular while preparing quarterly valuation packs and audit support files.",
    linkedSop: "Quarterly Valuation SOP v3",
  },
  {
    id: "form-64c-64d",
    authority: "Income Tax",
    circularNumber: "Income Tax Reporting Guidance",
    title: "Investor Tax Reporting and Form 64C / 64D Process",
    savedAs: "64C / 64D Rules",
    topic: "Tax Reporting",
    impact: "HIGH",
    effectiveDate: "01 April 2026",
    summary:
      "This update affects investor-wise tax reporting, annual investor communication and fund-level income allocation workflows.",
    whatChanged:
      "VENTIQ has identified that finance teams should validate investor-wise income allocation, reconcile tax reports with fund books and prepare investor communication for tax reporting.",
    affectedWorkflows: [
      "Tax Reporting",
      "Investor Reporting",
      "Distribution",
      "Fund Accounting",
      "Annual Compliance",
    ],
    impactedFunds: [
      "Category I AIF",
      "Category II AIF",
      "Debt Funds",
      "PE Funds",
    ],
    recommendedActions: [
      "Open Tax Reporting Workspace",
      "Generate 64C Checklist",
      "Review Investor Income Allocation",
      "Prepare Investor Communication",
      "Assign Tax Team",
      "Generate Tax SOP",
    ],
    checklist: [
      "Validate investor PAN and KYC details",
      "Review income allocation",
      "Reconcile tax data with books",
      "Prepare Form 64C support",
      "Prepare Form 64D support",
      "Review investor communication",
    ],
    relatedCirculars: [
      "Pass-through Taxation Guidance",
      "Investor Reporting Rules",
      "Annual Tax Filing Checklist",
      "Distribution Tax Note",
    ],
    aliases: [
      "64C",
      "64D",
      "Tax Certificate",
      "Pass Through Tax",
      "Investor Tax",
      "Annual Tax Reporting",
    ],
    owner: "Tax and Finance Team",
    internalNote:
      "Use this for annual investor tax reporting and income allocation review.",
    linkedSop: "Investor Tax Reporting SOP v2",
  },
  {
    id: "gift-city-reporting",
    authority: "IFSCA",
    circularNumber: "IFSCA Fund Reporting Update",
    title: "GIFT City Fund Reporting and Compliance Update",
    savedAs: "GIFT City Reporting",
    topic: "GIFT City",
    impact: "MEDIUM",
    effectiveDate: "01 July 2026",
    summary:
      "This update affects GIFT City fund reporting, compliance tracking and offshore investor communication.",
    whatChanged:
      "VENTIQ has identified that GIFT City funds should review reporting calendars, investor communication templates and compliance responsibility mapping.",
    affectedWorkflows: [
      "GIFT City Compliance",
      "Investor Reporting",
      "Regulatory Filing",
      "Fund Operations",
    ],
    impactedFunds: ["GIFT City Funds", "Offshore Feeder Funds", "IFSC Funds"],
    recommendedActions: [
      "Open GIFT Compliance Workspace",
      "Generate Filing Calendar",
      "Review Investor Templates",
      "Assign Compliance Owner",
    ],
    checklist: [
      "Review IFSCA reporting calendar",
      "Update internal compliance tracker",
      "Map responsible team members",
      "Review investor reporting templates",
      "Update board / trustee reporting pack",
    ],
    relatedCirculars: [
      "IFSCA Fund Management Regulations",
      "GIFT City Filing Checklist",
      "Offshore Investor Reporting Note",
    ],
    aliases: [
      "GIFT City",
      "IFSCA",
      "IFSC Reporting",
      "Offshore Fund",
      "Gift Compliance",
    ],
    owner: "Compliance Team",
    internalNote:
      "Use this for GIFT City fund reporting and quarterly compliance calendar.",
    linkedSop: "GIFT City Compliance SOP v1",
  },
  {
    id: "capital-call-investor-disclosure",
    authority: "SEBI",
    circularNumber: "SEBI Investor Disclosure Guidance",
    title: "Capital Call and Investor Disclosure Process",
    savedAs: "Capital Call Disclosure",
    topic: "Capital Call",
    impact: "MEDIUM",
    effectiveDate: "10 May 2026",
    summary:
      "This guidance impacts capital call notices, investor disclosures and approval evidence maintained by fund operations.",
    whatChanged:
      "VENTIQ has identified that capital call notices should have stronger approval records, investor-wise allocation backup and document audit trail.",
    affectedWorkflows: [
      "Capital Calls",
      "Investor Notices",
      "Document Engine",
      "Audit Trail",
      "Investor Portal",
    ],
    impactedFunds: [
      "Category II AIF",
      "Venture Debt Funds",
      "Private Equity Funds",
    ],
    recommendedActions: [
      "Open Capital Call Workspace",
      "Generate Investor Notice Checklist",
      "Review Approval Flow",
      "Store PDF Notices",
      "Update Audit Trail",
    ],
    checklist: [
      "Review capital call approval",
      "Validate investor allocation",
      "Generate investor-wise notices",
      "Store PDF records",
      "Update investor portal",
      "Maintain dispatch evidence",
    ],
    relatedCirculars: [
      "Investor Reporting Rules",
      "Capital Call Process Note",
      "Audit Trail Requirements",
    ],
    aliases: [
      "Capital Call",
      "Drawdown",
      "Investor Notice",
      "Capital Notice",
      "Funding Notice",
    ],
    owner: "Fund Operations Team",
    internalNote:
      "Use this while approving capital calls and generating investor notices.",
    linkedSop: "Capital Call SOP v4",
  },
];

function includesSearch(value: string | string[], searchTerm: string) {
  const source = Array.isArray(value) ? value.join(" ") : value;
  return source.toLowerCase().includes(searchTerm.toLowerCase());
}

export default function KnowledgeHub() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAuthority, setSelectedAuthority] = useState("All");
  const [selectedCircularId, setSelectedCircularId] =
    useState("valuation-rules");
  const [selectedQuestion, setSelectedQuestion] = useState(
    "What changed in this circular?"
  );

  const authorities = ["All", "SEBI", "IFSCA", "Income Tax", "RBI", "MCA"];

  const filteredCirculars = useMemo(() => {
    return circulars.filter((record) => {
      const authorityMatch =
        selectedAuthority === "All" || record.authority === selectedAuthority;

      const searchMatch =
        !searchTerm.trim() ||
        includesSearch(record.title, searchTerm) ||
        includesSearch(record.savedAs, searchTerm) ||
        includesSearch(record.topic, searchTerm) ||
        includesSearch(record.authority, searchTerm) ||
        includesSearch(record.circularNumber, searchTerm) ||
        includesSearch(record.aliases, searchTerm) ||
        includesSearch(record.affectedWorkflows, searchTerm) ||
        includesSearch(record.impactedFunds, searchTerm);

      return authorityMatch && searchMatch;
    });
  }, [searchTerm, selectedAuthority]);

  const selectedCircular =
    circulars.find((record) => record.id === selectedCircularId) ?? circulars[0];

  const highImpactCount = circulars.filter(
    (record) => record.impact === "HIGH"
  ).length;

  const affectedWorkflowCount = selectedCircular.affectedWorkflows.length;
  const impactedFundCount = selectedCircular.impactedFunds.length;
  const pendingActionCount = selectedCircular.recommendedActions.length;

  function buildAiAnswer(question: string) {
    if (question === "What changed in this circular?") {
      return selectedCircular.whatChanged;
    }

    if (question === "Which workflows are affected?") {
      return `VENTIQ found ${selectedCircular.affectedWorkflows.length} affected workflows: ${selectedCircular.affectedWorkflows.join(
        ", "
      )}.`;
    }

    if (question === "Which funds are impacted?") {
      return `VENTIQ found that this update may impact ${selectedCircular.impactedFunds.join(
        ", "
      )}. The final impact should be reviewed fund-wise by finance and compliance teams.`;
    }

    if (question === "What should the team do next?") {
      return `VENTIQ recommends ${selectedCircular.recommendedActions[0]} as the first action, followed by checklist generation, SOP update and owner assignment.`;
    }

    if (question === "Create an SOP from this circular.") {
      return `VENTIQ can convert this circular into an SOP covering scope, applicability, owner, frequency, checklist, review evidence and audit trail. Linked SOP suggestion: ${selectedCircular.linkedSop}.`;
    }

    return selectedCircular.summary;
  }

  const questionOptions = [
    "What changed in this circular?",
    "Which workflows are affected?",
    "Which funds are impacted?",
    "What should the team do next?",
    "Create an SOP from this circular.",
  ];

  return (
    <main className="app-page">
      <section className="app-shell">
        <div className="app-header">
          <div>
            <p className="eyebrow">VENTIQ Regulatory Intelligence</p>
            <h1>Knowledge Hub AI</h1>
            <p>
              Track SEBI, IFSCA, Income Tax, RBI and MCA updates, understand
              fund impact, and convert circulars into workflows, checklists and
              SOPs.
            </p>
          </div>

          <a className="back-link" href="/">
            Back to Home
          </a>
        </div>

        <div className="preview-card">
          <h2>Ask VENTIQ AI</h2>

          <div className="form-card">
            <label>Search circulars, aliases, workflows or fund impact</label>
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Ask anything... valuation, Form 64C, GIFT City, capital call..."
            />

            <div className="logic-note">
              Natural Language Search • AI Summary • Regulatory Impact • Fund
              Workflows • SOP Generation
            </div>
          </div>
        </div>

        <div className="preview-card">
          <h2>Authorities</h2>

          <div className="queue-grid">
            {authorities.map((authority) => (
              <button
                key={authority}
                type="button"
                onClick={() => setSelectedAuthority(authority)}
                className="queue-item"
                style={{
                  textAlign: "left",
                  border:
                    selectedAuthority === authority
                      ? "1px solid rgba(96, 165, 250, 0.65)"
                      : undefined,
                  cursor: "pointer",
                  color: "#e5e7eb",
background:
  selectedAuthority === authority
    ? "rgba(37, 99, 235, 0.18)"
    : "rgba(15, 23, 42, 0.45)",
                }}
              >
                {authority}
              </button>
            ))}
          </div>
        </div>

        <div className="impact-grid">
          <div className="impact-card">
            <h3>{circulars.length}</h3>
            <p>Knowledge records</p>
          </div>

          <div className="impact-card">
            <h3>{highImpactCount}</h3>
            <p>High impact updates</p>
          </div>

          <div className="impact-card">
            <h3>{filteredCirculars.length}</h3>
            <p>Search results</p>
          </div>

          <div className="impact-card">
            <h3>AI Ready</h3>
            <p>Regulatory intelligence</p>
          </div>
        </div>

        <div className="knowledge-grid">
          <div className="preview-card">
            <h2>Search Results</h2>

            {filteredCirculars.length === 0 && (
              <div className="explain-box">
                No circulars found for the selected search.
              </div>
            )}

            <div className="queue-grid">
              {filteredCirculars.map((record) => (
                <button
                  key={record.id}
                  type="button"
                  onClick={() => {
                    setSelectedCircularId(record.id);
                    setSelectedQuestion("What changed in this circular?");
                  }}
                  className="queue-item"
                  style={{
                    textAlign: "left",
                    border:
                      selectedCircular.id === record.id
                        ? "1px solid rgba(96, 165, 250, 0.65)"
                        : undefined,
                    cursor: "pointer",
                    color: "#e5e7eb",
background:
  selectedCircular.id === record.id
    ? "rgba(37, 99, 235, 0.18)"
    : "rgba(15, 23, 42, 0.45)",
                  }}
                >
                  <strong>{record.savedAs}</strong>
                  <br />
                  {record.authority} • {record.topic}
                  <br />
                  Impact: {record.impact}
                </button>
              ))}
            </div>
          </div>

          <div className="preview-card">
            <h2>Selected Circular</h2>

            <div className="journal-preview">
              <div className="journal-row">
                <span>Official Reference</span>
                <strong>{selectedCircular.circularNumber}</strong>
              </div>

              <div className="journal-row">
                <span>Saved As</span>
                <strong>{selectedCircular.savedAs}</strong>
              </div>

              <div className="journal-row">
                <span>Authority</span>
                <strong>{selectedCircular.authority}</strong>
              </div>

              <div className="journal-row">
                <span>Topic</span>
                <strong>{selectedCircular.topic}</strong>
              </div>

              <div className="journal-row">
                <span>Impact</span>
                <strong>{selectedCircular.impact}</strong>
              </div>

              <div className="journal-row">
                <span>Effective Date</span>
                <strong>{selectedCircular.effectiveDate}</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="knowledge-grid">
          <div className="preview-card">
            <h2>Aliases & Internal Names</h2>

            <p>
              VENTIQ allows teams to save circulars using the names they
              actually remember.
            </p>

            <div className="alias-grid">
              {selectedCircular.aliases.map((alias) => (
                <span key={alias} className="alias-pill">
                  {alias}
                </span>
              ))}
            </div>
          </div>

          <div className="ai-chat-panel">
            <h2>VENTIQ AI Chat</h2>

            {questionOptions.map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => setSelectedQuestion(question)}
                className="chat-message"
                style={{
                  width: "100%",
                  textAlign: "left",
                  cursor: "pointer",
                  border:
                    selectedQuestion === question
                      ? "1px solid rgba(96, 165, 250, 0.65)"
                      : undefined,
                }}
              >
                Ask: “{question}”
              </button>
            ))}
          </div>
        </div>

        <div className="preview-card">
          <h2>VENTIQ AI Explanation</h2>

          <div className="explain-box">
            <strong>Question:</strong> {selectedQuestion}
            <br />
            <br />
            <strong>AI Answer:</strong> {buildAiAnswer(selectedQuestion)}
          </div>
        </div>

        <div className="preview-card">
          <h2>Impact Score</h2>

          <div className="impact-grid">
            <div className="impact-card">
              <h3 className="impact-score">{selectedCircular.impact}</h3>
              <p>Regulatory impact</p>
            </div>

            <div className="impact-card">
              <h3>{affectedWorkflowCount}</h3>
              <p>Affected workflows</p>
            </div>

            <div className="impact-card">
              <h3>{impactedFundCount}</h3>
              <p>Fund types impacted</p>
            </div>

            <div className="impact-card">
              <h3>{pendingActionCount}</h3>
              <p>Recommended actions</p>
            </div>
          </div>
        </div>

        <div className="preview-card">
          <h2>AI Recommended Actions</h2>

          <div className="recommended-actions">
            {selectedCircular.recommendedActions.map((action, index) => (
              <div
                key={action}
                className={
                  index === 0
                    ? "recommended-action-card primary"
                    : "recommended-action-card"
                }
              >
                <div>
                  <h3>
                    {index === 0 ? "⭐ " : "📋 "}
                    {action}
                  </h3>
                  <p>
                    VENTIQ recommends this action based on the selected circular,
                    impacted fund workflows and internal ownership.
                  </p>
                </div>
                <span className="recommended-action-link">Open →</span>
              </div>
            ))}
          </div>
        </div>

        <div className="preview-card">
          <h2>Compliance Checklist</h2>

          <div className="queue-grid">
            {selectedCircular.checklist.map((item) => (
              <div key={item} className="queue-item">
                ✓ {item}
              </div>
            ))}
          </div>
        </div>

        <div className="preview-card">
          <h2>Affected Workflows</h2>

          <div className="queue-grid">
            {selectedCircular.affectedWorkflows.map((workflow) => (
              <div key={workflow} className="queue-item">
                {workflow}
              </div>
            ))}
          </div>
        </div>

        <div className="preview-card">
          <h2>Impacted Funds</h2>

          <div className="queue-grid">
            {selectedCircular.impactedFunds.map((fund) => (
              <div key={fund} className="queue-item">
                {fund}
              </div>
            ))}
          </div>
        </div>

        <div className="preview-card">
          <h2>Related Circulars</h2>

          <div className="queue-grid">
            {selectedCircular.relatedCirculars.map((circular) => (
              <div key={circular} className="queue-item">
                {circular}
              </div>
            ))}
          </div>
        </div>

        <div className="preview-card">
          <h2>Firm Knowledge</h2>

          <div className="journal-preview">
            <div className="journal-row">
              <span>Owner</span>
              <strong>{selectedCircular.owner}</strong>
            </div>

            <div className="journal-row">
              <span>Internal Note</span>
              <strong>{selectedCircular.internalNote}</strong>
            </div>

            <div className="journal-row">
              <span>Linked SOP</span>
              <strong>{selectedCircular.linkedSop}</strong>
            </div>

            <div className="journal-row">
              <span>Next Upgrade</span>
              <strong>
                Connect live circular database, uploaded PDFs and LLM-powered
                interpretation.
              </strong>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}