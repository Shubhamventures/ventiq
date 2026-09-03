"use client";

import { type FormEvent, useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";
import "./homepage.css";

export default function Home() {
  const [isDemoOpen, setIsDemoOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const shouldLock = isDemoOpen || isMobileMenuOpen;

    if (!shouldLock) {
      document.body.style.overflow = "";
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsDemoOpen(false);
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDemoOpen, isMobileMenuOpen]);


  const [productJourneyStep, setProductJourneyStep] = useState(0);
  const productJourneySteps = [
    {
      step: "01",
      short: "Migration & Intake",
      eyebrow: "DATA FOUNDATION",
      title: "Bring the fund into one governed structure.",
      body: "Canonical structured data and controlled document intake stay scoped to the authorised fund from the start.",
      chips: ["Canonical workbook", "Legacy migration", "Fund-scoped intake"],
      href: "/demo#journey",
      linkLabel: "Explore guided journey",
      image: "/website/ventiq-product-data-intake.png",
      imageLabel: "VENTIQ Migration Portal",
      imageTitle: "Canonical Data Intake",
      alt: "VENTIQ Canonical Data Intake Command Center",
      proofLabel: "GOVERNED FUND CONTEXT",
      proofValue: "One intake path",
      proofTone: "blue",
    },
    {
      step: "02",
      short: "Activation",
      eyebrow: "GOVERNANCE",
      title: "Activate only when the fund is ready.",
      body: "Validation, checker approval and activation sit between raw intake and stakeholder use.",
      chips: ["Maker-checker", "Readiness controls", "Frozen activation state"],
      href: "/demo#journey",
      linkLabel: "Explore guided journey",
      image: "/website/ventiq-product-activation.png",
      imageLabel: "VENTIQ Migration Portal",
      imageTitle: "Governed Activation",
      alt: "VENTIQ Stakeholder Launch Center showing governed launch readiness",
      proofLabel: "LAUNCH GATE",
      proofValue: "6 / 6 ready",
      proofTone: "green",
    },
    {
      step: "03",
      short: "Documents",
      eyebrow: "INVESTOR OUTPUTS",
      title: "Turn governed data into investor-ready documents.",
      body: "Templates, investor data, PDF generation and publishing move through one controlled workflow.",
      chips: ["Template library", "Batch PDF generation", "Portal publishing"],
      href: "/demo#capabilities",
      linkLabel: "Explore capabilities",
      image: "/website/ventiq-hero-document-studio.png",
      imageLabel: "VENTIQ Document Studio",
      imageTitle: "Batch Generation",
      alt: "VENTIQ Document Studio batch generation workflow",
      proofLabel: "DOCUMENT ENGINE",
      proofValue: "Investor-wise output",
      proofTone: "gold",
    },
    {
      step: "04",
      short: "Investor Access",
      eyebrow: "INVESTOR ACCESS",
      title: "Give LPs governed access, not another attachment.",
      body: "Verified financial position, cashflows and private documents stay inside the investor's entitled context.",
      chips: ["Financial position", "Cashflows", "Private documents"],
      href: "/demo#stakeholders",
      linkLabel: "Explore stakeholder experience",
      image: "/website/ventiq-hero-investor-portal-focus.png",
      imageLabel: "VENTIQ Investor Experience",
      imageTitle: "Governed LP Access",
      alt: "VENTIQ Investor Portal with verified financial position and governed access",
      proofLabel: "VERIFIED POSITION",
      proofValue: "11 / 11 controls",
      proofTone: "green",
    },
    {
      step: "05",
      short: "Data Room",
      eyebrow: "DILIGENCE & RELATIONSHIP",
      title: "Keep shared documents and DDQ inside the same relationship.",
      body: "Private document sharing, DDQ questions and engagement history stay tied to the entitled investor identity.",
      chips: ["Restricted LP access", "DDQ & Q&A", "Engagement history"],
      href: "/demo#capabilities",
      linkLabel: "Explore capabilities",
      image: "/website/ventiq-hero-data-room-focus.png",
      imageLabel: "VENTIQ Investor Relations",
      imageTitle: "Data Room & DDQ Hub",
      alt: "VENTIQ Investor Data Room and DDQ Hub",
      proofLabel: "ENTITLEMENT-AWARE",
      proofValue: "Private LP sharing",
      proofTone: "blue",
    },
  ] as const;
  const activeJourney = productJourneySteps[productJourneyStep];

  const [intelligenceView, setIntelligenceView] = useState<"ai" | "control">("ai");

  const [demoForm, setDemoForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    role: "",
    firmType: "",
    primaryInterest: "",
    message: "",
  });
  const [isSubmittingDemo, setIsSubmittingDemo] = useState(false);
const [demoSubmitMessage, setDemoSubmitMessage] = useState("");
const [demoSubmitError, setDemoSubmitError] = useState("");

  const workspacePreviews = [
    {
      label: "Executive AI View",
      role: "Managing Partner",
      title: "Managing Partner Command Center",
      href: "/demo#stakeholders",
      description:
        "Executive command center for fund performance, deployment, portfolio risk, exits, LP narrative and the decisions a Managing Partner needs to make.",
      productLabel: "Executive dashboard",
      productSubtitle: "Fund II · Partner View · 31 Mar 2025",
      topMetrics: [
        { label: "Gross IRR", value: "24.3%" },
        { label: "Net IRR", value: "18.7%" },
        { label: "DPI", value: "1.8x" },
        { label: "Dry Powder", value: "₹118 Cr" },
        { label: "Uncalled Capital", value: "₹72 Cr" },
      ],
      primaryTitle: "Fund performance",
      primaryMetrics: [
        { label: "TVPI", value: "2.14x" },
        { label: "MOIC", value: "2.3x" },
        { label: "Deployed", value: "68%" },
        { label: "Expected Exit Value", value: "₹286 Cr" },
      ],
      summaryTitle: "Partner summary",
      summaryRows: [
        { label: "Best performing investment", value: "Alpha Fintech" },
        { label: "Portfolio risk", value: "2 companies need review" },
        { label: "LP update pack", value: "Ready for draft" },
        { label: "Exit readiness", value: "3 assets in watchlist" },
      ],
      aiLabel: "Daily AI Opinion",
      aiTitle: "LP narrative is ready",
      aiBody:
        "Fund performance remains stable. Deployment pace is slightly behind plan, but exit visibility and portfolio movement support a strong LP update narrative.",
      actions: [
        "Generate LP deck",
        "Review portfolio risk",
        "Prepare fundraising update",
      ],
      proofTitle: "VENTIQ speciality",
      proofRows: [
        "AI-prepared LP deck narrative",
        "Fund performance and portfolio risk in one view",
        "Daily partner opinion from connected fund data",
      ],
    },
    {
      label: "Finance AI Workspace",
      role: "Finance Head",
      title: "Finance Head Workspace",
      href: "/demo#stakeholders",
      description:
        "Finance operations workspace for capital calls, distributions, reconciliations, repayment notices, investor statements, approvals and accounting-impact visibility.",
      productLabel: "Finance operations",
      productSubtitle: "Fund II · Finance Queue · Today",
      topMetrics: [
        { label: "Capital Calls Ready", value: "2" },
        { label: "Repayment Notices", value: "3" },
        { label: "Distribution Review", value: "₹41 Cr" },
        { label: "Bank Exceptions", value: "1" },
        { label: "Investor Statements", value: "12" },
      ],
      primaryTitle: "Finance queue",
      primaryMetrics: [
        { label: "Capital call approval", value: "Pending" },
        { label: "Distribution working", value: "Ready" },
        { label: "Repayment notice batch", value: "Drafted" },
        { label: "Bank mapping", value: "1 exception" },
      ],
      summaryTitle: "Operating summary",
      summaryRows: [
        { label: "Capital call", value: "Allocation draft prepared" },
        { label: "Distribution", value: "Waterfall ready for review" },
        { label: "Repayment notice", value: "3 emails can be prepared" },
        { label: "Investor reporting", value: "Statement pack pending approval" },
      ],
      aiLabel: "Daily AI Opinion",
      aiTitle: "Finance queue is ready",
      aiBody:
        "Two repayment notices and one distribution working are ready for review. One reconciliation exception needs mapping before the investor statement pack is released.",
      actions: [
        "Generate capital call",
        "Prepare repayment notices",
        "Review bank exception",
      ],
      proofTitle: "VENTIQ speciality",
      proofRows: [
        "Capital calls, distributions and repayment notices in one queue",
        "AI-prepared communication drafts",
        "Approval and audit trail linked to every output",
      ],
    },
    {
      label: "Compliance AI View",
      role: "Compliance Officer",
      title: "Compliance Officer View",
      href: "/demo#stakeholders",
      description:
        "Compliance command center for regulatory calendars, filing readiness, audit evidence, Form 64C, Form 64D, QCR, TCR and GIFT City obligations.",
      productLabel: "Compliance control room",
      productSubtitle: "AIF · GIFT City · Regulatory Tracker",
      topMetrics: [
        { label: "QCR Due", value: "4 days" },
        { label: "Form 64C", value: "Draft" },
        { label: "Form 64D", value: "Data check" },
        { label: "Evidence Gaps", value: "2" },
        { label: "AML Review", value: "Open" },
      ],
      primaryTitle: "Filing readiness",
      primaryMetrics: [
        { label: "QCR", value: "82%" },
        { label: "TCR", value: "Ready" },
        { label: "FATCA / CRS", value: "Review" },
        { label: "Audit evidence", value: "2 gaps" },
      ],
      summaryTitle: "Regulatory summary",
      summaryRows: [
        { label: "Upcoming filing", value: "QCR due in 4 days" },
        { label: "Investor tax data", value: "64D validation pending" },
        { label: "Evidence trail", value: "2 missing documents" },
        { label: "GIFT City tracker", value: "IFSCA review open" },
      ],
      aiLabel: "Compliance AI Opinion",
      aiTitle: "Compliance urgency detected",
      aiBody:
        "QCR is due in 4 days. Two audit evidence items are missing from the document trail and should be collected before final compliance review.",
      actions: [
        "Open filing tracker",
        "Prepare evidence pack",
        "Review compliance calendar",
      ],
      proofTitle: "VENTIQ speciality",
      proofRows: [
        "AIF, GIFT City, QCR, TCR, Form 64C and Form 64D tracking",
        "Evidence status connected to compliance tasks",
        "Daily compliance urgency summary",
      ],
    },
    {
      label: "Portfolio AI Workspace",
      role: "Investment Team",
      title: "Investment Team Workspace",
      href: "/demo#stakeholders",
      description:
        "Portfolio intelligence workspace for company movement, repayment risk, valuation changes, operating signals, follow-on decisions and exit readiness.",
      productLabel: "Portfolio intelligence",
      productSubtitle: "Portfolio Companies · Movement Tracker",
      topMetrics: [
        { label: "Portfolio Updates", value: "5" },
        { label: "Risk Flags", value: "2" },
        { label: "Valuation Movement", value: "1" },
        { label: "Exit Notes", value: "3" },
        { label: "Follow-on Watch", value: "2" },
      ],
      primaryTitle: "Portfolio movement",
      primaryMetrics: [
        { label: "Revenue movement", value: "Flagged" },
        { label: "Repayment risk", value: "1 company" },
        { label: "Exit readiness", value: "3 assets" },
        { label: "Follow-on need", value: "2 reviews" },
      ],
      summaryTitle: "Investment summary",
      summaryRows: [
        { label: "Alpha Fintech", value: "Revenue movement positive" },
        { label: "Nova Health", value: "Repayment risk increased" },
        { label: "Orbit SaaS", value: "Exit readiness improved" },
        { label: "Valuation input", value: "One update pending" },
      ],
      aiLabel: "Portfolio AI Opinion",
      aiTitle: "Portfolio signal flagged",
      aiBody:
        "One portfolio company shows positive revenue movement, while one debt exposure shows repayment-risk signal. Investment team review is recommended.",
      actions: [
        "Review company update",
        "Flag valuation movement",
        "Prepare exit-readiness note",
      ],
      proofTitle: "VENTIQ speciality",
      proofRows: [
        "Portfolio updates converted into investment-team signals",
        "Debt repayment risk and valuation movement in one view",
        "Exit readiness and follow-on watchlist",
      ],
    },
    {
      label: "IR AI Workspace",
      role: "Investor Relations",
      title: "IR & Fundraising Workspace",
      href: "/demo#stakeholders",
      description:
        "Investor relations workspace for LP follow-ups, DDQs, reporting packs, fundraising decks, data-room requests and relationship intelligence.",
      productLabel: "Investor relations",
      productSubtitle: "LP Pipeline · DDQ · Reporting Packs",
      topMetrics: [
        { label: "LP Follow-ups", value: "3" },
        { label: "DDQ Draft", value: "1" },
        { label: "Deck Updates", value: "2" },
        { label: "Warm Investors", value: "4" },
        { label: "Reporting Packs", value: "6" },
      ],
      primaryTitle: "LP communication",
      primaryMetrics: [
        { label: "DDQ response", value: "Auto-draft" },
        { label: "Fundraising deck", value: "Update ready" },
        { label: "LP follow-ups", value: "3 due" },
        { label: "Data room request", value: "2 open" },
      ],
      summaryTitle: "Fundraising summary",
      summaryRows: [
        { label: "Sovereign LP", value: "Follow-up due tomorrow" },
        { label: "Family Office", value: "DDQ draft available" },
        { label: "Pension Fund", value: "Deck update requested" },
        { label: "Quarterly report", value: "Ready for LP pack" },
      ],
      aiLabel: "IR AI Opinion",
      aiTitle: "LP communication pending",
      aiBody:
        "Three LP follow-ups are pending. One DDQ response can be auto-drafted using fund performance, compliance and portfolio data.",
      actions: [
        "Draft LP response",
        "Generate fundraising deck",
        "Prepare investor update",
      ],
      proofTitle: "VENTIQ speciality",
      proofRows: [
        "Investor updates, DDQs and fundraising decks from connected data",
        "LP follow-up and reporting pack visibility",
        "Fundraising narrative connected to performance and portfolio signals",
      ],
    },
    {
      label: "Investor AI Portal",
      role: "Investors / LPs",
      title: "Investor Portal",
      href: "/demo#stakeholders",
      description:
        "Private investor experience for commitments, capital calls, distributions, verified financial position, statements, documents, cashflows and entitled data-room access.",
      productLabel: "Investor self-service portal",
      productSubtitle: "Fund II · Class A · Investor View",
      topMetrics: [
        { label: "Commitment", value: "₹10.0 Cr" },
        { label: "Capital Called", value: "₹6.8 Cr" },
        { label: "Capital Redeemed", value: "₹32.5 L" },
        { label: "Latest NAV", value: "₹7.5 Cr" },
        { label: "Outstanding Units", value: "6,42,500" },
      ],
      primaryTitle: "Fund performance · as on 31 March 2025",
      primaryMetrics: [
        { label: "Gross XIRR", value: "22.4%" },
        { label: "Net XIRR", value: "18.7%" },
        { label: "TVPI", value: "1.84x" },
        { label: "DPI", value: "0.42x" },
      ],
      summaryTitle: "Investment summary",
      summaryRows: [
        { label: "Onboarded on", value: "22 Mar 2022" },
        { label: "Last login", value: "10 May 2025" },
        { label: "Total distributed to you", value: "₹42.0 L" },
        { label: "Units allotted lifetime", value: "6,75,000" },
      ],
      aiLabel: "AI LP Summary",
      aiTitle: "Investor update ready",
      aiBody:
        "This quarter includes one capital call notice, one performance update and two investor reporting documents available for review.",
      actions: [
        "View capital call notice",
        "Download statements",
        "Read fund update",
      ],
      proofTitle: "VENTIQ speciality",
      proofRows: [
        "Investor self-service for capital calls, statements and reports",
        "LP-ready AI summary of fund updates",
        "Reduced email follow-ups for investor documents",
      ],
    },
  ];

  const [selectedWorkspaceIndex, setSelectedWorkspaceIndex] = useState(0);
  const selectedWorkspace = workspacePreviews[selectedWorkspaceIndex];

  async function handleDemoSubmit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();

  setDemoSubmitMessage("");
  setDemoSubmitError("");

  if (!isSupabaseConfigured || !supabase) {
    setDemoSubmitError(
      "Unable to save the walkthrough request right now. Please try again in some time."
    );
    return;
  }

  setIsSubmittingDemo(true);

  const { error } = await supabase.from("walkthrough_requests").insert({
    name: demoForm.name.trim(),
    email: demoForm.email.trim(),
    phone: demoForm.phone.trim(),
    company: demoForm.company.trim(),
    role: demoForm.role.trim(),
    firm_type: demoForm.firmType,
    primary_interest: demoForm.primaryInterest,
    message: demoForm.message.trim(),
    source: "useventiq.com",
    status: "New",
  });

  setIsSubmittingDemo(false);

  if (error) {
    setDemoSubmitError(error.message);
    return;
  }

  setDemoSubmitMessage(
    "Thanks. Your walkthrough request has been received. I will reach out shortly."
  );

  setDemoForm({
    name: "",
    email: "",
    phone: "",
    company: "",
    role: "",
    firmType: "",
    primaryInterest: "",
    message: "",
  });
}

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://useventiq.com/#organization",
        name: "VENTIQ",
        url: "https://useventiq.com",
        logo: "https://useventiq.com/icon",
        description:
          "VENTIQ gives private capital firms AI stakeholder dashboards powered by one governed operating layer for fund data, documents, approvals, workflows and investor access.",
      },
      {
        "@type": "WebSite",
        "@id": "https://useventiq.com/#website",
        url: "https://useventiq.com",
        name: "VENTIQ",
        publisher: {
          "@id": "https://useventiq.com/#organization",
        },
      },
      {
        "@type": "SoftwareApplication",
        "@id": "https://useventiq.com/#software",
        name: "VENTIQ",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: "https://useventiq.com",
        description:
          "AI stakeholder dashboards for private capital, with six role-native experiences powered by one governed fund data and workflow layer.",
      },
    ],
  };

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData),
        }}
      />


      <div className="container">
        <header className="w1f2-site-header">
          <a className="w1f2-site-brand" href="/" aria-label="VENTIQ home">
            VENTIQ
          </a>

          <nav className="w1f2-site-nav w1g6-site-nav" aria-label="Primary navigation">
            <a className="w1g6-simple-link" href="#why-ventiq">
              Why VENTIQ
            </a>

            <div className="w1g6-nav-cluster w1g6-has-menu">
              <a
                className="w1g6-nav-trigger"
                href="#modules"
                aria-haspopup="true"
              >
                Stakeholders
                <span className="w1g6-chevron" aria-hidden="true">⌄</span>
              </a>

              <div
                className="w1g6-mega w1g6-stakeholder-menu"
                role="group"
                aria-label="Stakeholder experiences"
              >
                <div className="w1g6-mega-heading">
                  <span>ROLE-NATIVE EXPERIENCES</span>
                  <strong>One governed fund. Six ways to work.</strong>
                </div>

                <div className="w1g6-role-grid">
                  {workspacePreviews.map((workspace, index) => (
                    <a
                      key={workspace.role}
                      href="#modules"
                      onClick={() => setSelectedWorkspaceIndex(index)}
                    >
                      <span className="w1g6-role-index">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span>
                        <strong>{workspace.role}</strong>
                        <small>
                          {index === 0 && "Performance, deployment, risk and LP narrative"}
                          {index === 1 && "Calls, distributions, reconciliations and reporting"}
                          {index === 2 && "Filing readiness, evidence and regulatory controls"}
                          {index === 3 && "Portfolio monitoring, deal context and decisions"}
                          {index === 4 && "LP reporting, fundraising and relationship workflows"}
                          {index === 5 && "Positions, cashflows, documents and governed access"}
                        </small>
                      </span>
                    </a>
                  ))}
                </div>

                <a className="w1g6-mega-footer-link" href="#modules">
                  See the six stakeholder experiences
                  <span aria-hidden="true">→</span>
                </a>
              </div>
            </div>

            <div className="w1g6-nav-cluster w1g6-has-menu">
              <a
                className="w1g6-nav-trigger"
                href="#platform-breadth"
                aria-haspopup="true"
              >
                Platform
                <span className="w1g6-chevron" aria-hidden="true">⌄</span>
              </a>

              <div
                className="w1g6-mega w1g6-platform-menu"
                role="group"
                aria-label="VENTIQ platform"
              >
                <div className="w1g6-platform-intro">
                  <span>THE VENTIQ OPERATING LAYER</span>
                  <strong>From governed data to stakeholder delivery.</strong>
                  <p>
                    Explore the public product journey. Real operating workspaces
                    remain behind authenticated VENTIQ access.
                  </p>
                </div>

                <div className="w1g6-platform-links">
                  <a
                    className="w1g6-platform-primary"
                    href="#guided-demo"
                    onClick={() => setProductJourneyStep(0)}
                  >
                    <strong>Migration & Activation</strong>
                    <small>Legacy data intake, readiness, maker-checker and governed launch</small>
                  </a>
                  <a
                    href="#guided-demo"
                    onClick={() => setProductJourneyStep(2)}
                  >
                    <strong>Document Studio</strong>
                    <small>Governed investor outputs and publishing</small>
                  </a>
                  <a
                    href="#guided-demo"
                    onClick={() => setProductJourneyStep(3)}
                  >
                    <strong>Investor Experience</strong>
                    <small>Financial position, cashflows and private documents</small>
                  </a>
                  <a
                    href="#guided-demo"
                    onClick={() => setProductJourneyStep(4)}
                  >
                    <strong>Data Room & DDQ</strong>
                    <small>Entitled diligence, Q&A and engagement history</small>
                  </a>
                  <a href="#platform-breadth">
                    <strong>Portfolio & Operating Intelligence</strong>
                    <small>Portfolio context, fund monitoring and decision-ready views</small>
                  </a>
                  <a href="#security">
                    <strong>Governance & Controls</strong>
                    <small>Permissions, approvals, auditability and isolation</small>
                  </a>
                </div>

                <div className="w1g6-platform-footer">
                  <a href="#platform-breadth">
                    Platform overview <span aria-hidden="true">→</span>
                  </a>
                  <a href="/demo">
                    Guided Demo <span aria-hidden="true">↗</span>
                  </a>
                </div>
              </div>
            </div>

            <a className="w1g6-simple-link" href="#guided-demo">
              Product Journey
            </a>
            <a className="w1g6-simple-link" href="/demo">
              Guided Demo
            </a>
            <a className="w1g6-simple-link" href="#about">
              About
            </a>
          </nav>

          <div className="w1g6-header-actions">
            <a className="w1g6-sign-in" href="/auth/login">
              Sign in
            </a>

            <a className="w1f2-site-cta" href="/start">
              Get started
            </a>
          </div>

          <button
            className="w1f2-menu-toggle"
            type="button"
            aria-label={isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={isMobileMenuOpen}
            aria-controls="ventiq-mobile-menu"
            onClick={() => setIsMobileMenuOpen((open) => !open)}
          >
            <span />
            <span />
            <span />
          </button>
        </header>

        {isMobileMenuOpen && (
          <>
            <button
              type="button"
              className="w1f2-mobile-backdrop"
              aria-label="Close navigation menu"
              onClick={() => setIsMobileMenuOpen(false)}
            />

            <nav
              className="w1f2-mobile-menu"
              id="ventiq-mobile-menu"
              aria-label="Mobile navigation"
            >
              <a href="#why-ventiq" onClick={() => setIsMobileMenuOpen(false)}>
                Why VENTIQ
              </a>
              <a href="#modules" onClick={() => setIsMobileMenuOpen(false)}>
                Stakeholders
              </a>
              <a href="#platform-breadth" onClick={() => setIsMobileMenuOpen(false)}>
                Platform
              </a>
              <a href="#guided-demo" onClick={() => setIsMobileMenuOpen(false)}>
                Product Journey
              </a>
              <a href="/demo" onClick={() => setIsMobileMenuOpen(false)}>
                Guided Demo
              </a>
              <a href="#about" onClick={() => setIsMobileMenuOpen(false)}>
                About
              </a>
              <a href="/auth/login" onClick={() => setIsMobileMenuOpen(false)}>
                Sign in
              </a>
              <a href="/start" onClick={() => setIsMobileMenuOpen(false)}>
                Get started
              </a>

              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setIsDemoOpen(true);
                }}
              >
                Request a private walkthrough
                <span>↗</span>
              </button>
            </nav>
          </>
        )}

        <section className="w1a-hero w1a-hero-centered w1g42-hero" aria-labelledby="ventiq-hero-title">
          <div className="w1a-hero-copy w1a-hero-copy-centered w1g42-hero-copy">
            <div className="w1a-eyebrow">
              <span className="w1a-eyebrow-dot" aria-hidden="true" />
              One fund · Six stakeholders · One source of truth
            </div>

            <h1 id="ventiq-hero-title" className="w1a-centered-title w1g42-title">
              <span>AI Stakeholder Dashboards</span>
              <span>
                for <span className="w1a-gradient-text">Private Capital</span>
              </span>
            </h1>

            <p className="w1a-hero-lede w1a-centered-lede w1g42-lede">
              One governed fund layer powering role-native data, workflows, approvals
              and AI context across the private-capital firm.
            </p>

            <div className="w1a-hero-actions w1a-centered-actions w1g42-actions">
              <a className="w1a-primary-cta" href="/start">
                Get started with VENTIQ
                <span aria-hidden="true">→</span>
              </a>

              <a className="w1a-secondary-cta" href="/demo">
                Start guided demo
                <span aria-hidden="true">→</span>
              </a>
            </div>

            <button
              className="w1a-private-walkthrough"
              type="button"
              onClick={() => setIsDemoOpen(true)}
            >
              Request a private walkthrough
              <span aria-hidden="true">↗</span>
            </button>

            <a className="w1a-private-walkthrough w1a-hero-scroll-cue w1g42-scroll-cue" href="#modules">
              Explore how VENTIQ works
              <span aria-hidden="true">↓</span>
            </a>

            <div className="w1g42-proof-rail" aria-label="VENTIQ platform principles">
              <div className="w1g42-proof-item">
                <span className="w1g42-proof-mark" aria-hidden="true" />
                <div>
                  <strong>GOVERNED FUND DATA</strong>
                  <span>One fund record across workflows and experiences</span>
                </div>
              </div>

              <div className="w1g42-proof-item">
                <span className="w1g42-proof-mark" aria-hidden="true" />
                <div>
                  <strong>6 ROLE-NATIVE VIEWS</strong>
                  <span>Each stakeholder sees the context they need</span>
                </div>
              </div>

              <div className="w1g42-proof-item">
                <span className="w1g42-proof-mark" aria-hidden="true" />
                <div>
                  <strong>BUILT-IN GOVERNANCE</strong>
                  <span>Maker-checker, permissions and audit trails</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="w1b-section" id="modules">
          <div className="w1b-kicker">
            <span>THE SIGNATURE VENTIQ EXPERIENCE</span>
            <div />
            <span>SAME FUND · ROLE-NATIVE ACCESS</span>
          </div>

          <div className="w1b-heading-row">
            <div>
              <h2>One fund. Six ways to see it.</h2>
            </div>

            <p>
              The governed fund layer stays the same. What changes is the
              information, intelligence and actions each stakeholder needs.
            </p>
          </div>

          <div className="w1b-role-tabs" role="tablist" aria-label="Choose stakeholder experience">
            {workspacePreviews.map((workspace, index) => (
              <button
                key={workspace.role}
                type="button"
                className={`w1b-role-tab ${
                  selectedWorkspaceIndex === index ? "active" : ""
                }`}
                onClick={() => setSelectedWorkspaceIndex(index)}
                role="tab"
                aria-selected={selectedWorkspaceIndex === index}
                aria-controls="ventiq-stakeholder-panel"
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{workspace.role}</strong>
              </button>
            ))}
          </div>

          <div className="w1b-showcase" id="ventiq-stakeholder-panel" role="tabpanel">
            <aside className="w1b-role-story">
              <div className="w1b-role-index">
                {String(selectedWorkspaceIndex + 1).padStart(2, "0")} / 06
              </div>

              <div className="w1b-role-label">{selectedWorkspace.label}</div>

              <h3>{selectedWorkspace.title}</h3>

              <p className="w1b-role-description">
                {selectedWorkspace.description}
              </p>

              <div className="w1b-proof-list">
                {selectedWorkspace.proofRows.map((point) => (
                  <div key={point}>
                    <span>✓</span>
                    <p>{point}</p>
                  </div>
                ))}
              </div>

              <a className="w1b-open-workspace" href="#contact">
                See {selectedWorkspace.role} in a walkthrough
                <span>↗</span>
              </a>

              <div className="w1b-layer-note">
                <span>VENTIQ OPERATING LAYER</span>
                <p>
                  Fund data · documents · approvals · workflows · AI context
                </p>
              </div>
            </aside>

            <div className="w1b-product-frame">
              <div className="w1b-frame-topbar">
                <div className="w1b-frame-brand">
                  <i />
                  <span>VENTIQ</span>
                  <strong>{selectedWorkspace.productLabel}</strong>
                </div>

                <div className="w1b-frame-context">
                  {selectedWorkspace.productSubtitle}
                </div>
              </div>

              <div className="w1b-frame-body">
                <div className="w1b-dashboard-heading">
                  <div>
                    <span>{selectedWorkspace.role} experience</span>
                    <h3>{selectedWorkspace.primaryTitle}</h3>
                  </div>

                  <div className="w1b-live-pill">
                    <i />
                    Role-native view
                  </div>
                </div>

                <div className="w1b-metrics">
                  {selectedWorkspace.topMetrics.map((metric) => (
                    <div key={metric.label} className="w1b-metric">
                      <span>{metric.label}</span>
                      <strong>{metric.value}</strong>
                    </div>
                  ))}
                </div>

                <div className="w1b-dashboard-grid">
                  <div className="w1b-panel w1b-panel-performance">
                    <div className="w1b-panel-title">
                      <span>CONNECTED FUND VIEW</span>
                      <strong>{selectedWorkspace.primaryTitle}</strong>
                    </div>

                    <div className="w1b-performance-grid">
                      {selectedWorkspace.primaryMetrics.map((metric) => (
                        <div key={metric.label}>
                          <span>{metric.label}</span>
                          <strong>{metric.value}</strong>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="w1b-panel w1b-ai-panel">
                    <div className="w1b-panel-title">
                      <span>{selectedWorkspace.aiLabel}</span>
                      <strong>{selectedWorkspace.aiTitle}</strong>
                    </div>

                    <p>{selectedWorkspace.aiBody}</p>

                    <div className="w1b-ai-signal">
                      <i />
                      Connected-data opinion
                    </div>
                  </div>

                  <div className="w1b-panel">
                    <div className="w1b-panel-title">
                      <span>ROLE SUMMARY</span>
                      <strong>{selectedWorkspace.summaryTitle}</strong>
                    </div>

                    <div className="w1b-summary-rows">
                      {selectedWorkspace.summaryRows.map((row) => (
                        <div key={row.label}>
                          <span>{row.label}</span>
                          <strong>{row.value}</strong>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="w1b-panel">
                    <div className="w1b-panel-title">
                      <span>NEXT BEST ACTION</span>
                      <strong>Recommended actions</strong>
                    </div>

                    <div className="w1b-action-list">
                      {selectedWorkspace.actions.map((action, index) => (
                        <a key={action} href="#contact">
                          <span>{String(index + 1).padStart(2, "0")}</span>
                          <strong>{action}</strong>
                          <i>→</i>
                        </a>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="w1b-frame-footer">
                  <span>
                    Same governed fund underneath. Different intelligence for
                    {` ${selectedWorkspace.role}.`}
                  </span>

                  <div>
                    {workspacePreviews.map((workspace, index) => (
                      <button
                        key={workspace.role}
                        type="button"
                        className={
                          selectedWorkspaceIndex === index ? "active" : ""
                        }
                        aria-label={`Show ${workspace.role} experience`}
                        onClick={() => setSelectedWorkspaceIndex(index)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

        </section>

        <section className="w1g8-section" id="why-ventiq">
          <div className="w1g8-kicker">
            <span>HOW VENTIQ WORKS</span>
            <div />
            <span>FRAGMENTED IN · GOVERNED OUT</span>
          </div>

          <div className="w1g8-heading-row">
            <h2>
              One operating layer between fragmented inputs and stakeholder delivery.
            </h2>

            <p>
              VENTIQ brings legacy fund information into a governed operating
              context, applies readiness and approval controls, then serves the
              right data, workflows and intelligence to each authorised user.
            </p>
          </div>

          <div className="w1g8-flow" aria-label="VENTIQ operating layer">
            <div className="w1g8-stage">
              <div className="w1g8-stage-top">
                <span>01</span>
                <small>FRAGMENTED INPUTS</small>
              </div>
              <h3>Bring existing fund information together.</h3>
              <div className="w1g8-stage-items">
                <span>Legacy workbooks & MIS</span>
                <span>Fund administrator outputs</span>
                <span>Documents & shared folders</span>
                <span>Portfolio and compliance updates</span>
              </div>
            </div>

            <div className="w1g8-flow-arrow" aria-hidden="true">→</div>

            <div className="w1g8-stage w1g8-stage-primary">
              <div className="w1g8-stage-top">
                <span>02</span>
                <small>MIGRATION & ACTIVATION</small>
              </div>
              <h3>Turn raw history into an approved fund context.</h3>
              <div className="w1g8-stage-items">
                <span>Ingest & map</span>
                <span>Validate readiness</span>
                <span>Maker-checker approval</span>
                <span>Activate governed modules</span>
              </div>
            </div>

            <div className="w1g8-flow-arrow" aria-hidden="true">→</div>

            <div className="w1g8-stage w1g8-stage-core">
              <div className="w1g8-stage-top">
                <span>03</span>
                <small>GOVERNED FUND CORE</small>
              </div>
              <h3>Keep data, workflows and evidence attached.</h3>
              <div className="w1g8-stage-items w1g8-core-items">
                <span>Fund & investor data</span>
                <span>Portfolio & documents</span>
                <span>Approvals & workflows</span>
                <span>Audit evidence & AI context</span>
              </div>
            </div>

            <div className="w1g8-flow-arrow" aria-hidden="true">→</div>

            <div className="w1g8-stage">
              <div className="w1g8-stage-top">
                <span>04</span>
                <small>ROLE-NATIVE DELIVERY</small>
              </div>
              <h3>Serve the right working view to the right user.</h3>
              <div className="w1g8-stage-items">
                <span>Stakeholder dashboards</span>
                <span>Investor access & reporting</span>
                <span>Data Room & DDQ</span>
                <span>Permission-aware AI actions</span>
              </div>
            </div>
          </div>

          <div className="w1g8-principles">
            <div>
              <span>01</span>
              <strong>One governed fund data layer</strong>
            </div>
            <div>
              <span>02</span>
              <strong>Permission-aware access</strong>
            </div>
            <div>
              <span>03</span>
              <strong>Governance travels with the workflow</strong>
            </div>
            <div>
              <span>04</span>
              <strong>AI stays inside the same context</strong>
            </div>
          </div>
        </section>

        <section className="w1f2-product-section" id="guided-demo">
          <div className="w1f2-section-kicker">
            <span>REAL PRODUCT · WORKING FLOWS</span>
            <div />
            <span>CLICK THROUGH THE JOURNEY</span>
          </div>

          <div className="w1f2-product-heading">
            <h2>From migration & intake to investor access. Inside VENTIQ.</h2>
            <p>
              One connected journey, shown one stage at a time. Follow governed
              fund data from migration and intake through approval, investor outputs and
              entitled access.
            </p>
          </div>

          <div className="w1f2-journey-tabs" role="tablist" aria-label="VENTIQ product journey">
            {productJourneySteps.map((item, index) => (
              <button
                key={item.step}
                type="button"
                className={productJourneyStep === index ? "active" : ""}
                onClick={() => setProductJourneyStep(index)}
                role="tab"
                aria-selected={productJourneyStep === index}
              >
                <span>{item.step}</span>
                <strong>{item.short}</strong>
              </button>
            ))}
          </div>

          <div className="w1f2-product-stage">
            <div className="w1f2-product-copy">
              <span>{activeJourney.step} / {activeJourney.eyebrow}</span>
              <h3>{activeJourney.title}</h3>
              <p>{activeJourney.body}</p>

              <div className="w1f2-product-chips">
                {activeJourney.chips.map((chip) => (
                  <span key={chip}>{chip}</span>
                ))}
              </div>

              <a href={activeJourney.href}>
                {activeJourney.linkLabel}
                <span>↗</span>
              </a>
            </div>

            <div className="w1f2-product-screen-wrap">
              <div className="w1f2-product-screen-label">
                <span>{activeJourney.imageLabel}</span>
                <strong>{activeJourney.imageTitle}</strong>
              </div>

              <figure className="w1f2-product-screen">
                <img src={activeJourney.image} alt={activeJourney.alt} />
              </figure>

              <div className={`w1f2-product-proof ${activeJourney.proofTone}`}>
                <span>{activeJourney.proofLabel}</span>
                <strong>{activeJourney.proofValue}</strong>
              </div>
            </div>
          </div>

          <div className="w1f2-product-footer">
            <span>ONE CONNECTED PRODUCT JOURNEY</span>
            <strong>Data enters once. Governance stays attached. Stakeholder access stays in context.</strong>
            <a href="/demo">Start guided demo <span>↗</span></a>
          </div>
        </section>

        <section className="w1f2-platform-section" id="platform-breadth">
          <div className="w1f2-platform-heading">
            <div>
              <span>PLATFORM BREADTH</span>
              <h2>More of the fund runs on the same layer.</h2>
            </div>

            <p>
              Working flows, connected foundations and expansion engines —
              separated clearly so product readiness is never ambiguous.
            </p>
          </div>

          <div className="w1f2-platform-grid">
            <div className="w1f2-platform-group working">
              <div className="w1f2-platform-status">
                <i />
                <div>
                  <span>WORKING FLOWS</span>
                  <strong>Available product surfaces</strong>
                </div>
              </div>

              <div className="w1f2-platform-items">
                <a href="/demo#capabilities"><strong>Capital Calls</strong><span>Allocations · approvals · notices</span><i>↗</i></a>
                <a href="/demo#capabilities"><strong>Distribution Waterfall</strong><span>Waterfall · payouts · communication</span><i>↗</i></a>
                <a href="/demo#capabilities"><strong>Debt LMS</strong><span>Debt strategy-specific · repayments · notices · borrower tracking</span><i>↗</i></a>
                <a href="/demo#capabilities"><strong>Repayment Notices</strong><span>Generation · email queue · audit trail</span><i>↗</i></a>
              </div>
            </div>

            <div className="w1f2-platform-group foundation">
              <div className="w1f2-platform-status">
                <i />
                <div>
                  <span>PLATFORM FOUNDATIONS</span>
                  <strong>Connected operating capabilities</strong>
                </div>
              </div>

              <div className="w1f2-platform-items">
                <a href="/demo#capabilities"><strong>Portfolio Intelligence</strong><span>Movement · valuation · repayment risk</span><i>↗</i></a>
                <a href="/demo#stakeholders"><strong>Compliance & Regulatory</strong><span>Filings · evidence · readiness</span><i>↗</i></a>
                <a href="/demo#capabilities"><strong>Activity Engine</strong><span>Actions · approvals · operating history</span><i>↗</i></a>
                <a href="/demo#capabilities"><strong>Document Studio</strong><span>Templates · generation · approval · publishing</span><i>↗</i></a>
              </div>
            </div>

            <div className="w1f2-platform-group roadmap">
              <div className="w1f2-platform-status">
                <i />
                <div>
                  <span>EXPANSION ENGINES</span>
                  <strong>Planned extensions of the operating layer</strong>
                </div>
              </div>

              <div className="w1f2-platform-items">
                <div><strong>Knowledge Hub</strong><span>Regulations · policies · institutional knowledge</span><em>Expansion</em></div>
                <div><strong>Bank Reconciliation</strong><span>Matching · exceptions · accounting prep</span><em>Expansion</em></div>
                <div><strong>Finance Mission Control</strong><span>Priorities · approvals · operating risk</span><em>Expansion</em></div>
                <div><strong>Fee & Carry Engine</strong><span>Fees · carry accruals · fund economics</span><em>Planned</em></div>
              </div>
            </div>
          </div>
        </section>

        <section className="w1f2-intelligence-section" id="all-workspaces">
          <div className="w1f2-section-kicker">
            <span>INTELLIGENCE + CONTROL</span>
            <div />
            <span>ONE GOVERNED CONTEXT</span>
          </div>

          <div className="w1f2-intelligence-heading">
            <h2>AI where it helps. Control where it matters.</h2>

            <div className="w1f2-intelligence-tabs" role="tablist" aria-label="VENTIQ intelligence and control">
              <button
                type="button"
                className={intelligenceView === "ai" ? "active" : ""}
                onClick={() => setIntelligenceView("ai")}
                aria-selected={intelligenceView === "ai"}
                role="tab"
              >
                AI Intelligence
              </button>
              <button
                type="button"
                className={intelligenceView === "control" ? "active" : ""}
                onClick={() => setIntelligenceView("control")}
                aria-selected={intelligenceView === "control"}
                role="tab"
              >
                Governance & Security
              </button>
            </div>
          </div>

          {intelligenceView === "ai" ? (
            <div className="w1f2-intelligence-stage">
              <div className="w1f2-intelligence-copy">
                <span>CONTEXT BEFORE GENERATION</span>
                <h3>AI that already knows which fund, which role and what changed.</h3>
                <p>
                  Intelligence stays inside the governed fund context —
                  interpreting connected data, surfacing exceptions and
                  preparing the next relevant action.
                </p>

                <div className="w1f2-process">
                  <span>Observe</span><i>→</i><span>Interpret</span><i>→</i><span>Recommend</span><i>→</i><span>Prepare</span>
                </div>
              </div>

              <div className="w1f2-ai-card">
                <div className="w1f2-ai-top"><i /><strong>VENTIQ Intelligence</strong><span>Managing Partner</span></div>
                <div className="w1f2-ai-opinion">
                  <span>DAILY AI OPINION</span>
                  <h3>LP narrative is ready.</h3>
                  <p>Fund performance remains stable. Deployment pace is slightly behind plan, but exit visibility and portfolio movement support a strong LP update narrative.</p>
                </div>
                <div className="w1f2-ai-actions">
                  <span>NEXT BEST ACTIONS</span>
                  <a href="/demo#stakeholders"><strong>Generate LP deck narrative</strong><i>→</i></a>
                  <a href="/demo#capabilities"><strong>Review portfolio risk</strong><i>→</i></a>
                  <a href="/demo#stakeholders"><strong>Prepare fundraising update</strong><i>→</i></a>
                </div>
              </div>
            </div>
          ) : (
            <div className="w1f2-control-stage" id="security">
              <div className="w1f2-control-copy">
                <span>GOVERNANCE BY DESIGN</span>
                <h3>Control is part of the product — not a footer promise.</h3>
                <p>
                  Role access, maker-checker, private document delivery and audit
                  evidence stay attached to the workflows that move fund
                  information from internal teams to investors.
                </p>
                <a href="/security">Explore VENTIQ security <span>↗</span></a>
              </div>

              <div className="w1f2-control-grid">
                <div><span>01</span><strong>Permission-aware access</strong><p>Only entitled funds, investors and actions are released to each user.</p></div>
                <div><span>02</span><strong>Maker-checker activation</strong><p>Governed fund states are approved before dashboards and investor workflows rely on them.</p></div>
                <div><span>03</span><strong>Private document release</strong><p>Investor documents use permission checks and short-lived access rather than public links.</p></div>
                <div><span>04</span><strong>Evidence stays attached</strong><p>Approvals, access and engagement remain traceable to the relevant fund context.</p></div>
              </div>
            </div>
          )}
        </section>

        <section className="w1e-about-section w1g-about-section" id="about">
          <div className="w1e-about-copy">
            <span>WHY VENTIQ EXISTS</span>
            <h2>Built by an operator who kept seeing the same problem.</h2>

            <p>
              VENTIQ comes from working across alternative-investment fund
              operations, investor reporting and the controls that sit between
              internal teams, service providers and investors. The product is
              built from those workflows outward — a governed fund layer
              first, then role-native software on top.
            </p>

            <div className="w1e-about-chips">
              <span>VC</span>
              <span>Private Equity</span>
              <span>Debt Funds</span>
              <span>AIFs</span>
              <span>GIFT City</span>
            </div>
          </div>

          <div className="w1e-founder-card w1g-founder-card">
            <div className="w1e-founder-top">
              <span>FOUNDER</span>
              <strong>Operator-led product</strong>
            </div>

            <h3>Shubham Jain, CA</h3>

            <p>
              Chartered Accountant with experience across alternative
              investment funds, fund operations, investor reporting and
              private-capital workflows.
            </p>

            <div className="w1e-founder-proof">
              <div>
                <span>OPERATIONS</span>
                <strong>Fund operations</strong>
              </div>
              <div>
                <span>REPORTING</span>
                <strong>Investor reporting</strong>
              </div>
              <div>
                <span>FOCUS</span>
                <strong>Private capital systems</strong>
              </div>
            </div>

            <button type="button" onClick={() => setIsDemoOpen(true)}>
              Request walkthrough
              <span>↗</span>
            </button>
          </div>
        </section>

        <section className="w1e-final-section w1g-final-section" id="contact">
          <div className="w1e-final-kicker">
            <span>SEE VENTIQ IN CONTEXT</span>
            <div />
            <span>PRIVATE CAPITAL · ROLE-NATIVE · GOVERNED</span>
          </div>

          <div className="w1e-final-content">
            <h2>
              See what VENTIQ
              <span>would look like around your fund.</span>
            </h2>

            <p>
              Walk through the connected journey from migration and activation
              to stakeholder dashboards, investor outputs and entitled LP access.
            </p>

            <div className="w1e-final-actions">
              <button type="button" onClick={() => setIsDemoOpen(true)}>
                Request a private walkthrough
                <span>↗</span>
              </button>

              <a href="/demo">
                Start guided demo
                <span>→</span>
              </a>
            </div>
          </div>

          <div className="w1e-final-proof">
            <div>
              <span>01</span>
              <strong>One governed fund layer</strong>
            </div>
            <div>
              <span>02</span>
              <strong>Six stakeholder experiences</strong>
            </div>
            <div>
              <span>03</span>
              <strong>Workflow-backed investor access</strong>
            </div>
          </div>
        </section>

        <footer className="w1e-footer">
          <div className="w1e-footer-brand">
            <a href="/">VENTIQ</a>
            <p>AI Stakeholder Dashboards for Private Capital.</p>
          </div>

          <div className="w1e-footer-nav">
            <div>
              <span>PRODUCT</span>
              <a href="#modules">Stakeholders</a>
              <a href="#all-workspaces">AI Intelligence</a>
              <a href="#guided-demo">Product Journey</a>
              <a href="/product-overview">Product Overview</a>
            </div>

            <div>
              <span>EXPLORE</span>
              <a href="/demo">Guided Demo</a>
              <a href="/security">Security</a>
              <a href="/faq">FAQ</a>
              <a href="/auth/login">Sign In</a>
            </div>

            <div>
              <span>COMPANY</span>
              <a href="#about">About</a>
              <a href="#contact">Contact</a>
              <a href="/privacy">Privacy</a>
              <a href="/terms">Terms</a>
            </div>
          </div>

          <div className="w1e-footer-bottom">
            <span>© 2026 VENTIQ</span>
            <strong>One fund. Six stakeholders. One source of truth.</strong>
          </div>
        </footer>
      </div>

      {isDemoOpen && (
        <div className="demo-modal-overlay">
          <div className="demo-modal">
            <div className="demo-modal-header">
              <div>
                <p className="about-label">Request Walkthrough</p>

                <h2>See how VENTIQ gives every stakeholder one fund view.</h2>

                <p>
                  Share your details and we will reach out with a product
                  walkthrough.
                </p>
              </div>

              <button
                className="demo-close-button"
                type="button"
                onClick={() => setIsDemoOpen(false)}
              >
                ×
              </button>
            </div>
{demoSubmitMessage && (
  <div className="explain-box" style={{ marginBottom: "18px" }}>
    ✅ {demoSubmitMessage}
  </div>
)}

{demoSubmitError && (
  <div className="explain-box" style={{ marginBottom: "18px" }}>
    ⚠️ {demoSubmitError}
  </div>
)}
            <form className="demo-form" onSubmit={handleDemoSubmit}>
              <div className="demo-form-grid">
                <label>
                  Name *
                  <input
                    required
                    type="text"
                    placeholder="Your name"
                    value={demoForm.name}
                    onChange={(event) =>
                      setDemoForm({ ...demoForm, name: event.target.value })
                    }
                  />
                </label>

                <label>
                  Email *
                  <input
                    required
                    type="email"
                    placeholder="you@example.com"
                    value={demoForm.email}
                    onChange={(event) =>
                      setDemoForm({ ...demoForm, email: event.target.value })
                    }
                  />
                </label>

                <label>
                  Phone Number *
                  <input
                    required
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={demoForm.phone}
                    onChange={(event) =>
                      setDemoForm({ ...demoForm, phone: event.target.value })
                    }
                  />
                </label>

                <label>
                  Company / Fund
                  <input
                    type="text"
                    placeholder="Fund, company or firm name"
                    value={demoForm.company}
                    onChange={(event) =>
                      setDemoForm({ ...demoForm, company: event.target.value })
                    }
                  />
                </label>

                <label>
                  Role
                  <input
                    type="text"
                    placeholder="Finance Head, Founder, Partner, IR..."
                    value={demoForm.role}
                    onChange={(event) =>
                      setDemoForm({ ...demoForm, role: event.target.value })
                    }
                  />
                </label>

                <label>
                  Firm Type
                  <select
                    value={demoForm.firmType}
                    onChange={(event) =>
                      setDemoForm({
                        ...demoForm,
                        firmType: event.target.value,
                      })
                    }
                  >
                    <option value="">Select firm type</option>
                    <option>VC Fund</option>
                    <option>Private Equity Fund</option>
                    <option>Private Credit / Venture Debt Fund</option>
                    <option>Category II AIF</option>
                    <option>GIFT City Fund</option>
                    <option>Family Office</option>
                    <option>Fund Administrator</option>
                    <option>Other</option>
                  </select>
                </label>

                <label>
                  Primary Interest
                  <select
                    value={demoForm.primaryInterest}
                    onChange={(event) =>
                      setDemoForm({
                        ...demoForm,
                        primaryInterest: event.target.value,
                      })
                    }
                  >
                    <option value="">Select interest</option>
                    <option>Managing Partner Dashboard</option>
                    <option>Capital Call Workflow</option>
                    <option>Distribution Waterfall</option>
                    <option>Repayment Notices</option>
                                       <option>Investor Portal</option>
                    <option>Investor Data Room & DDQ Hub</option>
                    <option>Compliance / Knowledge Hub</option>
                    <option>Full VENTIQ walkthrough</option>
                  </select>
                </label>

                <label className="demo-message-field">
                  Message
                  <textarea
                    placeholder="Tell us which stakeholder dashboard or workflow you want to explore"
                    value={demoForm.message}
                    onChange={(event) =>
                      setDemoForm({
                        ...demoForm,
                        message: event.target.value,
                      })
                    }
                  />
                </label>
              </div>

              <div className="demo-modal-actions">
                <button className="btn" type="submit" disabled={isSubmittingDemo}>
  {isSubmittingDemo ? "Saving Request..." : "Send Walkthrough Request"}
</button>

                <button
                  className="demo-secondary-button"
                  type="button"
                  onClick={() => setIsDemoOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}