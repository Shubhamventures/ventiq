"use client";

import { type FormEvent, useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";

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
      href: "/migration/data-intake",
      linkLabel: "Open Data Intake",
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
      href: "/migration/activation",
      linkLabel: "Open Fund Activation",
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
      href: "/document-studio",
      linkLabel: "Open Document Studio",
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
      href: "/investor-portal",
      linkLabel: "Open Investor Portal",
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
      href: "/data-room",
      linkLabel: "Open Data Room & DDQ",
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
      href: "/managing-partner-ai",
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
      href: "/finance-head-ai",
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
      href: "/compliance-ai",
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
      href: "/investment-team-ai",
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
      href: "/fundraising-ai",
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
      href: "/investor-portal",
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
      <style>{`
        .w1a-hero {
          position: relative;
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(650px, 1.12fr);
          align-items: center;
          gap: clamp(38px, 4vw, 68px);
          min-height: min(735px, calc(100vh - 96px));
          padding: clamp(34px, 3.8vw, 54px) 28px clamp(22px, 2.4vw, 34px);
          isolation: isolate;
        }

        .w1a-hero::before {
          content: "";
          position: absolute;
          inset: 4% 8% auto;
          height: 58%;
          background:
            radial-gradient(circle at 28% 42%, rgba(53, 112, 255, 0.14), transparent 42%),
            radial-gradient(circle at 76% 36%, rgba(92, 130, 246, 0.10), transparent 38%);
          filter: blur(32px);
          pointer-events: none;
          z-index: -1;
        }

        .w1a-hero-copy {
          position: relative;
          z-index: 3;
          max-width: 780px;
        }

        .w1a-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 22px;
          color: #a8c5ff;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .w1a-eyebrow-dot,
        .w1a-live-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: #5f8fff;
          box-shadow: 0 0 0 6px rgba(95, 143, 255, 0.11), 0 0 28px rgba(95, 143, 255, 0.64);
          flex: 0 0 auto;
        }

        .w1a-hero h1 {
          display: flex;
          flex-direction: column;
          margin: 0;
          color: #f7f9ff;
          font-size: clamp(58px, 4.25vw, 82px);
          font-weight: 900;
          line-height: 0.95;
          letter-spacing: -0.06em;
          text-wrap: balance;
        }

        .w1a-hero h1 > span {
          white-space: nowrap;
        }

        .w1a-gradient-text {
          color: #ffffff;
          background: linear-gradient(100deg, #ffffff 5%, #d6e4ff 40%, #7fa9ff 78%, #a5c3ff 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .w1a-hero-lede {
          max-width: 690px;
          margin: 24px 0 0;
          color: #bdc9df;
          font-size: clamp(18px, 1.2vw, 22px);
          line-height: 1.55;
          letter-spacing: -0.018em;
        }

        .w1a-operating-line {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 20px;
          color: #8ea4c7;
          font-size: 12px;
        }

        .w1a-operating-line span {
          padding: 8px 12px;
          border: 1px solid rgba(115, 157, 255, 0.28);
          border-radius: 999px;
          background: rgba(29, 58, 118, 0.24);
          color: #9fc0ff;
          font-weight: 900;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .w1a-operating-line strong {
          color: #dce7fb;
          font-weight: 700;
        }

        .w1a-hero-actions {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 26px;
        }

        .w1a-primary-cta,
        .w1a-secondary-cta {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          min-height: 52px;
          padding: 0 24px;
          border-radius: 16px;
          text-decoration: none;
          font-size: 15px;
          font-weight: 900;
          transition: transform 180ms ease, border-color 180ms ease, background 180ms ease, box-shadow 180ms ease;
        }

        .w1a-primary-cta {
          border: 1px solid #4d83ff;
          background: linear-gradient(135deg, #2f6ff1, #2159d8);
          color: #ffffff;
          box-shadow: 0 18px 46px rgba(27, 86, 220, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.18);
        }

        .w1a-secondary-cta {
          border: 1px solid rgba(137, 171, 245, 0.26);
          background: rgba(10, 23, 48, 0.56);
          color: #eef4ff;
          backdrop-filter: blur(14px);
        }

        .w1a-primary-cta:hover,
        .w1a-secondary-cta:hover {
          transform: translateY(-2px);
        }

        .w1a-primary-cta:hover {
          box-shadow: 0 22px 56px rgba(27, 86, 220, 0.36), inset 0 1px 0 rgba(255, 255, 255, 0.2);
        }

        .w1a-secondary-cta:hover {
          border-color: rgba(137, 171, 245, 0.5);
          background: rgba(20, 39, 76, 0.68);
        }

        .w1a-private-walkthrough {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          margin-top: 15px;
          padding: 0;
          border: 0;
          background: transparent;
          color: #8fa9d4;
          cursor: pointer;
          font: inherit;
          font-size: 14px;
          font-weight: 800;
          transition: color 180ms ease, transform 180ms ease;
        }

        .w1a-private-walkthrough:hover {
          color: #d8e5ff;
          transform: translateX(2px);
        }

        .w1a-hero-visual {
          position: relative;
          min-width: 0;
          min-height: 545px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .w1a-stage-glow {
          position: absolute;
          border-radius: 999px;
          filter: blur(60px);
          pointer-events: none;
          opacity: 0.6;
        }

        .w1a-stage-glow-one {
          width: 340px;
          height: 340px;
          top: 9%;
          right: 9%;
          background: rgba(44, 104, 244, 0.27);
        }

        .w1a-stage-glow-two {
          width: 260px;
          height: 260px;
          bottom: 6%;
          left: 4%;
          background: rgba(49, 80, 170, 0.2);
        }

        .w1a-product-stage {
          position: relative;
          width: min(100%, 930px);
          padding: 16px;
          border: 1px solid rgba(117, 154, 235, 0.2);
          border-radius: 26px;
          background:
            linear-gradient(180deg, rgba(14, 29, 58, 0.84), rgba(5, 13, 29, 0.92)),
            radial-gradient(circle at 50% 0%, rgba(57, 113, 255, 0.16), transparent 44%);
          box-shadow:
            0 34px 90px rgba(0, 0, 0, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.04);
          backdrop-filter: blur(18px);
          overflow: hidden;
        }

        .w1a-product-stage::before {
          content: "";
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(114, 151, 235, 0.045) 1px, transparent 1px),
            linear-gradient(90deg, rgba(114, 151, 235, 0.045) 1px, transparent 1px);
          background-size: 42px 42px;
          mask-image: linear-gradient(to bottom, rgba(0,0,0,0.72), transparent 88%);
          pointer-events: none;
        }

        .w1a-stage-topline {
          position: relative;
          z-index: 2;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 18px;
          padding: 3px 3px 18px;
          color: #7087ad;
          font-size: 12px;
          letter-spacing: 0.04em;
        }

        .w1a-stage-topline > div {
          display: inline-flex;
          align-items: center;
          gap: 10px;
        }

        .w1a-stage-topline strong {
          color: #dce8ff;
          font-weight: 900;
        }

        .w1a-preview-switcher {
          position: relative;
          z-index: 3;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
          margin: 0 0 12px;
          padding: 6px;
          border: 1px solid rgba(117, 157, 246, 0.14);
          border-radius: 14px;
          background: rgba(4, 12, 27, 0.64);
        }

        .w1a-preview-switcher button {
          min-height: 38px;
          padding: 0 10px;
          border: 1px solid transparent;
          border-radius: 10px;
          background: transparent;
          color: #8298bc;
          cursor: pointer;
          font: inherit;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.035em;
          transition: color 160ms ease, background 160ms ease, border-color 160ms ease, transform 160ms ease;
        }

        .w1a-preview-switcher button:hover {
          color: #dbe8ff;
          transform: translateY(-1px);
        }

        .w1a-preview-switcher button.active {
          border-color: rgba(88, 137, 255, 0.34);
          background: linear-gradient(180deg, rgba(45, 92, 199, 0.34), rgba(16, 39, 87, 0.56));
          color: #edf4ff;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.06);
        }

        .w1a-stage-screens {
          position: relative;
          height: 385px;
          z-index: 2;
        }

        .w1a-screen-card {
          position: absolute;
          margin: 0;
          overflow: hidden;
          border: 1px solid rgba(117, 157, 246, 0.23);
          border-radius: 19px;
          background: #07101f;
          box-shadow: 0 22px 55px rgba(0, 0, 0, 0.36);
          transition: transform 220ms ease, border-color 220ms ease, box-shadow 220ms ease;
        }

        .w1a-screen-card:hover {
          border-color: rgba(117, 157, 246, 0.48);
          box-shadow: 0 28px 70px rgba(0, 0, 0, 0.46);
        }

        .w1a-screen-card figcaption {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 14px;
          min-height: 48px;
          padding: 0 14px;
          border-bottom: 1px solid rgba(117, 157, 246, 0.13);
          background: rgba(11, 23, 46, 0.96);
          color: #7f96bb;
          font-size: 10px;
          letter-spacing: 0.055em;
          text-transform: uppercase;
        }

        .w1a-screen-card figcaption strong {
          color: #cbdcff;
          font-size: 10px;
          font-weight: 900;
        }

        .w1a-screen-crop {
          position: relative;
          width: 100%;
          height: calc(100% - 48px);
          overflow: hidden;
          background: #060d1a;
        }

        .w1a-screen-crop img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: top center;
        }

        .w1a-screen-main {
          z-index: 4;
          left: 0;
          top: 0;
          width: 100%;
          height: 385px;
          transform: translateY(0);
        }

        .w1a-screen-main:hover {
          transform: translateY(-4px);
        }

        .w1a-screen-left,
        .w1a-screen-right {
          z-index: 3;
          width: 35%;
          height: 215px;
          opacity: 0.86;
        }

        .w1a-screen-left {
          left: -1%;
          bottom: 6px;
          transform: rotate(-1.7deg);
        }

        .w1a-screen-left:hover {
          transform: rotate(-1.2deg) translateY(-4px);
        }

        .w1a-screen-right {
          right: -1%;
          top: 8px;
          transform: rotate(1.6deg);
        }

        .w1a-screen-right:hover {
          transform: rotate(1deg) translateY(-4px);
        }

        .w1a-proof-badge {
          position: absolute;
          right: 14px;
          bottom: 14px;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 13px;
          border: 1px solid rgba(89, 232, 171, 0.28);
          border-radius: 13px;
          background: rgba(5, 23, 24, 0.9);
          box-shadow: 0 12px 35px rgba(0, 0, 0, 0.34);
          backdrop-filter: blur(12px);
        }

        .w1a-proof-badge span {
          color: #75ae97;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .w1a-proof-badge strong {
          color: #8cf0bd;
          font-size: 12px;
          font-weight: 950;
          letter-spacing: 0.04em;
        }

        .w1a-role-rail {
          position: relative;
          z-index: 3;
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 7px;
          margin-top: 12px;
        }

        .w1a-role-rail span {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 38px;
          padding: 7px 8px;
          border: 1px solid rgba(115, 157, 255, 0.14);
          border-radius: 11px;
          background: rgba(6, 16, 34, 0.66);
          color: #9fb4d7;
          font-size: 10px;
          font-weight: 850;
          line-height: 1.15;
          text-align: center;
        }

        .w1a-role-rail span:first-child,
        .w1a-role-rail span:last-child {
          border-color: rgba(85, 132, 246, 0.28);
          color: #c7d8f8;
        }

        .w1a-proof-rail {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0;
          margin: -4px 28px 38px;
          border-top: 1px solid rgba(126, 158, 222, 0.14);
          border-bottom: 1px solid rgba(126, 158, 222, 0.14);
        }

        .w1a-proof-rail > div {
          display: flex;
          align-items: center;
          gap: 14px;
          min-height: 68px;
          padding: 0 24px;
        }

        .w1a-proof-rail > div + div {
          border-left: 1px solid rgba(126, 158, 222, 0.14);
        }

        .w1a-proof-rail span {
          color: #5f83c9;
          font-size: 11px;
          font-weight: 950;
          letter-spacing: 0.12em;
        }

        .w1a-proof-rail strong {
          color: #c8d6ee;
          font-size: 13px;
          font-weight: 800;
          letter-spacing: -0.01em;
        }

        @media (prefers-reduced-motion: no-preference) {
          .w1a-screen-main {
            animation: w1aFloatMain 7s ease-in-out infinite;
          }

          .w1a-screen-left {
            animation: w1aFloatLeft 8.5s ease-in-out infinite;
          }

          .w1a-screen-right {
            animation: w1aFloatRight 9.5s ease-in-out infinite;
          }

          @keyframes w1aFloatMain {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-7px); }
          }

          @keyframes w1aFloatLeft {
            0%, 100% { transform: rotate(-2.6deg) translateY(0); }
            50% { transform: rotate(-2deg) translateY(-6px); }
          }

          @keyframes w1aFloatRight {
            0%, 100% { transform: rotate(2.4deg) translateY(0); }
            50% { transform: rotate(1.8deg) translateY(-8px); }
          }
        }

        @media (max-width: 1240px) {
          .w1a-hero {
            grid-template-columns: 1fr;
            min-height: auto;
            padding-top: 58px;
          }

          .w1a-hero-copy {
            max-width: 900px;
            text-align: center;
            margin: 0 auto;
          }

          .w1a-eyebrow,
          .w1a-operating-line,
          .w1a-hero-actions {
            justify-content: center;
          }

          .w1a-private-walkthrough {
            margin-left: auto;
            margin-right: auto;
          }

          .w1a-hero h1 {
            font-size: clamp(56px, 7.2vw, 84px);
          }

          .w1a-hero h1 > span {
            white-space: normal;
          }

          .w1a-hero-lede {
            margin-left: auto;
            margin-right: auto;
          }

          .w1a-hero-visual {
            min-height: 540px;
          }

          .w1a-product-stage {
            width: min(100%, 980px);
          }
        }

        @media (max-width: 820px) {
          .w1a-hero {
            padding: 62px 16px 48px;
            gap: 36px;
          }

          .w1a-eyebrow {
            font-size: 10px;
            letter-spacing: 0.1em;
          }

          .w1a-hero h1 {
            font-size: clamp(48px, 13vw, 74px);
            line-height: 0.96;
          }

          .w1a-hero-lede {
            font-size: 18px;
            line-height: 1.52;
          }

          .w1a-operating-line {
            flex-direction: column;
          }

          .w1a-hero-actions {
            flex-direction: column;
            align-items: stretch;
          }

          .w1a-primary-cta,
          .w1a-secondary-cta {
            width: 100%;
          }

          .w1a-hero-visual {
            min-height: 500px;
          }

          .w1a-product-stage {
            padding: 13px;
            border-radius: 22px;
          }

          .w1a-stage-topline > span {
            display: none;
          }

          .w1a-stage-screens {
            height: 300px;
          }

          .w1a-screen-main {
            left: 0;
            width: 100%;
            height: 300px;
            top: 0;
          }

          .w1a-screen-left,
          .w1a-screen-right {
            width: 42%;
            height: 165px;
            opacity: 0.7;
          }

          .w1a-screen-left {
            left: -1%;
            bottom: 0;
          }

          .w1a-screen-right {
            right: -1%;
          }

          .w1a-screen-card figcaption {
            min-height: 40px;
            padding: 0 10px;
          }

          .w1a-screen-card figcaption strong {
            display: none;
          }

          .w1a-screen-crop {
            height: calc(100% - 40px);
          }

          .w1a-proof-badge {
            right: 10px;
            bottom: 10px;
          }

          .w1a-preview-switcher {
            grid-template-columns: 1fr;
          }

          .w1a-preview-switcher button {
            min-height: 34px;
          }

          .w1a-role-rail {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .w1a-proof-rail {
            grid-template-columns: 1fr;
            margin: 0 16px 48px;
          }

          .w1a-proof-rail > div {
            min-height: 66px;
            padding: 0 12px;
          }

          .w1a-proof-rail > div + div {
            border-left: 0;
            border-top: 1px solid rgba(126, 158, 222, 0.14);
          }
        }

        @media (max-width: 520px) {
          .w1a-hero h1 {
            font-size: clamp(44px, 13.6vw, 62px);
          }

          .w1a-hero-visual {
            min-height: 420px;
          }

          .w1a-stage-screens {
            height: 260px;
          }

          .w1a-screen-main {
            height: 260px;
            top: 0;
          }

          .w1a-screen-left,
          .w1a-screen-right {
            height: 145px;
          }

          .w1a-role-rail span {
            min-height: 38px;
            font-size: 9px;
          }

          .w1a-proof-badge {
            display: none;
          }
        }

        /* =========================================================
           W1B — SIX ROLE-NATIVE EXPERIENCES
        ========================================================= */
        .w1b-section {
          position: relative;
          margin: 72px 28px 120px;
          padding: clamp(54px, 6vw, 88px);
          border: 1px solid rgba(111, 151, 224, 0.2);
          border-radius: 38px;
          background:
            radial-gradient(circle at 78% 18%, rgba(43, 105, 226, 0.16), transparent 34rem),
            linear-gradient(145deg, rgba(14, 28, 54, 0.96), rgba(5, 12, 25, 0.98));
          box-shadow: 0 38px 100px rgba(0, 0, 0, 0.28);
          overflow: hidden;
        }

        .w1b-section::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background-image:
            linear-gradient(rgba(91, 135, 210, 0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(91, 135, 210, 0.04) 1px, transparent 1px);
          background-size: 46px 46px;
          mask-image: linear-gradient(to bottom, rgba(0,0,0,0.7), transparent 66%);
        }

        .w1b-kicker {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          gap: 18px;
          color: #8fb4ff;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.15em;
        }

        .w1b-kicker div {
          height: 1px;
          flex: 1;
          background: linear-gradient(90deg, rgba(86, 138, 238, 0.42), transparent);
        }

        .w1b-heading-row {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr);
          gap: 48px;
          align-items: end;
          margin-top: 28px;
        }

        .w1b-heading-row h2 {
          margin: 0;
          max-width: 900px;
          color: #f8fbff;
          font-size: clamp(48px, 5.4vw, 84px);
          line-height: 0.98;
          letter-spacing: -0.06em;
        }

        .w1b-heading-row p {
          margin: 0 0 7px;
          max-width: 560px;
          color: #aabbd8;
          font-size: clamp(17px, 1.25vw, 21px);
          line-height: 1.55;
        }

        .w1b-role-tabs {
          position: relative;
          z-index: 2;
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 8px;
          margin-top: 42px;
          padding: 8px;
          border: 1px solid rgba(99, 141, 217, 0.2);
          border-radius: 22px;
          background: rgba(3, 10, 22, 0.58);
        }

        .w1b-role-tab {
          min-width: 0;
          min-height: 70px;
          padding: 12px 14px;
          border: 1px solid transparent;
          border-radius: 16px;
          background: transparent;
          color: #879ab9;
          text-align: left;
          cursor: pointer;
          transition: 180ms ease;
          font-family: inherit;
        }

        .w1b-role-tab span {
          display: block;
          margin-bottom: 7px;
          color: #5d87d7;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.12em;
        }

        .w1b-role-tab strong {
          display: block;
          color: inherit;
          font-size: 13px;
          line-height: 1.2;
        }

        .w1b-role-tab:hover {
          color: #dce8ff;
          background: rgba(32, 71, 140, 0.12);
        }

        .w1b-role-tab.active {
          color: #f7fbff;
          border-color: rgba(87, 145, 255, 0.7);
          background: linear-gradient(180deg, rgba(33, 78, 157, 0.48), rgba(17, 40, 83, 0.44));
          box-shadow: inset 0 0 0 1px rgba(114, 165, 255, 0.08), 0 12px 32px rgba(18, 64, 145, 0.18);
        }

        .w1b-showcase {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: minmax(290px, 0.34fr) minmax(0, 1fr);
          gap: 34px;
          margin-top: 28px;
          align-items: stretch;
        }

        .w1b-role-story {
          display: flex;
          flex-direction: column;
          padding: 30px 8px 24px 4px;
        }

        .w1b-role-index {
          color: #6c94df;
          font-size: 12px;
          font-weight: 950;
          letter-spacing: 0.13em;
        }

        .w1b-role-label {
          display: inline-flex;
          align-self: flex-start;
          margin-top: 26px;
          padding: 9px 13px;
          border: 1px solid rgba(92, 145, 244, 0.44);
          border-radius: 999px;
          color: #a8c8ff;
          background: rgba(24, 60, 125, 0.22);
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.09em;
          text-transform: uppercase;
        }

        .w1b-role-story h3 {
          margin: 21px 0 0;
          color: #f8fbff;
          font-size: clamp(32px, 3vw, 48px);
          line-height: 1.04;
          letter-spacing: -0.045em;
        }

        .w1b-role-description {
          margin: 18px 0 0;
          color: #aebed8;
          font-size: 16px;
          line-height: 1.6;
        }

        .w1b-proof-list {
          display: grid;
          gap: 12px;
          margin-top: 28px;
        }

        .w1b-proof-list > div {
          display: grid;
          grid-template-columns: 24px 1fr;
          gap: 10px;
          align-items: start;
        }

        .w1b-proof-list span {
          display: grid;
          place-items: center;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          color: #8ee0b7;
          background: rgba(36, 128, 88, 0.16);
          font-size: 11px;
          font-weight: 950;
        }

        .w1b-proof-list p {
          margin: 1px 0 0;
          color: #c7d3e8;
          font-size: 13px;
          line-height: 1.48;
        }

        .w1b-open-workspace {
          display: inline-flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          margin-top: 30px;
          padding: 15px 18px;
          border: 1px solid rgba(83, 141, 247, 0.45);
          border-radius: 15px;
          color: #eef5ff;
          background: rgba(25, 62, 129, 0.2);
          text-decoration: none;
          font-size: 13px;
          font-weight: 900;
          transition: 180ms ease;
        }

        .w1b-open-workspace:hover {
          border-color: rgba(100, 157, 255, 0.85);
          background: rgba(39, 89, 184, 0.28);
          transform: translateY(-1px);
        }

        .w1b-layer-note {
          margin-top: auto;
          padding-top: 28px;
        }

        .w1b-layer-note span {
          color: #6c94df;
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 0.14em;
        }

        .w1b-layer-note p {
          margin: 7px 0 0;
          color: #778ba9;
          font-size: 12px;
          line-height: 1.45;
        }

        .w1b-product-frame {
          min-width: 0;
          overflow: hidden;
          border: 1px solid rgba(100, 147, 225, 0.3);
          border-radius: 25px;
          background: #071123;
          box-shadow: 0 30px 90px rgba(0, 0, 0, 0.36);
        }

        .w1b-frame-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 22px;
          min-height: 62px;
          padding: 0 22px;
          border-bottom: 1px solid rgba(92, 132, 201, 0.18);
          background: rgba(12, 28, 55, 0.92);
        }

        .w1b-frame-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .w1b-frame-brand i {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: #4c88ff;
          box-shadow: 0 0 0 7px rgba(76, 136, 255, 0.1);
        }

        .w1b-frame-brand span {
          color: #f2f7ff;
          font-size: 12px;
          font-weight: 950;
          letter-spacing: 0.05em;
        }

        .w1b-frame-brand strong {
          color: #7f96b9;
          font-size: 11px;
          font-weight: 800;
        }

        .w1b-frame-context {
          overflow: hidden;
          color: #7590b8;
          font-size: 11px;
          font-weight: 750;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .w1b-frame-body {
          padding: 24px;
        }

        .w1b-dashboard-heading {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
        }

        .w1b-dashboard-heading > div:first-child > span {
          color: #6f93cf;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .w1b-dashboard-heading h3 {
          margin: 7px 0 0;
          color: #f7fbff;
          font-size: clamp(24px, 2vw, 34px);
          letter-spacing: -0.04em;
        }

        .w1b-live-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 9px 12px;
          border: 1px solid rgba(67, 167, 119, 0.3);
          border-radius: 999px;
          color: #95dfb8;
          background: rgba(30, 106, 73, 0.13);
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .w1b-live-pill i {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #63d89b;
          box-shadow: 0 0 0 5px rgba(99, 216, 155, 0.08);
        }

        .w1b-metrics {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 8px;
          margin-top: 22px;
        }

        .w1b-metric {
          min-width: 0;
          min-height: 88px;
          padding: 15px;
          border: 1px solid rgba(91, 132, 199, 0.18);
          border-radius: 15px;
          background: rgba(12, 27, 53, 0.72);
        }

        .w1b-metric span {
          display: block;
          min-height: 28px;
          color: #7188aa;
          font-size: 9px;
          font-weight: 850;
          line-height: 1.25;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .w1b-metric strong {
          display: block;
          margin-top: 8px;
          overflow: hidden;
          color: #f4f8ff;
          font-size: clamp(17px, 1.35vw, 23px);
          line-height: 1;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .w1b-dashboard-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin-top: 10px;
        }

        .w1b-panel {
          min-width: 0;
          min-height: 190px;
          padding: 20px;
          border: 1px solid rgba(91, 132, 199, 0.18);
          border-radius: 17px;
          background: rgba(9, 21, 43, 0.77);
        }

        .w1b-ai-panel {
          background:
            radial-gradient(circle at top right, rgba(51, 106, 210, 0.18), transparent 19rem),
            rgba(11, 25, 51, 0.84);
        }

        .w1b-panel-title span {
          display: block;
          color: #6b91d1;
          font-size: 9px;
          font-weight: 950;
          letter-spacing: 0.12em;
        }

        .w1b-panel-title strong {
          display: block;
          margin-top: 7px;
          color: #f4f8ff;
          font-size: 17px;
        }

        .w1b-performance-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin-top: 18px;
        }

        .w1b-performance-grid > div {
          padding: 12px;
          border: 1px solid rgba(91, 132, 199, 0.14);
          border-radius: 12px;
          background: rgba(13, 30, 60, 0.52);
        }

        .w1b-performance-grid span,
        .w1b-summary-rows span {
          display: block;
          color: #7187a9;
          font-size: 9px;
          font-weight: 750;
        }

        .w1b-performance-grid strong {
          display: block;
          margin-top: 6px;
          color: #eef4ff;
          font-size: 14px;
        }

        .w1b-ai-panel > p {
          margin: 20px 0 0;
          color: #b8c8e1;
          font-size: 12px;
          line-height: 1.58;
        }

        .w1b-ai-signal {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-top: 18px;
          color: #86a8e8;
          font-size: 9px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .w1b-ai-signal i {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #4a84f4;
        }

        .w1b-summary-rows {
          display: grid;
          gap: 0;
          margin-top: 13px;
        }

        .w1b-summary-rows > div {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          min-height: 33px;
          border-bottom: 1px solid rgba(86, 122, 181, 0.12);
        }

        .w1b-summary-rows > div:last-child {
          border-bottom: 0;
        }

        .w1b-summary-rows strong {
          max-width: 58%;
          color: #dce7fa;
          font-size: 10px;
          text-align: right;
        }

        .w1b-action-list {
          display: grid;
          gap: 8px;
          margin-top: 16px;
        }

        .w1b-action-list a {
          display: grid;
          grid-template-columns: 28px 1fr auto;
          gap: 10px;
          align-items: center;
          min-height: 38px;
          padding: 9px 11px;
          border: 1px solid rgba(84, 128, 205, 0.18);
          border-radius: 11px;
          color: #dfeaff;
          background: rgba(16, 37, 75, 0.5);
          text-decoration: none;
          transition: 160ms ease;
        }

        .w1b-action-list a:hover {
          border-color: rgba(98, 151, 246, 0.55);
          background: rgba(28, 61, 122, 0.58);
        }

        .w1b-action-list span {
          color: #5c86d0;
          font-size: 9px;
          font-weight: 900;
        }

        .w1b-action-list strong {
          font-size: 10px;
          line-height: 1.25;
        }

        .w1b-action-list i {
          color: #7da4e8;
          font-style: normal;
        }

        .w1b-frame-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          margin-top: 14px;
          padding-top: 14px;
          border-top: 1px solid rgba(86, 125, 190, 0.14);
        }

        .w1b-frame-footer > span {
          color: #6e86ab;
          font-size: 10px;
          font-weight: 750;
        }

        .w1b-frame-footer > div {
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .w1b-frame-footer button {
          width: 7px;
          height: 7px;
          padding: 0;
          border: 0;
          border-radius: 50%;
          background: #314d78;
          cursor: pointer;
        }

        .w1b-frame-footer button.active {
          width: 22px;
          border-radius: 999px;
          background: #4b87f7;
        }

        .w1b-trust-strip {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          margin-top: 34px;
          border-top: 1px solid rgba(87, 128, 196, 0.18);
          border-bottom: 1px solid rgba(87, 128, 196, 0.18);
        }

        .w1b-trust-strip > div {
          display: flex;
          align-items: center;
          gap: 14px;
          min-height: 72px;
          padding: 16px 20px;
          border-right: 1px solid rgba(87, 128, 196, 0.18);
        }

        .w1b-trust-strip > div:last-child {
          border-right: 0;
        }

        .w1b-trust-strip span {
          color: #4c84e8;
          font-size: 11px;
          font-weight: 950;
          letter-spacing: 0.1em;
        }

        .w1b-trust-strip strong {
          color: #c8d6eb;
          font-size: 12px;
          line-height: 1.35;
        }

        @media (max-width: 1120px) {
          .w1b-section {
            margin-left: 18px;
            margin-right: 18px;
            padding: 52px 32px;
          }

          .w1b-heading-row,
          .w1b-showcase {
            grid-template-columns: 1fr;
          }

          .w1b-heading-row {
            gap: 20px;
          }

          .w1b-role-tabs {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .w1b-role-story {
            padding-right: 0;
          }

          .w1b-layer-note {
            margin-top: 18px;
          }
        }

        @media (max-width: 760px) {
          .w1b-section {
            margin: 48px 10px 80px;
            padding: 38px 18px;
            border-radius: 26px;
          }

          .w1b-kicker {
            align-items: flex-start;
            flex-direction: column;
            gap: 9px;
          }

          .w1b-kicker div {
            width: 100%;
            flex: none;
          }

          .w1b-heading-row h2 {
            font-size: 48px;
          }

          .w1b-role-tabs {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .w1b-role-tab {
            min-height: 62px;
          }

          .w1b-frame-topbar,
          .w1b-dashboard-heading,
          .w1b-frame-footer {
            align-items: flex-start;
            flex-direction: column;
          }

          .w1b-frame-body {
            padding: 16px;
          }

          .w1b-metrics {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .w1b-dashboard-grid {
            grid-template-columns: 1fr;
          }

          .w1b-trust-strip {
            grid-template-columns: 1fr;
          }

          .w1b-trust-strip > div {
            border-right: 0;
            border-bottom: 1px solid rgba(87, 128, 196, 0.18);
          }

          .w1b-trust-strip > div:last-child {
            border-bottom: 0;
          }
        }


        /* =========================================================
           W1C — THE VENTIQ OPERATING LAYER
        ========================================================= */
        .w1c-section {
          position: relative;
          margin: 0 28px 126px;
          padding: clamp(48px, 4.6vw, 72px);
          overflow: hidden;
          border: 1px solid rgba(102, 145, 220, 0.2);
          border-radius: 40px;
          background:
            radial-gradient(circle at 50% 42%, rgba(35, 98, 216, 0.17), transparent 31rem),
            radial-gradient(circle at 10% 16%, rgba(44, 100, 196, 0.08), transparent 22rem),
            linear-gradient(155deg, rgba(8, 19, 39, 0.985), rgba(4, 10, 22, 0.995));
          box-shadow: 0 44px 110px rgba(0, 0, 0, 0.3);
          isolation: isolate;
        }

        .w1c-section::before {
          content: "";
          position: absolute;
          inset: 0;
          z-index: -1;
          pointer-events: none;
          background-image:
            linear-gradient(rgba(101, 148, 224, 0.045) 1px, transparent 1px),
            linear-gradient(90deg, rgba(101, 148, 224, 0.045) 1px, transparent 1px);
          background-size: 42px 42px;
          mask-image: radial-gradient(circle at center, #000 0%, rgba(0,0,0,0.72) 48%, transparent 86%);
        }

        .w1c-kicker {
          display: flex;
          align-items: center;
          gap: 18px;
          color: #84aef9;
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 0.16em;
        }

        .w1c-kicker div {
          height: 1px;
          flex: 1;
          background: linear-gradient(90deg, rgba(77, 132, 236, 0.46), transparent);
        }

        .w1c-heading-row {
          display: grid;
          grid-template-columns: minmax(0, 1.18fr) minmax(350px, 0.82fr);
          align-items: end;
          gap: clamp(36px, 5vw, 80px);
          margin-top: 28px;
        }

        .w1c-heading-row h2 {
          display: flex;
          flex-direction: column;
          margin: 0;
          max-width: 920px;
          color: #f8fbff;
          font-size: clamp(46px, 4.35vw, 72px);
          line-height: 1.01;
          letter-spacing: -0.058em;
        }

        .w1c-heading-row h2 > span {
          white-space: nowrap;
        }

        .w1c-heading-row p {
          margin: 0 0 7px;
          max-width: 620px;
          color: #aabbd7;
          font-size: clamp(16px, 1.18vw, 20px);
          line-height: 1.62;
        }

        .w1c-flow-shell {
          position: relative;
          display: grid;
          grid-template-columns: minmax(220px, 0.78fr) minmax(430px, 1.3fr) minmax(240px, 0.86fr);
          gap: clamp(20px, 2vw, 30px);
          margin-top: 38px;
          align-items: start;
        }

        .w1c-flow-shell::before,
        .w1c-flow-shell::after {
          content: "";
          position: absolute;
          top: 50%;
          z-index: 0;
          width: 11%;
          height: 1px;
          background: linear-gradient(90deg, rgba(72, 128, 236, 0.08), rgba(78, 140, 255, 0.72), rgba(72, 128, 236, 0.08));
          box-shadow: 0 0 20px rgba(66, 129, 255, 0.28);
          animation: w1cPulseLine 3.1s ease-in-out infinite;
        }

        .w1c-flow-shell::before {
          left: 22.7%;
        }

        .w1c-flow-shell::after {
          right: 22.7%;
          animation-delay: 1.2s;
        }

        @keyframes w1cPulseLine {
          0%, 100% { opacity: 0.35; transform: scaleX(0.82); }
          50% { opacity: 1; transform: scaleX(1); }
        }

        .w1c-zone,
        .w1c-core-zone {
          position: relative;
          z-index: 1;
          min-width: 0;
        }

        .w1c-zone {
          padding: 25px;
          border: 1px solid rgba(89, 130, 197, 0.17);
          border-radius: 24px;
          background: rgba(5, 13, 28, 0.64);
        }

        .w1c-zone-head > span {
          color: #5f88d3;
          font-size: 9px;
          font-weight: 950;
          letter-spacing: 0.13em;
        }

        .w1c-zone-head > strong {
          display: block;
          margin-top: 9px;
          color: #f0f5ff;
          font-size: 18px;
          letter-spacing: -0.02em;
        }

        .w1c-zone-head > p {
          margin: 9px 0 0;
          color: #7f94b5;
          font-size: 11px;
          line-height: 1.52;
        }

        .w1c-input-list,
        .w1c-output-list {
          display: grid;
          gap: 9px;
          margin-top: 22px;
        }

        .w1c-source-node {
          padding: 13px 14px;
          border: 1px solid rgba(79, 117, 178, 0.15);
          border-radius: 13px;
          background: rgba(10, 24, 48, 0.52);
          transition: 180ms ease;
        }

        .w1c-source-node:hover {
          transform: translateX(3px);
          border-color: rgba(95, 145, 233, 0.38);
          background: rgba(14, 32, 65, 0.66);
        }

        .w1c-source-node > span {
          color: #5f7fad;
          font-size: 8px;
          font-weight: 950;
          letter-spacing: 0.11em;
        }

        .w1c-source-node > strong {
          display: block;
          margin-top: 5px;
          color: #dce7f8;
          font-size: 12px;
        }

        .w1c-source-node > small {
          display: block;
          margin-top: 4px;
          color: #6e83a3;
          font-size: 9px;
          line-height: 1.35;
        }

        .w1c-flow-caption {
          display: flex;
          align-items: center;
          gap: 9px;
          margin-top: 22px;
          padding-top: 17px;
          border-top: 1px solid rgba(83, 123, 187, 0.13);
          color: #637b9e;
          font-size: 9px;
          font-weight: 800;
        }

        .w1c-flow-caption i {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #385f9f;
        }

        .w1c-flow-caption-right i {
          background: #5fd49a;
          box-shadow: 0 0 0 5px rgba(95, 212, 154, 0.07);
        }

        .w1c-core-zone {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .w1c-core-orbit {
          position: relative;
          width: 100%;
          padding: 28px 12px;
        }

        .w1c-core-orbit::before,
        .w1c-core-orbit::after {
          content: "";
          position: absolute;
          inset: 6% 4%;
          pointer-events: none;
          border: 1px solid rgba(68, 124, 235, 0.13);
          border-radius: 38px;
        }

        .w1c-core-orbit::after {
          inset: 13% 9%;
          border-color: rgba(68, 124, 235, 0.08);
        }

        .w1c-orbit-badge {
          position: absolute;
          z-index: 3;
          padding: 8px 11px;
          border: 1px solid rgba(82, 134, 231, 0.35);
          border-radius: 999px;
          color: #90b1ec;
          background: rgba(7, 18, 38, 0.92);
          box-shadow: 0 12px 35px rgba(0, 0, 0, 0.28);
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .w1c-orbit-badge.badge-one {
          top: 4px;
          left: 12%;
        }

        .w1c-orbit-badge.badge-two {
          right: 7%;
          top: 24%;
        }

        .w1c-orbit-badge.badge-three {
          left: 8%;
          bottom: 2px;
        }

        .w1c-core-card {
          position: relative;
          z-index: 2;
          overflow: hidden;
          padding: 26px;
          border: 1px solid rgba(82, 140, 247, 0.52);
          border-radius: 26px;
          background:
            radial-gradient(circle at 85% 13%, rgba(51, 112, 227, 0.22), transparent 20rem),
            linear-gradient(160deg, rgba(13, 34, 70, 0.97), rgba(6, 17, 35, 0.99));
          box-shadow:
            0 30px 90px rgba(0, 0, 0, 0.4),
            inset 0 0 0 1px rgba(113, 164, 255, 0.05);
        }

        .w1c-core-card::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: linear-gradient(100deg, transparent 10%, rgba(109, 158, 255, 0.055) 49%, transparent 63%);
          transform: translateX(-100%);
          animation: w1cCoreSweep 5.6s ease-in-out infinite;
        }

        @keyframes w1cCoreSweep {
          0%, 16% { transform: translateX(-100%); }
          55%, 100% { transform: translateX(100%); }
        }

        .w1c-core-topline {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
        }

        .w1c-core-topline > span {
          color: #78a2ed;
          font-size: 9px;
          font-weight: 950;
          letter-spacing: 0.13em;
        }

        .w1c-core-topline > strong {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 7px 10px;
          border: 1px solid rgba(60, 170, 118, 0.3);
          border-radius: 999px;
          color: #96dfb9;
          background: rgba(30, 102, 72, 0.13);
          font-size: 8px;
          font-weight: 950;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .w1c-core-topline > strong i {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #61d799;
          box-shadow: 0 0 0 5px rgba(97, 215, 153, 0.08);
        }

        .w1c-core-brand {
          padding: 26px 4px 20px;
          text-align: center;
        }

        .w1c-core-brand > span {
          display: block;
          color: #f8fbff;
          font-size: clamp(35px, 3.8vw, 58px);
          font-weight: 950;
          letter-spacing: -0.06em;
        }

        .w1c-core-brand > strong {
          display: block;
          margin-top: 5px;
          color: #a9c8ff;
          font-size: 14px;
        }

        .w1c-core-brand > p {
          margin: 7px 0 0;
          color: #6482ad;
          font-size: 9px;
          font-weight: 850;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .w1c-pipeline {
          display: grid;
          grid-template-columns: repeat(7, auto);
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 13px 12px;
          border: 1px solid rgba(86, 131, 202, 0.16);
          border-radius: 14px;
          background: rgba(6, 16, 33, 0.58);
        }

        .w1c-pipeline > div {
          min-width: 0;
          text-align: center;
        }

        .w1c-pipeline > div span {
          display: block;
          color: #4b77c6;
          font-size: 7px;
          font-weight: 950;
        }

        .w1c-pipeline > div strong {
          display: block;
          margin-top: 3px;
          color: #c4d4ed;
          font-size: 9px;
        }

        .w1c-pipeline > i {
          width: 24px;
          height: 1px;
          background: linear-gradient(90deg, rgba(74, 130, 234, 0.2), rgba(74, 130, 234, 0.82));
        }

        .w1c-core-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          margin-top: 12px;
        }

        .w1c-core-grid > div {
          padding: 12px 13px;
          border: 1px solid rgba(84, 128, 197, 0.17);
          border-radius: 12px;
          background: rgba(7, 19, 39, 0.62);
        }

        .w1c-core-grid span {
          display: block;
          color: #5478b4;
          font-size: 7px;
          font-weight: 950;
          letter-spacing: 0.1em;
        }

        .w1c-core-grid strong {
          display: block;
          margin-top: 5px;
          color: #dce8fa;
          font-size: 11px;
        }

        .w1c-core-footer {
          margin-top: 13px;
          padding-top: 14px;
          border-top: 1px solid rgba(86, 131, 202, 0.15);
          text-align: center;
        }

        .w1c-core-footer span {
          display: block;
          color: #5480ce;
          font-size: 7px;
          font-weight: 950;
          letter-spacing: 0.12em;
        }

        .w1c-core-footer strong {
          display: block;
          margin-top: 5px;
          color: #aebfda;
          font-size: 9px;
        }

        .w1c-output-list a {
          display: grid;
          grid-template-columns: 26px minmax(0, 1fr) auto;
          gap: 10px;
          align-items: center;
          min-height: 58px;
          padding: 10px 12px;
          border: 1px solid rgba(80, 120, 184, 0.16);
          border-radius: 13px;
          color: inherit;
          background: rgba(9, 23, 46, 0.55);
          text-decoration: none;
          transition: 180ms ease;
        }

        .w1c-output-list a:hover {
          transform: translateX(-3px);
          border-color: rgba(89, 147, 249, 0.45);
          background: rgba(15, 34, 70, 0.68);
        }

        .w1c-output-list a > span {
          display: grid;
          place-items: center;
          width: 25px;
          height: 25px;
          border-radius: 9px;
          color: #80a9f2;
          background: rgba(41, 91, 182, 0.16);
          font-size: 8px;
          font-weight: 950;
        }

        .w1c-output-list a div strong {
          display: block;
          color: #e4edf9;
          font-size: 11px;
        }

        .w1c-output-list a div small {
          display: block;
          margin-top: 4px;
          color: #6f84a4;
          font-size: 8px;
        }

        .w1c-output-list a > i {
          color: #6d97de;
          font-size: 11px;
          font-style: normal;
        }

        .w1c-proof-strip {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          margin-top: 34px;
          border-top: 1px solid rgba(88, 128, 194, 0.18);
          border-bottom: 1px solid rgba(88, 128, 194, 0.18);
        }

        .w1c-proof-strip > div {
          min-height: 128px;
          padding: 22px;
          border-right: 1px solid rgba(88, 128, 194, 0.18);
        }

        .w1c-proof-strip > div:last-child {
          border-right: 0;
        }

        .w1c-proof-strip span {
          color: #4c83e6;
          font-size: 9px;
          font-weight: 950;
          letter-spacing: 0.12em;
        }

        .w1c-proof-strip strong {
          display: block;
          margin-top: 11px;
          color: #dce7f7;
          font-size: 12px;
        }

        .w1c-proof-strip p {
          margin: 8px 0 0;
          color: #7489a9;
          font-size: 9px;
          line-height: 1.5;
        }

        @media (max-width: 1180px) {
          .w1c-section {
            margin-left: 18px;
            margin-right: 18px;
            padding: 54px 34px;
          }

          .w1c-heading-row {
            grid-template-columns: 1fr;
            gap: 22px;
          }

          .w1c-flow-shell {
            grid-template-columns: 1fr;
          }

          .w1c-flow-shell::before,
          .w1c-flow-shell::after {
            display: none;
          }

          .w1c-core-orbit {
            max-width: 720px;
            margin: 0 auto;
          }

          .w1c-input-list,
          .w1c-output-list {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .w1c-proof-strip {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .w1c-proof-strip > div:nth-child(2) {
            border-right: 0;
          }

          .w1c-proof-strip > div:nth-child(-n + 2) {
            border-bottom: 1px solid rgba(88, 128, 194, 0.18);
          }
        }

        @media (max-width: 720px) {
          .w1c-section {
            margin: 0 10px 84px;
            padding: 38px 18px;
            border-radius: 26px;
          }

          .w1c-kicker {
            align-items: flex-start;
            flex-direction: column;
            gap: 9px;
          }

          .w1c-kicker div {
            width: 100%;
            flex: none;
          }

          .w1c-heading-row h2 {
            display: block;
            font-size: 46px;
          }

          .w1c-heading-row h2 > span {
            white-space: normal;
          }

          .w1c-input-list,
          .w1c-output-list,
          .w1c-proof-strip {
            grid-template-columns: 1fr;
          }

          .w1c-core-orbit {
            padding-left: 0;
            padding-right: 0;
          }

          .w1c-orbit-badge {
            display: none;
          }

          .w1c-core-card {
            padding: 20px;
          }

          .w1c-pipeline {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }

          .w1c-pipeline > i {
            display: none;
          }

          .w1c-proof-strip > div {
            border-right: 0;
            border-bottom: 1px solid rgba(88, 128, 194, 0.18);
          }

          .w1c-proof-strip > div:last-child {
            border-bottom: 0;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .w1c-flow-shell::before,
          .w1c-flow-shell::after,
          .w1c-core-card::before {
            animation: none;
          }
        }


        /* =========================================================
           W1D — REAL PRODUCT PROOF
        ========================================================= */
        .w1d-section {
          position: relative;
          margin: 0 28px 132px;
          padding: clamp(58px, 6.3vw, 92px);
          overflow: hidden;
          border: 1px solid rgba(101, 143, 213, 0.18);
          border-radius: 40px;
          background:
            radial-gradient(circle at 14% 8%, rgba(39, 98, 209, 0.12), transparent 29rem),
            radial-gradient(circle at 86% 42%, rgba(35, 89, 188, 0.1), transparent 32rem),
            linear-gradient(160deg, rgba(6, 15, 31, 0.99), rgba(3, 9, 19, 0.995));
          box-shadow: 0 44px 110px rgba(0, 0, 0, 0.28);
          isolation: isolate;
        }

        .w1d-section::before {
          content: "";
          position: absolute;
          inset: 0;
          z-index: -1;
          pointer-events: none;
          background:
            linear-gradient(rgba(91, 132, 198, 0.035) 1px, transparent 1px),
            linear-gradient(90deg, rgba(91, 132, 198, 0.035) 1px, transparent 1px);
          background-size: 48px 48px;
          mask-image: linear-gradient(to bottom, rgba(0,0,0,0.88), transparent 86%);
        }

        .w1d-kicker {
          display: flex;
          align-items: center;
          gap: 18px;
          color: #84aef7;
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 0.16em;
        }

        .w1d-kicker div {
          height: 1px;
          flex: 1;
          background: linear-gradient(90deg, rgba(76, 130, 230, 0.45), transparent);
        }

        .w1d-intro {
          display: grid;
          grid-template-columns: minmax(0, 1.15fr) minmax(350px, 0.85fr);
          gap: clamp(42px, 5.2vw, 82px);
          align-items: end;
          margin-top: 28px;
        }

        .w1d-intro h2 {
          display: flex;
          flex-direction: column;
          margin: 0;
          color: #f8fbff;
          font-size: clamp(48px, 4.8vw, 78px);
          line-height: 0.99;
          letter-spacing: -0.06em;
        }

        .w1d-intro h2 span {
          white-space: nowrap;
        }

        .w1d-intro > div > p {
          margin: 0;
          max-width: 590px;
          color: #a9bad4;
          font-size: clamp(16px, 1.15vw, 20px);
          line-height: 1.62;
        }

        .w1d-intro > div > a {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          margin-top: 22px;
          color: #9cc0ff;
          text-decoration: none;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.02em;
        }

        .w1d-intro > div > a:hover {
          color: #dceaff;
        }

        .w1d-journey {
          display: grid;
          gap: clamp(76px, 8vw, 128px);
          margin-top: clamp(70px, 8vw, 118px);
        }

        .w1d-scene {
          display: grid;
          grid-template-columns: minmax(300px, 0.7fr) minmax(0, 1.3fr);
          gap: clamp(42px, 5vw, 86px);
          align-items: center;
        }

        .w1d-scene-reverse {
          grid-template-columns: minmax(0, 1.3fr) minmax(300px, 0.7fr);
        }

        .w1d-scene-copy {
          max-width: 510px;
        }

        .w1d-step {
          color: #608ee0;
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 0.14em;
        }

        .w1d-scene-copy h3 {
          margin: 16px 0 0;
          color: #f6f9ff;
          font-size: clamp(34px, 3.2vw, 52px);
          line-height: 1.03;
          letter-spacing: -0.045em;
        }

        .w1d-scene-copy > p {
          margin: 20px 0 0;
          color: #a8bad4;
          font-size: 15px;
          line-height: 1.66;
        }

        .w1d-proof-pills {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 24px;
        }

        .w1d-proof-pills span {
          padding: 9px 12px;
          border: 1px solid rgba(79, 129, 219, 0.28);
          border-radius: 999px;
          color: #9bb7e6;
          background: rgba(17, 43, 89, 0.24);
          font-size: 9px;
          font-weight: 850;
        }

        .w1d-scene-copy > a {
          display: inline-flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          min-width: 220px;
          margin-top: 28px;
          padding: 14px 17px;
          border: 1px solid rgba(80, 137, 239, 0.45);
          border-radius: 14px;
          color: #edf4ff;
          background: rgba(23, 58, 121, 0.2);
          text-decoration: none;
          font-size: 12px;
          font-weight: 900;
          transition: 180ms ease;
        }

        .w1d-scene-copy > a:hover {
          transform: translateY(-2px);
          border-color: rgba(101, 158, 255, 0.8);
          background: rgba(32, 77, 158, 0.28);
        }

        .w1d-screen-wrap {
          position: relative;
          min-width: 0;
        }

        .w1d-screen-label {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin: 0 4px 10px;
          color: #6e87ad;
          font-size: 9px;
          font-weight: 850;
        }

        .w1d-screen-label span {
          text-transform: uppercase;
          letter-spacing: 0.11em;
        }

        .w1d-screen-label strong {
          color: #95b2df;
          font-size: 9px;
          text-align: right;
        }

        .w1d-screen {
          position: relative;
          overflow: hidden;
          margin: 0;
          aspect-ratio: 16 / 9;
          border: 1px solid rgba(93, 139, 218, 0.3);
          border-radius: 24px;
          background: #081426;
          box-shadow: 0 32px 90px rgba(0, 0, 0, 0.42);
        }

        .w1d-screen::after {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          box-shadow: inset 0 0 0 1px rgba(255,255,255,0.025);
        }

        .w1d-screen img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 420ms cubic-bezier(.2,.8,.2,1);
        }

        .w1d-screen-wrap:hover .w1d-screen img {
          transform: scale(1.018);
        }

        .w1d-screen-light {
          border-color: rgba(177, 146, 73, 0.3);
          background: #f2eee5;
        }

        .w1d-float-proof {
          position: absolute;
          right: -16px;
          bottom: -18px;
          z-index: 4;
          min-width: 170px;
          padding: 13px 15px;
          border: 1px solid rgba(88, 140, 233, 0.35);
          border-radius: 15px;
          background: rgba(6, 16, 34, 0.96);
          box-shadow: 0 18px 50px rgba(0, 0, 0, 0.36);
        }

        .w1d-screen-right .w1d-float-proof {
          right: 18px;
        }

        .w1d-float-proof span {
          display: block;
          font-size: 7px;
          font-weight: 950;
          letter-spacing: 0.12em;
        }

        .w1d-float-proof strong {
          display: block;
          margin-top: 5px;
          color: #eaf2ff;
          font-size: 12px;
        }

        .w1d-float-blue span { color: #72a1f6; }
        .w1d-float-green {
          border-color: rgba(69, 172, 121, 0.35);
        }
        .w1d-float-green span { color: #72d8a3; }
        .w1d-float-gold {
          border-color: rgba(181, 143, 52, 0.4);
          background: rgba(34, 27, 10, 0.96);
        }
        .w1d-float-gold span { color: #d6ad4d; }

        .w1d-breadth {
          display: grid;
          grid-template-columns: minmax(280px, 0.62fr) minmax(0, 1.38fr);
          gap: 34px;
          align-items: stretch;
          margin-top: clamp(86px, 9vw, 136px);
          padding-top: 40px;
          border-top: 1px solid rgba(91, 131, 196, 0.18);
        }

        .w1d-breadth-intro {
          padding: 8px 0;
        }

        .w1d-breadth-intro span {
          color: #608ee0;
          font-size: 9px;
          font-weight: 950;
          letter-spacing: 0.14em;
        }

        .w1d-breadth-intro strong {
          display: block;
          margin-top: 12px;
          max-width: 420px;
          color: #eef4ff;
          font-size: clamp(25px, 2.25vw, 36px);
          line-height: 1.12;
          letter-spacing: -0.035em;
        }

        .w1d-engine-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          border: 1px solid rgba(86, 128, 195, 0.18);
          border-radius: 20px;
          overflow: hidden;
          background: rgba(6, 16, 33, 0.55);
        }

        .w1d-engine-grid a {
          min-width: 0;
          min-height: 138px;
          padding: 20px 16px;
          border-right: 1px solid rgba(86, 128, 195, 0.18);
          color: inherit;
          text-decoration: none;
          transition: 180ms ease;
        }

        .w1d-engine-grid a:last-child {
          border-right: 0;
        }

        .w1d-engine-grid a:hover {
          background: rgba(24, 55, 111, 0.3);
        }

        .w1d-engine-grid a > span {
          color: #4e83df;
          font-size: 9px;
          font-weight: 950;
          letter-spacing: 0.1em;
        }

        .w1d-engine-grid a > strong {
          display: block;
          margin-top: 18px;
          color: #dfe9f9;
          font-size: 12px;
        }

        .w1d-engine-grid a > small {
          display: block;
          margin-top: 7px;
          color: #7187a8;
          font-size: 9px;
          line-height: 1.45;
        }

        .w1d-close {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          gap: 26px;
          align-items: center;
          margin-top: 54px;
          padding: 24px 0 0;
          border-top: 1px solid rgba(91, 131, 196, 0.18);
        }

        .w1d-close > span {
          color: #5f8bd7;
          font-size: 8px;
          font-weight: 950;
          letter-spacing: 0.13em;
        }

        .w1d-close > strong {
          max-width: 760px;
          color: #bfcee4;
          font-size: 13px;
          line-height: 1.5;
        }

        .w1d-close > a {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          color: #a1c2fb;
          text-decoration: none;
          font-size: 10px;
          font-weight: 900;
        }

        @media (max-width: 1180px) {
          .w1d-section {
            margin-left: 18px;
            margin-right: 18px;
            padding: 54px 34px;
          }

          .w1d-intro,
          .w1d-scene,
          .w1d-scene-reverse,
          .w1d-breadth {
            grid-template-columns: 1fr;
          }

          .w1d-intro {
            gap: 22px;
          }

          .w1d-scene-copy {
            max-width: 680px;
          }

          .w1d-scene-reverse .w1d-screen-wrap {
            order: 2;
          }

          .w1d-scene-reverse .w1d-scene-copy {
            order: 1;
          }

          .w1d-engine-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .w1d-engine-grid a:nth-child(3) {
            border-right: 0;
          }

          .w1d-engine-grid a:nth-child(-n + 3) {
            border-bottom: 1px solid rgba(86, 128, 195, 0.18);
          }
        }

        @media (max-width: 720px) {
          .w1d-section {
            margin: 0 10px 88px;
            padding: 38px 18px;
            border-radius: 26px;
          }

          .w1d-kicker {
            align-items: flex-start;
            flex-direction: column;
            gap: 9px;
          }

          .w1d-kicker div {
            width: 100%;
            flex: none;
          }

          .w1d-intro h2 {
            display: block;
            font-size: 46px;
          }

          .w1d-intro h2 span {
            white-space: normal;
          }

          .w1d-journey {
            gap: 76px;
          }

          .w1d-float-proof {
            position: relative;
            right: auto !important;
            bottom: auto;
            width: fit-content;
            margin: 10px 0 0 auto;
          }

          .w1d-engine-grid {
            grid-template-columns: 1fr;
          }

          .w1d-engine-grid a {
            min-height: 100px;
            border-right: 0 !important;
            border-bottom: 1px solid rgba(86, 128, 195, 0.18);
          }

          .w1d-engine-grid a:last-child {
            border-bottom: 0;
          }

          .w1d-close {
            grid-template-columns: 1fr;
            gap: 12px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .w1d-screen img {
            transition: none;
          }

          .w1d-screen-wrap:hover .w1d-screen img {
            transform: none;
          }
        }


        /* =========================================================
           W1E — LOWER HOMEPAGE CLEANUP & CONVERSION
        ========================================================= */

        .w1e-ai-section,
        .w1e-security-section,
        .w1e-about-section,
        .w1e-final-section {
          position: relative;
          margin-left: 28px;
          margin-right: 28px;
        }

        .w1e-section-kicker,
        .w1e-final-kicker {
          display: flex;
          align-items: center;
          gap: 18px;
          color: #83acf4;
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 0.16em;
        }

        .w1e-section-kicker > div,
        .w1e-final-kicker > div {
          height: 1px;
          flex: 1;
          background: linear-gradient(90deg, rgba(77, 132, 235, 0.45), transparent);
        }

        .w1e-ai-section {
          margin-bottom: 120px;
          padding: clamp(58px, 6vw, 88px);
          overflow: hidden;
          border: 1px solid rgba(97, 141, 213, 0.19);
          border-radius: 38px;
          background:
            radial-gradient(circle at 78% 28%, rgba(45, 101, 210, 0.16), transparent 31rem),
            linear-gradient(150deg, rgba(8, 18, 37, 0.985), rgba(4, 10, 22, 0.995));
        }

        .w1e-ai-layout {
          display: grid;
          grid-template-columns: minmax(0, 0.83fr) minmax(500px, 1.17fr);
          gap: clamp(42px, 5vw, 80px);
          align-items: center;
          margin-top: 40px;
        }

        .w1e-ai-copy h2 {
          margin: 0;
          max-width: 720px;
          color: #f8fbff;
          font-size: clamp(45px, 4.4vw, 72px);
          line-height: 0.99;
          letter-spacing: -0.058em;
        }

        .w1e-ai-copy h2 span {
          display: block;
          color: #95b8f7;
        }

        .w1e-ai-copy > p {
          margin: 24px 0 0;
          max-width: 630px;
          color: #aabbd5;
          font-size: 16px;
          line-height: 1.64;
        }

        .w1e-ai-steps {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin-top: 30px;
        }

        .w1e-ai-steps > div {
          min-height: 148px;
          padding: 19px;
          border: 1px solid rgba(86, 129, 199, 0.16);
          border-radius: 16px;
          background: rgba(7, 18, 38, 0.52);
        }

        .w1e-ai-steps span {
          color: #4f83df;
          font-size: 9px;
          font-weight: 950;
          letter-spacing: 0.1em;
        }

        .w1e-ai-steps strong {
          display: block;
          margin-top: 13px;
          color: #e7eefb;
          font-size: 16px;
        }

        .w1e-ai-steps p {
          margin: 8px 0 0;
          color: #778daa;
          font-size: 10px;
          line-height: 1.5;
        }

        .w1e-ai-product {
          overflow: hidden;
          border: 1px solid rgba(92, 143, 233, 0.36);
          border-radius: 24px;
          background: #071326;
          box-shadow: 0 32px 90px rgba(0,0,0,0.38);
        }

        .w1e-ai-product-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          min-height: 58px;
          padding: 0 20px;
          border-bottom: 1px solid rgba(89, 131, 199, 0.18);
          background: #0d1d39;
        }

        .w1e-ai-product-top > div {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .w1e-ai-product-top i {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #4e88fb;
          box-shadow: 0 0 0 6px rgba(78, 136, 251, 0.09);
        }

        .w1e-ai-product-top strong {
          color: #eef5ff;
          font-size: 11px;
          letter-spacing: 0.04em;
        }

        .w1e-ai-product-top > span {
          color: #728aae;
          font-size: 9px;
          font-weight: 800;
        }

        .w1e-ai-opinion {
          margin: 22px;
          padding: 24px;
          border: 1px solid rgba(87, 134, 216, 0.24);
          border-radius: 18px;
          background:
            radial-gradient(circle at top right, rgba(46, 100, 202, 0.22), transparent 19rem),
            rgba(12, 29, 59, 0.78);
        }

        .w1e-ai-opinion > span,
        .w1e-ai-actions-head > span {
          color: #6d9aeb;
          font-size: 8px;
          font-weight: 950;
          letter-spacing: 0.13em;
        }

        .w1e-ai-opinion h3 {
          margin: 9px 0 0;
          color: #f6f9ff;
          font-size: clamp(25px, 2.1vw, 34px);
          letter-spacing: -0.035em;
        }

        .w1e-ai-opinion p {
          margin: 16px 0 0;
          max-width: 580px;
          color: #b5c5dd;
          font-size: 12px;
          line-height: 1.6;
        }

        .w1e-ai-opinion > div {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-top: 18px;
          color: #87a9e6;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 0.09em;
          text-transform: uppercase;
        }

        .w1e-ai-opinion > div i {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #4c84f1;
        }

        .w1e-ai-actions {
          margin: 0 22px 22px;
          padding: 20px;
          border: 1px solid rgba(86, 129, 200, 0.17);
          border-radius: 18px;
          background: rgba(7, 18, 38, 0.72);
        }

        .w1e-ai-actions-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 13px;
        }

        .w1e-ai-actions-head strong {
          color: #8ea4c6;
          font-size: 9px;
        }

        .w1e-ai-actions > a {
          display: grid;
          grid-template-columns: 30px 1fr auto;
          gap: 11px;
          align-items: center;
          min-height: 44px;
          padding: 9px 11px;
          border-top: 1px solid rgba(86, 127, 191, 0.13);
          color: #dce7f7;
          text-decoration: none;
        }

        .w1e-ai-actions > a > span {
          color: #4e7fd5;
          font-size: 8px;
          font-weight: 950;
        }

        .w1e-ai-actions > a > strong {
          font-size: 10px;
        }

        .w1e-ai-actions > a > i {
          color: #6d98e1;
          font-style: normal;
        }

        .w1e-ai-role-rail {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 14px 22px 18px;
          border-top: 1px solid rgba(88, 130, 197, 0.14);
        }

        .w1e-ai-role-rail > span {
          color: #637a9d;
          font-size: 8px;
          font-weight: 850;
        }

        .w1e-ai-role-rail > div {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .w1e-ai-role-rail strong {
          padding: 6px 8px;
          border: 1px solid rgba(83, 124, 189, 0.16);
          border-radius: 999px;
          color: #7289aa;
          font-size: 7px;
        }

        .w1e-security-section {
          margin-bottom: 118px;
          padding: clamp(56px, 5.6vw, 82px);
          border-top: 1px solid rgba(88, 129, 195, 0.17);
          border-bottom: 1px solid rgba(88, 129, 195, 0.17);
        }

        .w1e-security-heading {
          display: grid;
          grid-template-columns: minmax(0, 1.1fr) minmax(360px, 0.9fr);
          gap: 60px;
          align-items: end;
        }

        .w1e-security-heading span,
        .w1e-about-copy > span {
          color: #6692de;
          font-size: 9px;
          font-weight: 950;
          letter-spacing: 0.14em;
        }

        .w1e-security-heading h2 {
          margin: 16px 0 0;
          max-width: 850px;
          color: #f7faff;
          font-size: clamp(42px, 4vw, 64px);
          line-height: 1.02;
          letter-spacing: -0.052em;
        }

        .w1e-security-heading > p {
          margin: 0 0 5px;
          color: #9eb0ca;
          font-size: 15px;
          line-height: 1.62;
        }

        .w1e-security-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          margin-top: 42px;
          border: 1px solid rgba(85, 126, 192, 0.17);
          border-radius: 22px;
          overflow: hidden;
          background: rgba(6, 15, 31, 0.5);
        }

        .w1e-security-grid > div {
          min-height: 208px;
          padding: 24px;
          border-right: 1px solid rgba(85, 126, 192, 0.17);
        }

        .w1e-security-grid > div:last-child {
          border-right: 0;
        }

        .w1e-security-grid span {
          color: #4e82de;
          font-size: 9px;
          font-weight: 950;
        }

        .w1e-security-grid strong {
          display: block;
          margin-top: 22px;
          color: #e8effb;
          font-size: 16px;
          line-height: 1.25;
        }

        .w1e-security-grid p {
          margin: 12px 0 0;
          color: #758aa8;
          font-size: 10px;
          line-height: 1.55;
        }

        .w1e-security-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          margin-top: 20px;
          color: #6f85a5;
          font-size: 9px;
          font-weight: 800;
        }

        .w1e-security-footer a {
          display: inline-flex;
          gap: 9px;
          color: #8eb3f3;
          text-decoration: none;
          font-weight: 900;
        }

        .w1e-security-footer i {
          font-style: normal;
        }

        .w1e-about-section {
          display: grid;
          grid-template-columns: minmax(0, 1.16fr) minmax(380px, 0.84fr);
          gap: clamp(42px, 6vw, 94px);
          align-items: center;
          margin-bottom: 118px;
          padding: clamp(36px, 4.2vw, 64px) clamp(24px, 4.5vw, 70px);
        }

        .w1e-about-copy h2 {
          margin: 17px 0 0;
          max-width: 820px;
          color: #f8fbff;
          font-size: clamp(42px, 4.25vw, 68px);
          line-height: 1.01;
          letter-spacing: -0.055em;
        }

        .w1e-about-copy > p {
          margin: 20px 0 0;
          max-width: 790px;
          color: #9fb1cb;
          font-size: 15px;
          line-height: 1.65;
        }

        .w1e-about-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 28px;
        }

        .w1e-about-chips span {
          padding: 9px 12px;
          border: 1px solid rgba(84, 133, 220, 0.28);
          border-radius: 999px;
          color: #91acda;
          background: rgba(18, 44, 90, 0.19);
          font-size: 9px;
          font-weight: 850;
        }

        .w1e-founder-card {
          padding: 30px;
          border: 1px solid rgba(87, 139, 229, 0.37);
          border-radius: 24px;
          background:
            radial-gradient(circle at top right, rgba(48, 102, 210, 0.16), transparent 20rem),
            rgba(8, 20, 42, 0.82);
          box-shadow: 0 28px 80px rgba(0,0,0,0.28);
        }

        .w1e-founder-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }

        .w1e-founder-top span {
          color: #6e99e5;
          font-size: 8px;
          font-weight: 950;
          letter-spacing: 0.12em;
        }

        .w1e-founder-top strong {
          color: #6f85a5;
          font-size: 9px;
        }

        .w1e-founder-card h3 {
          margin: 28px 0 0;
          color: #f5f9ff;
          font-size: 31px;
          letter-spacing: -0.04em;
        }

        .w1e-founder-card > p {
          margin: 14px 0 0;
          color: #a7b8d0;
          font-size: 13px;
          line-height: 1.62;
        }

        .w1e-founder-proof {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
          margin-top: 24px;
        }

        .w1e-founder-proof > div {
          min-height: 78px;
          padding: 12px;
          border: 1px solid rgba(82, 123, 190, 0.16);
          border-radius: 12px;
          background: rgba(6, 17, 36, 0.55);
        }

        .w1e-founder-proof span {
          display: block;
          color: #577ebd;
          font-size: 7px;
          font-weight: 950;
          letter-spacing: 0.1em;
        }

        .w1e-founder-proof strong {
          display: block;
          margin-top: 7px;
          color: #d8e4f6;
          font-size: 10px;
        }

        .w1e-founder-card > button {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          width: 100%;
          margin-top: 22px;
          padding: 14px 16px;
          border: 1px solid rgba(83, 140, 241, 0.46);
          border-radius: 13px;
          color: #eef5ff;
          background: rgba(25, 62, 130, 0.22);
          cursor: pointer;
          font-family: inherit;
          font-size: 11px;
          font-weight: 900;
        }

        .w1e-final-section {
          margin-bottom: 44px;
          padding: clamp(58px, 7vw, 100px);
          overflow: hidden;
          border: 1px solid rgba(86, 143, 247, 0.42);
          border-radius: 36px;
          background:
            radial-gradient(circle at 80% 24%, rgba(46, 113, 236, 0.25), transparent 33rem),
            linear-gradient(145deg, rgba(13, 31, 65, 0.98), rgba(5, 14, 30, 0.995));
          box-shadow: 0 36px 100px rgba(0,0,0,0.33);
        }

        .w1e-final-content {
          max-width: 1120px;
          margin: 48px auto 0;
          text-align: center;
        }

        .w1e-final-content h2 {
          margin: 0;
          color: #f8fbff;
          font-size: clamp(52px, 5.8vw, 92px);
          line-height: 0.95;
          letter-spacing: -0.065em;
        }

        .w1e-final-content h2 span {
          display: block;
          color: #9abcf8;
        }

        .w1e-final-content > p {
          max-width: 760px;
          margin: 28px auto 0;
          color: #acbed8;
          font-size: 17px;
          line-height: 1.6;
        }

        .w1e-final-actions {
          display: flex;
          justify-content: center;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 32px;
        }

        .w1e-final-actions button,
        .w1e-final-actions a {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 14px;
          min-height: 54px;
          padding: 0 24px;
          border-radius: 14px;
          font-family: inherit;
          font-size: 11px;
          font-weight: 900;
          text-decoration: none;
        }

        .w1e-final-actions button {
          border: 1px solid #5d99ff;
          color: white;
          background: linear-gradient(135deg, #3377ef, #285fd1);
          cursor: pointer;
          box-shadow: 0 18px 42px rgba(40, 103, 222, 0.25);
        }

        .w1e-final-actions a {
          border: 1px solid rgba(94, 142, 224, 0.35);
          color: #dce9ff;
          background: rgba(8, 21, 45, 0.56);
        }

        .w1e-final-proof {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          max-width: 1000px;
          margin: 56px auto 0;
          border-top: 1px solid rgba(103, 151, 229, 0.2);
          border-bottom: 1px solid rgba(103, 151, 229, 0.2);
        }

        .w1e-final-proof > div {
          display: flex;
          align-items: center;
          gap: 14px;
          min-height: 76px;
          padding: 16px 20px;
          border-right: 1px solid rgba(103, 151, 229, 0.2);
        }

        .w1e-final-proof > div:last-child {
          border-right: 0;
        }

        .w1e-final-proof span {
          color: #5b90ed;
          font-size: 9px;
          font-weight: 950;
        }

        .w1e-final-proof strong {
          color: #cad8ec;
          font-size: 11px;
        }

        .w1e-footer {
          margin: 0 28px;
          padding: 42px 18px 24px;
          border-top: 1px solid rgba(86, 126, 189, 0.17);
        }

        .w1e-footer {
          display: grid;
          grid-template-columns: minmax(220px, 0.8fr) minmax(0, 1.2fr);
          gap: 60px;
        }

        .w1e-footer-brand > a {
          color: #f7f9ff;
          text-decoration: none;
          font-size: 26px;
          font-weight: 950;
          letter-spacing: -0.05em;
        }

        .w1e-footer-brand p {
          margin: 12px 0 0;
          max-width: 320px;
          color: #7388a8;
          font-size: 10px;
          line-height: 1.5;
        }

        .w1e-footer-nav {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 28px;
        }

        .w1e-footer-nav > div {
          display: flex;
          flex-direction: column;
          gap: 9px;
        }

        .w1e-footer-nav span {
          margin-bottom: 4px;
          color: #5579b2;
          font-size: 7px;
          font-weight: 950;
          letter-spacing: 0.13em;
        }

        .w1e-footer-nav a {
          color: #90a2bd;
          text-decoration: none;
          font-size: 9px;
          font-weight: 800;
        }

        .w1e-footer-nav a:hover {
          color: #d6e3f7;
        }

        .w1e-footer-bottom {
          grid-column: 1 / -1;
          display: flex;
          justify-content: space-between;
          gap: 20px;
          padding-top: 25px;
          border-top: 1px solid rgba(86, 126, 189, 0.13);
          color: #536985;
          font-size: 8px;
          font-weight: 800;
        }

        .w1e-footer-bottom strong {
          color: #7087a8;
          font-size: 8px;
        }

        @media (max-width: 1120px) {
          .w1e-ai-section,
          .w1e-security-section,
          .w1e-about-section,
          .w1e-final-section {
            margin-left: 18px;
            margin-right: 18px;
          }

          .w1e-ai-layout,
          .w1e-security-heading,
          .w1e-about-section {
            grid-template-columns: 1fr;
          }

          .w1e-security-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .w1e-security-grid > div:nth-child(2) {
            border-right: 0;
          }

          .w1e-security-grid > div:nth-child(-n + 2) {
            border-bottom: 1px solid rgba(85, 126, 192, 0.17);
          }

          .w1e-about-copy {
            max-width: 820px;
          }

          .w1e-founder-card {
            max-width: 680px;
          }
        }

        @media (max-width: 720px) {
          .w1e-ai-section,
          .w1e-final-section {
            margin-left: 10px;
            margin-right: 10px;
            padding: 38px 18px;
            border-radius: 26px;
          }

          .w1e-security-section,
          .w1e-about-section {
            margin-left: 10px;
            margin-right: 10px;
            padding-left: 18px;
            padding-right: 18px;
          }

          .w1e-section-kicker,
          .w1e-final-kicker {
            align-items: flex-start;
            flex-direction: column;
            gap: 9px;
          }

          .w1e-section-kicker > div,
          .w1e-final-kicker > div {
            width: 100%;
            flex: none;
          }

          .w1e-ai-copy h2,
          .w1e-security-heading h2,
          .w1e-about-copy h2 {
            font-size: 44px;
          }

          .w1e-ai-steps,
          .w1e-security-grid,
          .w1e-founder-proof,
          .w1e-final-proof,
          .w1e-footer,
          .w1e-footer-nav {
            grid-template-columns: 1fr;
          }

          .w1e-security-grid > div {
            border-right: 0;
            border-bottom: 1px solid rgba(85, 126, 192, 0.17);
          }

          .w1e-security-grid > div:last-child {
            border-bottom: 0;
          }

          .w1e-final-content h2 {
            font-size: 52px;
          }

          .w1e-final-proof > div {
            border-right: 0;
            border-bottom: 1px solid rgba(103, 151, 229, 0.2);
          }

          .w1e-final-proof > div:last-child {
            border-bottom: 0;
          }

          .w1e-footer {
            margin: 0 10px;
            gap: 32px;
          }

          .w1e-footer-bottom {
            flex-direction: column;
          }
        }


        /* =========================================================
           W1F — FINAL HOMEPAGE POLISH + PLATFORM BREADTH
        ========================================================= */

        html {
          scroll-behavior: smooth;
        }

        .ventiq-header {
          position: sticky;
          top: 0;
          z-index: 120;
          background: rgba(3, 10, 22, 0.92);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          border-bottom: 1px solid rgba(88, 129, 194, 0.16);
        }

        .ventiq-header-cta {
          font-family: inherit;
          cursor: pointer;
        }

        #why-ventiq,
        #modules,
        #platform-breadth,
        #guided-demo,
        #all-workspaces,
        #security,
        #about,
        #contact {
          scroll-margin-top: 118px;
        }

        .w1a-primary-cta {
          font-family: inherit;
          cursor: pointer;
        }

        .w1a-private-walkthrough {
          width: fit-content;
          text-decoration: none;
        }

        .w1f-platform-breadth {
          margin-top: clamp(86px, 9vw, 136px);
          padding-top: 42px;
          border-top: 1px solid rgba(91, 131, 196, 0.18);
        }

        .w1f-platform-heading {
          display: grid;
          grid-template-columns: minmax(280px, 0.72fr) minmax(0, 1.28fr);
          gap: 44px;
          align-items: end;
        }

        .w1f-platform-heading > div > span {
          color: #608ee0;
          font-size: 9px;
          font-weight: 950;
          letter-spacing: 0.14em;
        }

        .w1f-platform-heading > div > strong {
          display: block;
          margin-top: 12px;
          max-width: 520px;
          color: #eef4ff;
          font-size: clamp(28px, 2.5vw, 42px);
          line-height: 1.08;
          letter-spacing: -0.038em;
        }

        .w1f-platform-heading > p {
          margin: 0 0 5px;
          max-width: 680px;
          color: #8fa3c1;
          font-size: 13px;
          line-height: 1.6;
        }

        .w1f-platform-columns {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          margin-top: 30px;
        }

        .w1f-platform-column {
          min-width: 0;
          padding: 22px;
          border: 1px solid rgba(86, 128, 195, 0.18);
          border-radius: 20px;
          background: rgba(6, 16, 33, 0.55);
        }

        .w1f-platform-status {
          display: flex;
          align-items: center;
          gap: 12px;
          min-height: 48px;
          padding-bottom: 16px;
          border-bottom: 1px solid rgba(86, 128, 195, 0.14);
        }

        .w1f-platform-status > i {
          width: 9px;
          height: 9px;
          flex: 0 0 auto;
          border-radius: 50%;
          background: #4d85e8;
          box-shadow: 0 0 0 7px rgba(77, 133, 232, 0.08);
        }

        .w1f-platform-working .w1f-platform-status > i {
          background: #60d39a;
          box-shadow: 0 0 0 7px rgba(96, 211, 154, 0.07);
        }

        .w1f-platform-roadmap .w1f-platform-status > i {
          background: #c99b3e;
          box-shadow: 0 0 0 7px rgba(201, 155, 62, 0.07);
        }

        .w1f-platform-status span {
          display: block;
          color: #5f8bd5;
          font-size: 8px;
          font-weight: 950;
          letter-spacing: 0.12em;
        }

        .w1f-platform-working .w1f-platform-status span {
          color: #72d9a5;
        }

        .w1f-platform-roadmap .w1f-platform-status span {
          color: #d7ad55;
        }

        .w1f-platform-status strong {
          display: block;
          margin-top: 4px;
          color: #dce7f8;
          font-size: 11px;
        }

        .w1f-platform-items {
          display: grid;
          gap: 8px;
          margin-top: 14px;
        }

        .w1f-platform-items > a,
        .w1f-platform-items > div {
          position: relative;
          min-height: 76px;
          padding: 14px 42px 14px 14px;
          border: 1px solid rgba(82, 123, 189, 0.14);
          border-radius: 13px;
          color: inherit;
          background: rgba(8, 21, 43, 0.48);
          text-decoration: none;
          transition: 170ms ease;
        }

        .w1f-platform-items > a:hover {
          transform: translateY(-1px);
          border-color: rgba(91, 147, 244, 0.42);
          background: rgba(16, 38, 78, 0.62);
        }

        .w1f-platform-items strong {
          display: block;
          color: #e1eaf8;
          font-size: 11px;
        }

        .w1f-platform-items span {
          display: block;
          margin-top: 6px;
          color: #7489a8;
          font-size: 8px;
          line-height: 1.4;
        }

        .w1f-platform-items > a > i {
          position: absolute;
          right: 15px;
          top: 50%;
          transform: translateY(-50%);
          color: #6d98e3;
          font-style: normal;
          font-size: 11px;
        }

        .w1f-platform-items em {
          position: absolute;
          right: 12px;
          top: 12px;
          padding: 5px 7px;
          border: 1px solid rgba(190, 145, 52, 0.26);
          border-radius: 999px;
          color: #cda657;
          font-size: 7px;
          font-style: normal;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .w1f-ai-process {
          display: grid;
          grid-template-columns: repeat(7, auto);
          align-items: center;
          justify-content: start;
          gap: 10px;
          margin-top: 28px;
          padding: 13px 15px;
          border: 1px solid rgba(86, 129, 199, 0.16);
          border-radius: 14px;
          background: rgba(7, 18, 38, 0.52);
        }

        .w1f-ai-process span {
          color: #a7bce0;
          font-size: 10px;
          font-weight: 900;
        }

        .w1f-ai-process i {
          color: #4f83df;
          font-size: 10px;
          font-style: normal;
        }

        /* One public conversion hierarchy */
        .w1e-final-actions button,
        .w1a-primary-cta,
        .ventiq-header-cta {
          font-weight: 900;
        }

        @media (max-width: 1120px) {
          .w1f-platform-heading {
            grid-template-columns: 1fr;
            gap: 16px;
          }

          .w1f-platform-columns {
            grid-template-columns: 1fr;
          }
        }



        /* W1F4 — DESKTOP WIDTH POLISH
           Keep premium breathing room while giving product UI more screen real estate. */
        @media (min-width: 1280px) {
          main > .container {
            width: min(100%, 1680px);
            max-width: 1680px;
            margin-left: auto;
            margin-right: auto;
            padding-left: clamp(16px, 1.7vw, 28px);
            padding-right: clamp(16px, 1.7vw, 28px);
            box-sizing: border-box;
          }

          .w1f2-site-header {
            padding-left: clamp(24px, 2.8vw, 52px);
            padding-right: clamp(24px, 2.8vw, 52px);
          }

          .w1a-hero {
            padding-left: 18px;
            padding-right: 18px;
          }

          .w1b-section,
          .w1c-section,
          .w1d-section,
          .w1e-ai-section,
          .w1e-security-section,
          .w1e-about-section,
          .w1e-final-section,
          .w1f2-product-section,
          .w1f2-platform-section,
          .w1f2-intelligence-section,
          .w1f2-close-section {
            margin-left: 18px;
            margin-right: 18px;
          }
        }

        @media (max-width: 720px) {
          #why-ventiq,
          #modules,
          #platform-breadth,
          #guided-demo,
          #all-workspaces,
          #security,
          #about,
          #contact {
            scroll-margin-top: 92px;
          }

          .w1f-ai-process {
            grid-template-columns: 1fr;
            justify-items: start;
          }

          .w1f-ai-process i {
            transform: rotate(90deg);
          }
        }


        /* =========================================================
           W1F2 — COMPACT HOMEPAGE / INTERACTIVE SCROLL REDUCTION
        ========================================================= */

        .w1f2-site-header {
          position: sticky;
          top: 0;
          z-index: 300;
          display: grid;
          grid-template-columns: 155px minmax(0, 1fr) auto;
          align-items: center;
          gap: 28px;
          min-height: 82px;
          padding: 0 clamp(28px, 4vw, 70px);
          border-bottom: 1px solid rgba(88, 129, 194, 0.16);
          background: rgba(3, 10, 22, 0.94);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
        }

        .w1f2-site-brand {
          display: inline-flex;
          align-items: center;
          width: fit-content;
          color: #f8fbff;
          text-decoration: none;
          font-size: 30px;
          font-weight: 950;
          line-height: 1;
          letter-spacing: -0.055em;
          white-space: nowrap;
        }

        .w1f2-site-nav {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: clamp(20px, 2.2vw, 38px);
          min-width: 0;
        }

        .w1f2-site-nav a {
          color: #d8dfeb;
          text-decoration: none;
          font-size: clamp(12px, 1vw, 15px);
          font-weight: 850;
          white-space: nowrap;
        }

        .w1f2-site-nav a:hover {
          color: #ffffff;
        }

        .w1f2-site-cta {
          min-height: 48px;
          padding: 0 22px;
          border: 1px solid #659fff;
          border-radius: 999px;
          color: #fff;
          background: linear-gradient(135deg, #3477ef, #2861d5);
          cursor: pointer;
          font-family: inherit;
          font-size: 13px;
          font-weight: 900;
          white-space: nowrap;
          box-shadow: 0 14px 34px rgba(42, 104, 223, 0.2);
        }

        .w1a-hero {
          min-height: auto !important;
          padding-top: clamp(56px, 6vw, 88px) !important;
          padding-bottom: clamp(52px, 5vw, 76px) !important;
        }

        .w1b-section,
        .w1c-section {
          margin-bottom: 72px !important;
        }

        .w1c-section {
          padding-top: clamp(48px, 4.5vw, 68px) !important;
          padding-bottom: clamp(48px, 4.5vw, 68px) !important;
        }

        .w1f2-section-kicker {
          display: flex;
          align-items: center;
          gap: 18px;
          color: #83acf4;
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 0.16em;
        }

        .w1f2-section-kicker > div {
          height: 1px;
          flex: 1;
          background: linear-gradient(90deg, rgba(77, 132, 235, 0.45), transparent);
        }

        .w1f2-product-section,
        .w1f2-platform-section,
        .w1f2-intelligence-section,
        .w1f2-close-section {
          position: relative;
          margin-left: 28px;
          margin-right: 28px;
          margin-bottom: 72px;
        }

        .w1f2-product-section {
          padding: clamp(50px, 5vw, 72px);
          border: 1px solid rgba(96, 139, 211, 0.19);
          border-radius: 34px;
          background:
            radial-gradient(circle at 76% 36%, rgba(38, 94, 204, 0.13), transparent 31rem),
            linear-gradient(155deg, rgba(6, 15, 31, 0.99), rgba(3, 9, 19, 0.995));
          overflow: hidden;
        }

        .w1f2-product-heading {
          display: grid;
          grid-template-columns: minmax(0, 1.06fr) minmax(360px, 0.94fr);
          gap: 54px;
          align-items: end;
          margin-top: 25px;
        }

        .w1f2-product-heading h2 {
          margin: 0;
          color: #f8fbff;
          font-size: clamp(43px, 4vw, 64px);
          line-height: 1.01;
          letter-spacing: -0.055em;
        }

        .w1f2-product-heading p {
          margin: 0 0 4px;
          color: #9fb1cb;
          font-size: 14px;
          line-height: 1.6;
        }

        .w1f2-journey-tabs {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 8px;
          margin-top: 30px;
          padding: 8px;
          border: 1px solid rgba(86, 128, 195, 0.18);
          border-radius: 17px;
          background: rgba(5, 14, 29, 0.7);
        }

        .w1f2-journey-tabs button {
          min-width: 0;
          min-height: 60px;
          padding: 10px 12px;
          border: 1px solid transparent;
          border-radius: 12px;
          color: #7388aa;
          background: transparent;
          cursor: pointer;
          font-family: inherit;
          text-align: left;
        }

        .w1f2-journey-tabs button span {
          display: block;
          color: #4f7bc9;
          font-size: 8px;
          font-weight: 950;
        }

        .w1f2-journey-tabs button strong {
          display: block;
          margin-top: 5px;
          font-size: 10px;
          white-space: nowrap;
        }

        .w1f2-journey-tabs button.active {
          border-color: rgba(87, 146, 250, 0.55);
          color: #f2f7ff;
          background: linear-gradient(150deg, rgba(33, 77, 157, 0.42), rgba(15, 37, 77, 0.68));
        }

        .w1f2-product-stage {
          display: grid;
          grid-template-columns: minmax(300px, 0.72fr) minmax(0, 1.28fr);
          gap: clamp(38px, 5vw, 78px);
          align-items: center;
          margin-top: 34px;
        }

        .w1f2-product-copy > span {
          color: #6292e5;
          font-size: 9px;
          font-weight: 950;
          letter-spacing: 0.13em;
        }

        .w1f2-product-copy h3 {
          margin: 14px 0 0;
          color: #f7faff;
          font-size: clamp(34px, 3.2vw, 50px);
          line-height: 1.03;
          letter-spacing: -0.045em;
        }

        .w1f2-product-copy > p {
          margin: 18px 0 0;
          color: #a7b9d1;
          font-size: 14px;
          line-height: 1.6;
        }

        .w1f2-product-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 20px;
        }

        .w1f2-product-chips span {
          padding: 8px 10px;
          border: 1px solid rgba(80, 130, 219, 0.28);
          border-radius: 999px;
          color: #94afdb;
          background: rgba(16, 41, 85, 0.2);
          font-size: 8px;
          font-weight: 850;
        }

        .w1f2-product-copy > a {
          display: inline-flex;
          align-items: center;
          justify-content: space-between;
          gap: 22px;
          min-width: 205px;
          margin-top: 24px;
          padding: 13px 16px;
          border: 1px solid rgba(79, 138, 241, 0.45);
          border-radius: 13px;
          color: #eef5ff;
          background: rgba(24, 59, 125, 0.2);
          text-decoration: none;
          font-size: 10px;
          font-weight: 900;
        }

        .w1f2-product-screen-wrap {
          position: relative;
          min-width: 0;
        }

        .w1f2-product-screen-label {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          margin: 0 4px 9px;
          color: #6f87aa;
          font-size: 8px;
          font-weight: 850;
        }

        .w1f2-product-screen {
          overflow: hidden;
          margin: 0;
          aspect-ratio: 16 / 8.7;
          border: 1px solid rgba(92, 140, 220, 0.3);
          border-radius: 21px;
          background: #081426;
          box-shadow: 0 28px 72px rgba(0, 0, 0, 0.4);
        }

        .w1f2-product-screen img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .w1f2-product-proof {
          position: absolute;
          right: 18px;
          bottom: -14px;
          min-width: 164px;
          padding: 11px 13px;
          border: 1px solid rgba(88, 140, 233, 0.35);
          border-radius: 13px;
          background: rgba(6, 16, 34, 0.96);
          box-shadow: 0 16px 44px rgba(0, 0, 0, 0.34);
        }

        .w1f2-product-proof span {
          display: block;
          color: #72a1f6;
          font-size: 7px;
          font-weight: 950;
          letter-spacing: 0.11em;
        }

        .w1f2-product-proof strong {
          display: block;
          margin-top: 4px;
          color: #eaf2ff;
          font-size: 11px;
        }

        .w1f2-product-proof.green {
          border-color: rgba(69, 172, 121, 0.35);
        }

        .w1f2-product-proof.green span {
          color: #72d8a3;
        }

        .w1f2-product-proof.gold {
          border-color: rgba(181, 143, 52, 0.4);
          background: rgba(34, 27, 10, 0.96);
        }

        .w1f2-product-proof.gold span {
          color: #d6ad4d;
        }

        .w1f2-product-footer {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          gap: 22px;
          align-items: center;
          margin-top: 34px;
          padding-top: 18px;
          border-top: 1px solid rgba(91, 131, 196, 0.16);
        }

        .w1f2-product-footer > span {
          color: #5d87ce;
          font-size: 7px;
          font-weight: 950;
          letter-spacing: 0.12em;
        }

        .w1f2-product-footer > strong {
          color: #9fb0ca;
          font-size: 10px;
        }

        .w1f2-product-footer a {
          color: #92b5f2;
          text-decoration: none;
          font-size: 9px;
          font-weight: 900;
        }

        .w1f2-platform-section {
          padding: 54px clamp(28px, 4.2vw, 66px);
          border-top: 1px solid rgba(88, 129, 195, 0.17);
          border-bottom: 1px solid rgba(88, 129, 195, 0.17);
        }

        .w1f2-platform-heading {
          display: grid;
          grid-template-columns: minmax(0, 0.8fr) minmax(340px, 1.2fr);
          gap: 44px;
          align-items: end;
        }

        .w1f2-platform-heading > div > span {
          color: #608ee0;
          font-size: 9px;
          font-weight: 950;
          letter-spacing: 0.14em;
        }

        .w1f2-platform-heading h2 {
          margin: 12px 0 0;
          max-width: 600px;
          color: #f5f9ff;
          font-size: clamp(32px, 3.1vw, 48px);
          line-height: 1.04;
          letter-spacing: -0.045em;
        }

        .w1f2-platform-heading > p {
          margin: 0 0 4px;
          color: #8fa3c1;
          font-size: 12px;
          line-height: 1.55;
        }

        .w1f2-platform-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          margin-top: 28px;
        }

        .w1f2-platform-group {
          min-width: 0;
          padding: 18px;
          border: 1px solid rgba(84, 127, 194, 0.18);
          border-radius: 18px;
          background: rgba(5, 14, 29, 0.56);
        }

        .w1f2-platform-status {
          display: flex;
          gap: 10px;
          align-items: center;
          padding-bottom: 14px;
          border-bottom: 1px solid rgba(84, 127, 194, 0.14);
        }

        .w1f2-platform-status > i {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: #4ed39a;
          box-shadow: 0 0 0 7px rgba(78, 211, 154, 0.08);
        }

        .w1f2-platform-group.foundation .w1f2-platform-status > i {
          background: #4d85ee;
          box-shadow: 0 0 0 7px rgba(77, 133, 238, 0.08);
        }

        .w1f2-platform-group.roadmap .w1f2-platform-status > i {
          background: #d4a638;
          box-shadow: 0 0 0 7px rgba(212, 166, 56, 0.08);
        }

        .w1f2-platform-status span {
          display: block;
          color: #6f9bea;
          font-size: 7px;
          font-weight: 950;
          letter-spacing: 0.1em;
        }

        .w1f2-platform-status strong {
          display: block;
          margin-top: 3px;
          color: #dce6f6;
          font-size: 9px;
        }

        .w1f2-platform-items {
          display: grid;
          gap: 7px;
          margin-top: 12px;
        }

        .w1f2-platform-items > a,
        .w1f2-platform-items > div {
          position: relative;
          display: block;
          min-height: 68px;
          padding: 11px 12px;
          border: 1px solid rgba(82, 124, 190, 0.14);
          border-radius: 11px;
          color: inherit;
          background: rgba(8, 21, 43, 0.5);
          text-decoration: none;
        }

        .w1f2-platform-items strong {
          color: #e1eaf8;
          font-size: 10px;
        }

        .w1f2-platform-items span {
          display: block;
          margin-top: 5px;
          color: #6680a6;
          font-size: 7px;
        }

        .w1f2-platform-items > a > i {
          position: absolute;
          right: 11px;
          top: 12px;
          color: #6d98df;
          font-size: 8px;
          font-style: normal;
        }

        .w1f2-platform-items em {
          position: absolute;
          right: 10px;
          top: 10px;
          padding: 4px 7px;
          border: 1px solid rgba(193, 147, 40, 0.35);
          border-radius: 999px;
          color: #d9aa39;
          font-size: 6px;
          font-style: normal;
          font-weight: 950;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .w1f2-intelligence-section {
          padding: clamp(50px, 5vw, 72px);
          border: 1px solid rgba(96, 139, 211, 0.19);
          border-radius: 34px;
          background:
            radial-gradient(circle at 76% 32%, rgba(45, 101, 210, 0.14), transparent 30rem),
            linear-gradient(150deg, rgba(8, 18, 37, 0.985), rgba(4, 10, 22, 0.995));
          overflow: hidden;
        }

        .w1f2-intelligence-heading {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 28px;
          align-items: end;
          margin-top: 24px;
        }

        .w1f2-intelligence-heading h2 {
          margin: 0;
          max-width: 760px;
          color: #f8fbff;
          font-size: clamp(40px, 3.8vw, 60px);
          line-height: 1.02;
          letter-spacing: -0.05em;
        }

        .w1f2-intelligence-tabs {
          display: flex;
          gap: 7px;
          padding: 6px;
          border: 1px solid rgba(85, 128, 198, 0.18);
          border-radius: 13px;
          background: rgba(5, 14, 29, 0.68);
        }

        .w1f2-intelligence-tabs button {
          min-height: 42px;
          padding: 0 14px;
          border: 1px solid transparent;
          border-radius: 9px;
          color: #7187a9;
          background: transparent;
          cursor: pointer;
          font-family: inherit;
          font-size: 9px;
          font-weight: 900;
        }

        .w1f2-intelligence-tabs button.active {
          border-color: rgba(86, 143, 241, 0.45);
          color: #f0f6ff;
          background: rgba(28, 68, 139, 0.35);
        }

        .w1f2-intelligence-stage,
        .w1f2-control-stage {
          display: grid;
          grid-template-columns: minmax(320px, 0.78fr) minmax(0, 1.22fr);
          gap: clamp(38px, 5vw, 78px);
          align-items: center;
          margin-top: 34px;
        }

        .w1f2-intelligence-copy > span,
        .w1f2-control-copy > span {
          color: #6794df;
          font-size: 8px;
          font-weight: 950;
          letter-spacing: 0.12em;
        }

        .w1f2-intelligence-copy h3,
        .w1f2-control-copy h3 {
          margin: 13px 0 0;
          color: #f7faff;
          font-size: clamp(34px, 3vw, 49px);
          line-height: 1.04;
          letter-spacing: -0.045em;
        }

        .w1f2-intelligence-copy > p,
        .w1f2-control-copy > p {
          margin: 17px 0 0;
          color: #9fb1ca;
          font-size: 13px;
          line-height: 1.6;
        }

        .w1f2-process {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
          margin-top: 22px;
          color: #7f98bd;
          font-size: 9px;
          font-weight: 850;
        }

        .w1f2-process span {
          padding: 7px 9px;
          border: 1px solid rgba(82, 126, 194, 0.18);
          border-radius: 999px;
        }

        .w1f2-process i {
          color: #4e83df;
          font-style: normal;
        }

        .w1f2-ai-card {
          overflow: hidden;
          border: 1px solid rgba(91, 142, 232, 0.34);
          border-radius: 20px;
          background: #071326;
        }

        .w1f2-ai-top {
          display: flex;
          align-items: center;
          gap: 9px;
          min-height: 52px;
          padding: 0 17px;
          border-bottom: 1px solid rgba(88, 130, 198, 0.16);
          background: #0d1d39;
        }

        .w1f2-ai-top > i {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #4e88fb;
        }

        .w1f2-ai-top strong {
          color: #edf4ff;
          font-size: 10px;
        }

        .w1f2-ai-top span {
          margin-left: auto;
          color: #728aae;
          font-size: 8px;
        }

        .w1f2-ai-opinion {
          margin: 18px;
          padding: 20px;
          border: 1px solid rgba(87, 134, 216, 0.22);
          border-radius: 15px;
          background: rgba(12, 29, 59, 0.78);
        }

        .w1f2-ai-opinion > span,
        .w1f2-ai-actions > span {
          color: #6e9aeb;
          font-size: 7px;
          font-weight: 950;
          letter-spacing: 0.12em;
        }

        .w1f2-ai-opinion h3 {
          margin: 7px 0 0;
          color: #f6f9ff;
          font-size: 25px;
        }

        .w1f2-ai-opinion p {
          margin: 12px 0 0;
          color: #adbed7;
          font-size: 10px;
          line-height: 1.55;
        }

        .w1f2-ai-actions {
          margin: 0 18px 18px;
          padding: 16px;
          border: 1px solid rgba(85, 127, 195, 0.16);
          border-radius: 15px;
          background: rgba(7, 18, 38, 0.7);
        }

        .w1f2-ai-actions a {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          min-height: 37px;
          align-items: center;
          border-top: 1px solid rgba(84, 126, 190, 0.13);
          color: #dbe6f6;
          text-decoration: none;
          font-size: 9px;
        }

        .w1f2-ai-actions i {
          color: #6b96df;
          font-style: normal;
        }

        .w1f2-control-copy a {
          display: inline-flex;
          gap: 8px;
          margin-top: 18px;
          color: #8eb3f3;
          text-decoration: none;
          font-size: 9px;
          font-weight: 900;
        }

        .w1f2-control-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 9px;
        }

        .w1f2-control-grid > div {
          min-height: 145px;
          padding: 18px;
          border: 1px solid rgba(84, 126, 192, 0.16);
          border-radius: 14px;
          background: rgba(6, 16, 34, 0.57);
        }

        .w1f2-control-grid span {
          color: #4e82de;
          font-size: 8px;
          font-weight: 950;
        }

        .w1f2-control-grid strong {
          display: block;
          margin-top: 13px;
          color: #e6eefb;
          font-size: 12px;
        }

        .w1f2-control-grid p {
          margin: 8px 0 0;
          color: #768aa8;
          font-size: 9px;
          line-height: 1.5;
        }

        .w1f2-close-section {
          overflow: hidden;
          border: 1px solid rgba(86, 143, 247, 0.38);
          border-radius: 34px;
          background:
            radial-gradient(circle at 80% 20%, rgba(46, 113, 236, 0.22), transparent 32rem),
            linear-gradient(145deg, rgba(12, 30, 62, 0.98), rgba(5, 14, 30, 0.995));
        }

        .w1f2-founder-strip {
          display: grid;
          grid-template-columns: minmax(250px, 0.65fr) minmax(0, 1.05fr) auto;
          gap: 30px;
          align-items: center;
          padding: 26px clamp(28px, 4.5vw, 68px);
          border-bottom: 1px solid rgba(101, 148, 224, 0.16);
          background: rgba(5, 15, 32, 0.44);
        }

        .w1f2-founder-strip > div:first-child span {
          display: block;
          color: #668fd6;
          font-size: 7px;
          font-weight: 950;
          letter-spacing: 0.12em;
        }

        .w1f2-founder-strip > div:first-child strong {
          display: block;
          margin-top: 7px;
          color: #e8effb;
          font-size: 13px;
        }

        .w1f2-founder-strip > p {
          margin: 0;
          color: #91a5c2;
          font-size: 10px;
          line-height: 1.5;
        }

        .w1f2-founder-tags {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 6px;
        }

        .w1f2-founder-tags span {
          padding: 6px 8px;
          border: 1px solid rgba(82, 129, 213, 0.24);
          border-radius: 999px;
          color: #88a3d0;
          font-size: 7px;
          font-weight: 850;
        }

        .w1f2-final-cta {
          padding: clamp(52px, 6vw, 84px);
          text-align: center;
        }

        .w1f2-final-cta .w1f2-section-kicker {
          max-width: 1150px;
          margin: 0 auto;
        }

        .w1f2-final-cta h2 {
          max-width: 1050px;
          margin: 40px auto 0;
          color: #f8fbff;
          font-size: clamp(50px, 5.3vw, 84px);
          line-height: 0.96;
          letter-spacing: -0.062em;
        }

        .w1f2-final-cta > p {
          max-width: 720px;
          margin: 24px auto 0;
          color: #acbed8;
          font-size: 15px;
          line-height: 1.58;
        }

        .w1f2-final-actions {
          display: flex;
          justify-content: center;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 28px;
        }

        .w1f2-final-actions button,
        .w1f2-final-actions a {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          min-height: 50px;
          padding: 0 22px;
          border-radius: 13px;
          font-family: inherit;
          font-size: 10px;
          font-weight: 900;
          text-decoration: none;
        }

        .w1f2-final-actions button {
          border: 1px solid #5d99ff;
          color: white;
          background: linear-gradient(135deg, #3377ef, #285fd1);
          cursor: pointer;
        }

        .w1f2-final-actions a {
          border: 1px solid rgba(94, 142, 224, 0.35);
          color: #dce9ff;
          background: rgba(8, 21, 45, 0.56);
        }

        .w1f2-final-proof {
          display: flex;
          justify-content: center;
          flex-wrap: wrap;
          gap: 0;
          max-width: 950px;
          margin: 38px auto 0;
          border-top: 1px solid rgba(103, 151, 229, 0.18);
          border-bottom: 1px solid rgba(103, 151, 229, 0.18);
        }

        .w1f2-final-proof span {
          padding: 15px 22px;
          border-right: 1px solid rgba(103, 151, 229, 0.18);
          color: #b6c8e0;
          font-size: 9px;
          font-weight: 850;
        }

        .w1f2-final-proof span:last-child {
          border-right: 0;
        }

        #why-ventiq,
        #modules,
        #platform-breadth,
        #guided-demo,
        #all-workspaces,
        #security,
        #about,
        #contact {
          scroll-margin-top: 96px !important;
        }

        @media (max-width: 1240px) {
          .w1f2-site-header {
            grid-template-columns: 130px minmax(0, 1fr) auto;
            gap: 18px;
            padding-left: 24px;
            padding-right: 24px;
          }

          .w1f2-site-nav {
            gap: 18px;
          }

          .w1f2-site-nav a {
            font-size: 11px;
          }

          .w1f2-site-cta {
            padding: 0 16px;
            font-size: 11px;
          }
        }

        @media (max-width: 980px) {
          .w1f2-site-header {
            grid-template-columns: auto 1fr auto;
          }

          .w1f2-site-nav {
            overflow-x: auto;
            justify-content: flex-start;
            scrollbar-width: none;
          }

          .w1f2-site-nav::-webkit-scrollbar {
            display: none;
          }

          .w1f2-site-nav a:nth-last-child(-n + 2) {
            display: none;
          }

          .w1f2-product-heading,
          .w1f2-product-stage,
          .w1f2-platform-heading,
          .w1f2-intelligence-stage,
          .w1f2-control-stage,
          .w1f2-founder-strip {
            grid-template-columns: 1fr;
          }

          .w1f2-journey-tabs {
            overflow-x: auto;
            display: flex;
            scrollbar-width: none;
          }

          .w1f2-journey-tabs::-webkit-scrollbar {
            display: none;
          }

          .w1f2-journey-tabs button {
            min-width: 130px;
          }

          .w1f2-platform-grid {
            grid-template-columns: 1fr;
          }

          .w1f2-founder-tags {
            justify-content: flex-start;
          }
        }

        @media (max-width: 720px) {
          .w1f2-site-header {
            min-height: 68px;
            padding: 0 14px;
            grid-template-columns: auto 1fr;
          }

          .w1f2-site-brand {
            font-size: 24px;
          }

          .w1f2-site-nav {
            display: none;
          }

          .w1f2-site-cta {
            justify-self: end;
            min-height: 42px;
            font-size: 10px;
          }

          .w1f2-product-section,
          .w1f2-platform-section,
          .w1f2-intelligence-section,
          .w1f2-close-section {
            margin-left: 10px;
            margin-right: 10px;
            margin-bottom: 52px;
          }

          .w1f2-product-section,
          .w1f2-intelligence-section {
            padding: 36px 18px;
            border-radius: 24px;
          }

          .w1f2-platform-section {
            padding: 38px 18px;
          }

          .w1f2-section-kicker {
            align-items: flex-start;
            flex-direction: column;
            gap: 8px;
          }

          .w1f2-section-kicker > div {
            width: 100%;
            flex: none;
          }

          .w1f2-product-heading h2,
          .w1f2-intelligence-heading h2 {
            font-size: 40px;
          }

          .w1f2-product-screen {
            aspect-ratio: 16 / 10;
          }

          .w1f2-product-proof {
            position: relative;
            right: auto;
            bottom: auto;
            width: fit-content;
            margin: 8px 0 0 auto;
          }

          .w1f2-product-footer {
            grid-template-columns: 1fr;
            gap: 8px;
          }

          .w1f2-intelligence-heading {
            grid-template-columns: 1fr;
          }

          .w1f2-intelligence-tabs {
            width: 100%;
          }

          .w1f2-intelligence-tabs button {
            flex: 1;
          }

          .w1f2-control-grid {
            grid-template-columns: 1fr;
          }

          .w1f2-founder-strip {
            padding: 22px 18px;
          }

          .w1f2-final-cta {
            padding: 42px 18px;
          }

          .w1f2-final-cta h2 {
            font-size: 46px;
          }

          .w1f2-final-proof {
            display: grid;
            grid-template-columns: 1fr;
          }

          .w1f2-final-proof span {
            border-right: 0;
            border-bottom: 1px solid rgba(103, 151, 229, 0.18);
          }

          .w1f2-final-proof span:last-child {
            border-bottom: 0;
          }
        }


        /* =========================================================
           W1F.3 — VERTICAL RHYTHM + COPY MICRO-POLISH
           No new sections. Compress the existing public homepage.
        ========================================================= */

        /* Hero -> stakeholder story: remove the oversized pause. */
        .w1a-hero {
          padding-bottom: clamp(30px, 3vw, 44px) !important;
        }

        .w1b-section {
          margin-top: 34px !important;
          margin-bottom: 48px !important;
          padding-top: clamp(44px, 4.8vw, 68px) !important;
          padding-bottom: clamp(42px, 4.5vw, 64px) !important;
        }

        .w1b-heading-row {
          margin-top: 22px !important;
        }

        .w1b-role-tabs {
          margin-top: 30px !important;
        }

        .w1b-showcase {
          margin-top: 22px !important;
        }

        .w1b-role-story {
          padding-top: 22px !important;
          padding-bottom: 14px !important;
        }

        .w1b-role-label {
          margin-top: 20px !important;
        }

        .w1b-role-story h3 {
          margin-top: 16px !important;
        }

        .w1b-role-description {
          margin-top: 14px !important;
        }

        .w1b-proof-list {
          margin-top: 20px !important;
          gap: 9px !important;
        }

        .w1b-open-workspace {
          margin-top: 22px !important;
        }

        .w1b-layer-note {
          padding-top: 20px !important;
        }

        /* Operating-layer chapter remains substantial, but tighter. */
        .w1c-section {
          margin-bottom: 48px !important;
          padding-top: clamp(44px, 4.1vw, 62px) !important;
          padding-bottom: clamp(36px, 3.6vw, 52px) !important;
        }

        .w1c-heading-row {
          margin-top: 22px !important;
        }

        .w1c-flow-shell {
          margin-top: 30px !important;
        }

        .w1c-proof-strip {
          margin-top: 22px !important;
        }

        .w1c-proof-strip > div {
          min-height: 96px !important;
          padding: 16px 18px !important;
        }

        .w1c-proof-strip strong {
          margin-top: 8px !important;
        }

        .w1c-proof-strip p {
          margin-top: 6px !important;
          line-height: 1.42 !important;
        }

        /* Main lower chapters: consistent 48px cadence instead of 72px. */
        .w1f2-product-section,
        .w1f2-platform-section,
        .w1f2-intelligence-section {
          margin-bottom: 48px !important;
        }

        .w1f2-close-section {
          margin-bottom: 28px !important;
        }

        .w1f2-product-section {
          padding: clamp(44px, 4.5vw, 64px) !important;
        }

        .w1f2-product-heading {
          margin-top: 20px !important;
          gap: 44px !important;
        }

        .w1f2-journey-tabs {
          margin-top: 24px !important;
        }

        .w1f2-product-stage {
          margin-top: 28px !important;
        }

        .w1f2-product-footer {
          margin-top: 26px !important;
          padding-top: 14px !important;
        }

        /* Platform breadth should read in one visual beat. */
        .w1f2-platform-section {
          padding-top: 44px !important;
          padding-bottom: 44px !important;
        }

        .w1f2-platform-grid {
          margin-top: 22px !important;
        }

        .w1f2-platform-group {
          padding: 16px !important;
        }

        .w1f2-platform-items > a,
        .w1f2-platform-items > div {
          min-height: 62px !important;
          padding-top: 10px !important;
          padding-bottom: 10px !important;
        }

        /* Intelligence + control: preserve the interaction, remove empty air. */
        .w1f2-intelligence-section {
          padding: clamp(44px, 4.4vw, 64px) !important;
        }

        .w1f2-intelligence-heading {
          margin-top: 20px !important;
        }

        .w1f2-intelligence-stage,
        .w1f2-control-stage {
          margin-top: 28px !important;
        }

        /* Founder + conversion: compact but still a deliberate closing chapter. */
        .w1f2-founder-strip {
          padding-top: 20px !important;
          padding-bottom: 20px !important;
        }

        .w1f2-final-cta {
          padding-top: clamp(44px, 4.8vw, 68px) !important;
          padding-bottom: clamp(40px, 4.4vw, 62px) !important;
        }

        .w1f2-final-cta h2 {
          margin-top: 30px !important;
        }

        .w1f2-final-cta > p {
          margin-top: 18px !important;
        }

        .w1f2-final-actions {
          margin-top: 22px !important;
        }

        .w1f2-final-proof {
          margin-top: 28px !important;
        }

        /* Footer: remove the large empty final screen. */
        .w1e-footer {
          margin-top: 0 !important;
          padding-top: 24px !important;
          padding-bottom: 14px !important;
          column-gap: 44px !important;
          row-gap: 22px !important;
        }

        .w1e-footer-brand p {
          margin-top: 8px !important;
        }

        .w1e-footer-nav {
          gap: 22px !important;
        }

        .w1e-footer-nav > div {
          gap: 6px !important;
        }

        .w1e-footer-nav span {
          margin-bottom: 2px !important;
        }

        .w1e-footer-bottom {
          padding-top: 14px !important;
        }

        @media (max-width: 1120px) {
          .w1b-section {
            margin-top: 28px !important;
            margin-bottom: 42px !important;
          }

          .w1c-section,
          .w1f2-product-section,
          .w1f2-platform-section,
          .w1f2-intelligence-section {
            margin-bottom: 42px !important;
          }
        }

        @media (max-width: 720px) {
          .w1a-hero {
            padding-bottom: 24px !important;
          }

          .w1b-section {
            margin: 24px 10px 38px !important;
            padding: 34px 18px !important;
          }

          .w1c-section {
            margin-bottom: 38px !important;
            padding: 34px 18px !important;
          }

          .w1c-proof-strip > div {
            min-height: auto !important;
          }

          .w1f2-product-section,
          .w1f2-platform-section,
          .w1f2-intelligence-section {
            margin-bottom: 38px !important;
          }

          .w1f2-close-section {
            margin-bottom: 20px !important;
          }

          .w1f2-platform-section {
            padding-top: 34px !important;
            padding-bottom: 34px !important;
          }

          .w1e-footer {
            margin-left: 10px !important;
            margin-right: 10px !important;
            padding-top: 20px !important;
            row-gap: 18px !important;
          }
        }


        /* =========================================================
           W1F6 — FINAL PUBLIC RELEASE POLISH
           Mobile navigation, accessibility and reduced-motion support.
        ========================================================= */

        .w1f2-menu-toggle,
        .w1f2-mobile-menu,
        .w1f2-mobile-backdrop {
          display: none;
        }

        .w1f2-site-nav a,
        .w1f2-site-cta,
        .w1f2-menu-toggle,
        .w1b-role-tab,
        .w1f2-journey-tabs button,
        .w1f2-intelligence-tabs button,
        .w1f2-platform-items a {
          transition:
            color 160ms ease,
            border-color 160ms ease,
            background 160ms ease,
            transform 160ms ease,
            box-shadow 160ms ease;
        }

        .w1f2-site-cta:hover,
        .w1f2-mobile-menu > button:hover {
          transform: translateY(-1px);
          box-shadow: 0 16px 38px rgba(42, 104, 223, 0.28);
        }

        .w1f2-site-nav a:focus-visible,
        .w1f2-site-cta:focus-visible,
        .w1f2-menu-toggle:focus-visible,
        .w1f2-mobile-menu a:focus-visible,
        .w1f2-mobile-menu button:focus-visible,
        .w1b-role-tab:focus-visible,
        .w1f2-journey-tabs button:focus-visible,
        .w1f2-intelligence-tabs button:focus-visible,
        .w1b-open-workspace:focus-visible,
        .w1f2-product-copy a:focus-visible,
        .w1f2-platform-items a:focus-visible {
          outline: 3px solid rgba(101, 159, 255, 0.7);
          outline-offset: 3px;
        }

        @media (max-width: 720px) {
          .w1f2-site-header {
            grid-template-columns: auto 1fr auto auto !important;
            gap: 8px !important;
          }

          .w1f2-site-cta {
            margin-right: 2px;
          }

          .w1f2-menu-toggle {
            display: inline-grid;
            place-items: center;
            width: 42px;
            height: 42px;
            padding: 10px;
            border: 1px solid rgba(104, 155, 228, 0.34);
            border-radius: 13px;
            background: rgba(8, 22, 43, 0.92);
            cursor: pointer;
          }

          .w1f2-menu-toggle span {
            display: block;
            width: 18px;
            height: 2px;
            border-radius: 999px;
            background: #edf5ff;
          }

          .w1f2-mobile-backdrop {
            position: fixed;
            inset: 68px 0 0;
            z-index: 398;
            display: block;
            border: 0;
            background: rgba(1, 6, 15, 0.72);
            backdrop-filter: blur(5px);
            -webkit-backdrop-filter: blur(5px);
            cursor: default;
          }

          .w1f2-mobile-menu {
            position: fixed;
            top: 78px;
            left: 12px;
            right: 12px;
            z-index: 399;
            display: grid;
            gap: 3px;
            max-height: calc(100vh - 94px);
            overflow-y: auto;
            padding: 12px;
            border: 1px solid rgba(101, 159, 255, 0.28);
            border-radius: 22px;
            background:
              radial-gradient(circle at 92% 4%, rgba(45, 112, 235, 0.18), transparent 34%),
              rgba(4, 14, 30, 0.985);
            box-shadow: 0 30px 80px rgba(0, 0, 0, 0.46);
          }

          .w1f2-mobile-menu > a {
            display: flex;
            align-items: center;
            min-height: 48px;
            padding: 0 13px;
            border-radius: 12px;
            color: #dce8f8;
            text-decoration: none;
            font-size: 14px;
            font-weight: 820;
          }

          .w1f2-mobile-menu > a:hover {
            color: #ffffff;
            background: rgba(46, 105, 206, 0.14);
          }

          .w1f2-mobile-menu > button {
            display: flex;
            align-items: center;
            justify-content: space-between;
            min-height: 52px;
            margin-top: 6px;
            padding: 0 16px;
            border: 1px solid #659fff;
            border-radius: 14px;
            color: #ffffff;
            background: linear-gradient(135deg, #3477ef, #2861d5);
            cursor: pointer;
            font: inherit;
            font-size: 13px;
            font-weight: 900;
          }
        }

        @media (max-width: 520px) {
          .w1f2-site-header {
            grid-template-columns: auto 1fr auto !important;
          }

          .w1f2-site-cta {
            display: none;
          }

          .w1f2-site-brand {
            font-size: 23px !important;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          *,
          *::before,
          *::after {
            scroll-behavior: auto !important;
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }


        /* =========================================================
           W1F6.1 — READABILITY BALANCE
           Restore comfortable reading size without restoring long-scroll bloat.
        ========================================================= */

        /* ---------- Hero product proof: show the product, don't crop it ---------- */
        @media (min-width: 821px) {
          .w1a-hero-visual {
            min-height: 600px;
          }

          .w1a-stage-screens,
          .w1a-screen-main {
            height: 455px;
          }
        }

        .w1a-stage-topline {
          font-size: 14px;
        }

        .w1a-preview-switcher button {
          min-height: 46px;
          font-size: 13px;
        }

        .w1a-screen-card figcaption {
          min-height: 54px;
          padding-left: 18px;
          padding-right: 18px;
        }

        .w1a-screen-card figcaption span {
          font-size: 11px;
        }

        .w1a-screen-card figcaption strong {
          font-size: 13px;
        }

        .w1a-screen-crop {
          height: calc(100% - 54px);
          display: grid;
          place-items: center;
          background:
            radial-gradient(circle at 50% 35%, rgba(35, 83, 169, 0.12), transparent 58%),
            #050d1b;
        }

        .w1a-screen-crop img {
          width: 100%;
          height: 100%;
          object-fit: contain !important;
          object-position: center center !important;
        }

        .w1a-proof-badge span {
          font-size: 11px;
        }

        .w1a-proof-badge strong {
          font-size: 13px;
        }

        /* ---------- Product Journey: full screenshots + readable controls ---------- */
        .w1f2-journey-tabs button {
          min-height: 68px;
          padding: 12px 14px;
        }

        .w1f2-journey-tabs button span {
          font-size: 10px;
        }

        .w1f2-journey-tabs button strong {
          font-size: 13px;
        }

        .w1f2-product-copy > span {
          font-size: 11px;
        }

        .w1f2-product-copy > p {
          color: #b8c7db;
          font-size: 15px;
          line-height: 1.65;
        }

        .w1f2-product-chips span {
          padding: 9px 11px;
          color: #a9bee0;
          font-size: 11px;
        }

        .w1f2-product-copy > a {
          min-height: 48px;
          font-size: 13px;
        }

        .w1f2-product-screen-label {
          color: #91a6c3;
          font-size: 11px;
        }

        .w1f2-product-screen {
          aspect-ratio: 16 / 9;
          display: grid;
          place-items: center;
          background:
            radial-gradient(circle at 50% 30%, rgba(41, 88, 172, 0.12), transparent 58%),
            #06101f;
        }

        .w1f2-product-screen img {
          width: 100%;
          height: 100%;
          object-fit: contain !important;
          object-position: center center !important;
        }

        .w1f2-product-proof {
          min-width: 180px;
          padding: 13px 15px;
        }

        .w1f2-product-proof span {
          font-size: 9px;
        }

        .w1f2-product-proof strong {
          font-size: 13px;
        }

        /* ---------- Platform breadth: no micro-text ---------- */
        .w1f2-platform-heading > p {
          color: #b7c7dd;
          font-size: 15px;
          line-height: 1.6;
        }

        .w1f2-platform-group {
          padding: 20px !important;
        }

        .w1f2-platform-status {
          padding-bottom: 17px;
        }

        .w1f2-platform-status span {
          color: #80a9ee;
          font-size: 10px;
          letter-spacing: 0.11em;
        }

        .w1f2-platform-status strong {
          margin-top: 5px;
          color: #dbe6f5;
          font-size: 13px;
        }

        .w1f2-platform-items {
          gap: 10px;
        }

        .w1f2-platform-items > a,
        .w1f2-platform-items > div {
          min-height: 82px !important;
          padding: 15px 16px !important;
          border-color: rgba(95, 141, 211, 0.22);
          background: rgba(8, 21, 43, 0.64);
        }

        .w1f2-platform-items strong {
          font-size: 14px !important;
        }

        .w1f2-platform-items span {
          margin-top: 7px;
          color: #90a7c8;
          font-size: 11px !important;
          line-height: 1.45;
        }

        .w1f2-platform-items > a > i {
          top: 15px;
          right: 15px;
          font-size: 12px;
        }

        .w1f2-roadmap-pill {
          font-size: 9px;
          padding: 6px 9px;
        }

        /* ---------- AI / control supporting copy: improve dark-theme contrast ---------- */
        .w1f2-intelligence-copy > span,
        .w1f2-control-copy > span {
          font-size: 10px;
        }

        .w1f2-intelligence-copy > p,
        .w1f2-control-copy > p {
          color: #b2c3d9;
          font-size: 15px;
          line-height: 1.65;
        }

        .w1f2-ai-process span {
          color: #9db4d4;
          font-size: 11px;
        }

        .w1f2-intelligence-tabs button {
          min-height: 48px;
          font-size: 12px;
        }

        /* ---------- Founder: restore it as a real section ---------- */
        .w1f2-founder-strip {
          grid-template-columns: minmax(290px, 0.78fr) minmax(0, 1.35fr);
          grid-template-areas:
            "founder-title founder-body"
            "founder-tags founder-tags";
          gap: 26px 56px;
          min-height: 220px;
          padding: 42px clamp(34px, 5vw, 78px) !important;
          align-items: start;
          background:
            radial-gradient(circle at 86% 20%, rgba(49, 103, 214, 0.14), transparent 30rem),
            rgba(5, 15, 32, 0.58);
        }

        .w1f2-founder-strip > div:first-child {
          grid-area: founder-title;
        }

        .w1f2-founder-strip > div:first-child span {
          color: #7da9f3;
          font-size: 10px;
          letter-spacing: 0.14em;
        }

        .w1f2-founder-strip > div:first-child strong {
          max-width: 390px;
          margin-top: 12px;
          color: #f0f5fd;
          font-size: clamp(22px, 1.7vw, 28px);
          line-height: 1.18;
          letter-spacing: -0.025em;
        }

        .w1f2-founder-strip > p {
          grid-area: founder-body;
          max-width: 760px;
          color: #b8c8dc;
          font-size: 16px;
          line-height: 1.72;
        }

        .w1f2-founder-tags {
          grid-area: founder-tags;
          justify-content: flex-start;
          gap: 9px;
          padding-top: 4px;
        }

        .w1f2-founder-tags span {
          padding: 8px 12px;
          border-color: rgba(89, 139, 224, 0.32);
          color: #abc2e6;
          background: rgba(18, 42, 82, 0.22);
          font-size: 11px;
        }

        /* ---------- Footer: compact, but readable ---------- */
        .w1e-footer {
          padding-top: 38px !important;
          padding-bottom: 24px !important;
          row-gap: 28px !important;
        }

        .w1e-footer-brand > a {
          font-size: 30px;
        }

        .w1e-footer-brand p {
          margin-top: 10px !important;
          color: #9db0cb;
          font-size: 13px;
          line-height: 1.55;
        }

        .w1e-footer-nav {
          gap: 34px !important;
        }

        .w1e-footer-nav > div {
          gap: 9px !important;
        }

        .w1e-footer-nav span {
          margin-bottom: 4px !important;
          color: #7298d7;
          font-size: 9px;
          letter-spacing: 0.14em;
        }

        .w1e-footer-nav a {
          color: #a9bad2;
          font-size: 12px;
          line-height: 1.45;
        }

        .w1e-footer-bottom {
          padding-top: 20px !important;
          color: #738aa9;
          font-size: 10px;
        }

        .w1e-footer-bottom strong {
          color: #8ea5c5;
          font-size: 10px;
        }

        /* ---------- Tablet / mobile ---------- */
        @media (max-width: 980px) {
          .w1f2-founder-strip {
            grid-template-columns: 1fr;
            grid-template-areas:
              "founder-title"
              "founder-body"
              "founder-tags";
            min-height: auto;
            gap: 20px;
          }

          .w1f2-founder-strip > p {
            max-width: 800px;
          }
        }

        @media (max-width: 820px) {
          .w1a-stage-screens,
          .w1a-screen-main {
            height: 330px;
          }

          .w1a-screen-crop {
            height: calc(100% - 48px);
          }

          .w1f2-platform-items > a,
          .w1f2-platform-items > div {
            min-height: 76px !important;
          }
        }

        @media (max-width: 720px) {
          .w1f2-founder-strip {
            padding: 34px 22px !important;
          }

          .w1f2-founder-strip > div:first-child strong {
            font-size: 24px;
          }

          .w1f2-founder-strip > p {
            font-size: 15px;
          }

          .w1e-footer-brand p,
          .w1e-footer-nav a {
            font-size: 13px;
          }

          .w1e-footer-nav span {
            font-size: 10px;
          }

          .w1e-footer-bottom,
          .w1e-footer-bottom strong {
            font-size: 11px;
          }
        }

        @media (max-width: 520px) {
          .w1a-stage-screens,
          .w1a-screen-main {
            height: 285px;
          }

          .w1a-screen-crop {
            height: calc(100% - 44px);
          }

          .w1a-screen-card figcaption {
            min-height: 44px;
          }

          .w1f2-product-screen {
            aspect-ratio: 16 / 10;
          }
        }


        /* =========================================================
           W1G1.1 — RESTORE PRODUCT PROOF + READABLE ORIGINAL ARCHITECTURE
        ========================================================= */

        /* ---------------------------------------------------------
           HERO PRODUCT SCREENSHOT
           The source screenshot is ~2.66:1. The full card including
           caption is ~2.25:1, so preserve that ratio instead of
           collapsing or letterboxing the product image.
        --------------------------------------------------------- */
        .w1a-hero-visual {
          min-height: 545px !important;
        }

        .w1a-stage-screens {
          position: relative !important;
          width: 100%;
          height: auto !important;
          aspect-ratio: 2.25 / 1;
          z-index: 2;
        }

        .w1a-screen-main {
          position: absolute !important;
          inset: 0 !important;
          width: 100% !important;
          height: 100% !important;
        }

        .w1a-screen-card figcaption {
          min-height: 56px !important;
          padding: 0 18px !important;
        }

        .w1a-screen-crop {
          position: relative !important;
          width: 100% !important;
          height: calc(100% - 56px) !important;
          aspect-ratio: auto !important;
          overflow: hidden !important;
          background: #06101f !important;
        }

        .w1a-screen-crop img {
          display: block !important;
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          object-position: top center !important;
        }

        /* ---------------------------------------------------------
           ORIGINAL OPERATING LAYER — KEEP THE LAYOUT, FIX THE TYPE
        --------------------------------------------------------- */
        .w1c-kicker {
          font-size: 11px !important;
        }

        .w1c-zone {
          padding: 28px !important;
        }

        .w1c-zone-head > span {
          color: #75a4ef !important;
          font-size: 10px !important;
        }

        .w1c-zone-head > strong {
          margin-top: 11px !important;
          font-size: 22px !important;
          line-height: 1.18 !important;
        }

        .w1c-zone-head > p {
          margin-top: 11px !important;
          color: #a9bad2 !important;
          font-size: 13px !important;
          line-height: 1.58 !important;
        }

        .w1c-input-list,
        .w1c-output-list {
          gap: 11px !important;
          margin-top: 24px !important;
        }

        .w1c-source-node {
          min-height: 82px;
          padding: 16px 17px !important;
          border-color: rgba(86, 130, 200, 0.2) !important;
          background: rgba(9, 23, 47, 0.66) !important;
        }

        .w1c-source-node > span {
          color: #7799c9 !important;
          font-size: 9px !important;
        }

        .w1c-source-node > strong {
          margin-top: 7px !important;
          font-size: 14px !important;
        }

        .w1c-source-node > small {
          margin-top: 6px !important;
          color: #8da2c0 !important;
          font-size: 11px !important;
          line-height: 1.42 !important;
        }

        .w1c-flow-caption {
          color: #8ba1bf !important;
          font-size: 11px !important;
        }

        .w1c-core-card {
          padding: 30px !important;
        }

        .w1c-core-topline > span {
          font-size: 10px !important;
        }

        .w1c-core-topline > strong {
          padding: 8px 12px !important;
          font-size: 9px !important;
        }

        .w1c-core-brand {
          padding: 30px 4px 24px !important;
        }

        .w1c-core-brand > span {
          font-size: clamp(44px, 4.2vw, 64px) !important;
        }

        .w1c-core-brand > strong {
          margin-top: 8px !important;
          font-size: 16px !important;
        }

        .w1c-core-grid {
          gap: 10px !important;
          margin-top: 15px !important;
        }

        .w1c-core-grid > div {
          min-height: 78px;
          padding: 15px 16px !important;
          border-color: rgba(89, 135, 207, 0.22) !important;
          background: rgba(7, 20, 42, 0.72) !important;
        }

        .w1c-core-grid span {
          color: #7199d6 !important;
          font-size: 9px !important;
        }

        .w1c-core-grid strong {
          margin-top: 7px !important;
          font-size: 14px !important;
        }

        .w1c-core-footer span {
          color: #6f9de7 !important;
          font-size: 9px !important;
        }

        .w1c-core-footer strong {
          margin-top: 7px !important;
          color: #b4c5dd !important;
          font-size: 11px !important;
        }

        .w1c-output-list a {
          grid-template-columns: 34px minmax(0, 1fr) auto !important;
          min-height: 70px !important;
          padding: 12px 14px !important;
          border-color: rgba(88, 132, 202, 0.21) !important;
          background: rgba(9, 23, 47, 0.66) !important;
        }

        .w1c-output-list a > span {
          width: 30px !important;
          height: 30px !important;
          font-size: 9px !important;
        }

        .w1c-output-list a div strong {
          font-size: 13px !important;
        }

        .w1c-output-list a div small {
          margin-top: 5px !important;
          color: #8ba0be !important;
          font-size: 10px !important;
          line-height: 1.4 !important;
        }

        .w1c-output-list a > i {
          font-size: 13px !important;
        }

        .w1c-proof-strip > div {
          min-height: 116px !important;
          padding: 20px !important;
        }

        .w1c-proof-strip span {
          font-size: 10px !important;
        }

        .w1c-proof-strip strong {
          margin-top: 10px !important;
          font-size: 14px !important;
        }

        .w1c-proof-strip p {
          margin-top: 7px !important;
          color: #91a5c2 !important;
          font-size: 11px !important;
          line-height: 1.5 !important;
        }

        /* ---------------------------------------------------------
           PROPER STANDALONE FOUNDER SECTION
        --------------------------------------------------------- */
        .w1g-about-section {
          margin-bottom: 56px !important;
          padding: clamp(54px, 5.4vw, 84px) clamp(24px, 4.5vw, 70px) !important;
          overflow: hidden;
          border: 1px solid rgba(91, 139, 220, 0.22);
          border-radius: 32px;
          background:
            radial-gradient(circle at 85% 28%, rgba(48, 109, 222, 0.13), transparent 28rem),
            rgba(5, 15, 31, 0.54);
        }

        .w1g-about-section .w1e-about-copy > span {
          color: #76a5ef;
          font-size: 11px;
          font-weight: 950;
          letter-spacing: 0.13em;
        }

        .w1g-about-section .w1e-about-copy h2 {
          font-size: clamp(48px, 4.6vw, 72px);
          line-height: 0.99;
        }

        .w1g-about-section .w1e-about-copy > p {
          max-width: 820px;
          color: #b4c4d9;
          font-size: 16px;
          line-height: 1.72;
        }

        .w1g-about-section .w1e-about-chips span {
          padding: 10px 13px;
          color: #aac0e1;
          font-size: 11px;
        }

        .w1g-founder-card {
          padding: 34px;
          border-color: rgba(93, 149, 244, 0.46);
          background:
            radial-gradient(circle at 88% 5%, rgba(61, 128, 245, 0.22), transparent 18rem),
            linear-gradient(150deg, rgba(12, 34, 72, 0.95), rgba(5, 16, 34, 0.96));
          box-shadow:
            0 34px 86px rgba(0,0,0,0.3),
            0 0 65px rgba(42, 104, 223, 0.07);
        }

        .w1g-founder-card h3 {
          font-size: 36px;
        }

        .w1g-founder-card > p {
          color: #b5c6dd;
          font-size: 15px;
          line-height: 1.67;
        }

        .w1g-founder-card .w1e-founder-proof > div {
          min-height: 92px;
          padding: 15px;
        }

        .w1g-founder-card .w1e-founder-proof span {
          font-size: 9px;
        }

        .w1g-founder-card .w1e-founder-proof strong {
          margin-top: 9px;
          font-size: 12px;
        }

        .w1g-founder-card > button {
          min-height: 52px;
          font-size: 13px;
        }

        /* ---------------------------------------------------------
           SEPARATE FINAL CONVERSION SECTION
        --------------------------------------------------------- */
        .w1g-final-section {
          margin-bottom: 38px !important;
          padding: clamp(62px, 6.5vw, 96px) !important;
          background:
            radial-gradient(circle at 82% 22%, rgba(48, 115, 243, 0.28), transparent 31rem),
            radial-gradient(circle at 12% 90%, rgba(37, 85, 175, 0.12), transparent 30rem),
            linear-gradient(145deg, rgba(14, 35, 74, 0.99), rgba(4, 14, 31, 0.995));
        }

        .w1g-final-section .w1e-final-kicker {
          font-size: 11px;
        }

        .w1g-final-section .w1e-final-content {
          margin-top: 54px;
        }

        .w1g-final-section .w1e-final-content h2 {
          font-size: clamp(58px, 5.8vw, 94px);
        }

        .w1g-final-section .w1e-final-content > p {
          color: #b8c9df;
          font-size: 17px;
        }

        .w1g-final-section .w1e-final-proof strong {
          font-size: 12px;
        }

        @media (max-width: 980px) {
          .w1a-stage-screens {
            aspect-ratio: 2.05 / 1;
          }
        }

        @media (max-width: 720px) {
          .w1a-stage-screens {
            aspect-ratio: 1.55 / 1;
          }

          .w1a-screen-card figcaption {
            min-height: 48px !important;
          }

          .w1a-screen-crop {
            height: calc(100% - 48px) !important;
          }

          .w1g-about-section {
            margin-left: 10px !important;
            margin-right: 10px !important;
            padding: 40px 22px !important;
          }

          .w1g-about-section .w1e-about-copy h2 {
            font-size: 43px;
          }

          .w1g-founder-card {
            padding: 26px;
          }

          .w1g-final-section {
            padding: 46px 22px !important;
          }
        }


        /* =========================================================
           W1G2 — PREMIUM VISUAL POLISH
           Structure locked. This pass changes only visual treatment.
        ========================================================= */

        @keyframes w1g2-rise {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes w1g2-glow-drift {
          0% {
            transform: translate3d(-2%, 0, 0) scale(0.98);
            opacity: 0.42;
          }
          100% {
            transform: translate3d(4%, -2%, 0) scale(1.05);
            opacity: 0.68;
          }
        }

        @keyframes w1g2-gradient-shift {
          0% {
            background-position: 0% 50%;
          }
          100% {
            background-position: 100% 50%;
          }
        }

        /* ---------- Header: premium glass, clearer navigation ---------- */
        .w1f2-site-header {
          isolation: isolate;
          border-bottom-color: rgba(105, 151, 226, 0.2) !important;
          background:
            linear-gradient(180deg, rgba(4, 12, 26, 0.96), rgba(3, 10, 22, 0.92)) !important;
          box-shadow:
            0 12px 36px rgba(0, 0, 0, 0.22),
            inset 0 -1px 0 rgba(255, 255, 255, 0.018);
        }

        .w1f2-site-header::after {
          content: "";
          position: absolute;
          left: clamp(24px, 4vw, 70px);
          right: clamp(24px, 4vw, 70px);
          bottom: -1px;
          height: 1px;
          z-index: -1;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(76, 133, 238, 0.38) 22%,
            rgba(111, 165, 255, 0.18) 50%,
            rgba(76, 133, 238, 0.38) 78%,
            transparent
          );
        }

        .w1f2-site-brand {
          background: linear-gradient(110deg, #ffffff 15%, #dbe8ff 56%, #8fb8ff 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          text-shadow: 0 0 42px rgba(90, 144, 255, 0.08);
        }

        .w1f2-site-nav a {
          position: relative;
          padding: 10px 0;
        }

        .w1f2-site-nav a::after {
          content: "";
          position: absolute;
          left: 50%;
          right: 50%;
          bottom: 3px;
          height: 2px;
          border-radius: 999px;
          background: linear-gradient(90deg, #4d89f8, #83afff);
          transition: left 170ms ease, right 170ms ease, opacity 170ms ease;
          opacity: 0;
        }

        .w1f2-site-nav a:hover::after {
          left: 0;
          right: 0;
          opacity: 1;
        }

        .w1f2-site-cta {
          position: relative;
          overflow: hidden;
          border-color: rgba(117, 171, 255, 0.72) !important;
          background:
            linear-gradient(135deg, #3b80f5 0%, #2863dc 58%, #2257c9 100%) !important;
          box-shadow:
            0 14px 38px rgba(38, 103, 226, 0.24),
            inset 0 1px 0 rgba(255, 255, 255, 0.24) !important;
        }

        .w1f2-site-cta::before,
        .w1a-primary-cta::before,
        .w1e-final-actions button::before {
          content: "";
          position: absolute;
          top: -70%;
          left: -35%;
          width: 24%;
          height: 240%;
          transform: rotate(24deg);
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.22),
            transparent
          );
          transition: left 420ms ease;
          pointer-events: none;
        }

        .w1f2-site-cta:hover::before,
        .w1a-primary-cta:hover::before,
        .w1e-final-actions button:hover::before {
          left: 116%;
        }

        /* ---------- Hero: stronger first impression without extra content ---------- */
        .w1a-hero {
          overflow: visible;
        }

        .w1a-hero::after {
          content: "";
          position: absolute;
          inset: 5% 2% 4%;
          z-index: -2;
          pointer-events: none;
          background-image:
            linear-gradient(rgba(86, 131, 214, 0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(86, 131, 214, 0.025) 1px, transparent 1px);
          background-size: 72px 72px;
          mask-image: radial-gradient(circle at 58% 42%, black, transparent 72%);
        }

        .w1a-hero-copy {
          animation: w1g2-rise 620ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        .w1a-product-stage {
          animation: w1g2-rise 720ms 90ms cubic-bezier(0.22, 1, 0.36, 1) both;
          transition:
            transform 240ms ease,
            box-shadow 240ms ease,
            border-color 240ms ease;
        }

        .w1a-product-stage:hover {
          transform: translateY(-4px);
          border-color: rgba(117, 166, 255, 0.34);
          box-shadow:
            0 44px 110px rgba(0, 0, 0, 0.45),
            0 0 90px rgba(48, 105, 222, 0.12),
            inset 0 1px 0 rgba(255, 255, 255, 0.055);
        }

        .w1a-stage-glow-one {
          animation: w1g2-glow-drift 9s ease-in-out infinite alternate;
        }

        .w1a-stage-glow-two {
          animation: w1g2-glow-drift 11s 800ms ease-in-out infinite alternate-reverse;
        }

        .w1a-eyebrow {
          padding: 9px 12px 9px 10px;
          margin-left: -10px;
          border: 1px solid rgba(96, 145, 234, 0.14);
          border-radius: 999px;
          background: rgba(9, 24, 51, 0.28);
          backdrop-filter: blur(8px);
        }

        .w1a-gradient-text {
          background-size: 180% 180% !important;
          animation: w1g2-gradient-shift 6.5s ease-in-out infinite alternate;
        }

        .w1a-primary-cta {
          position: relative;
          overflow: hidden;
          border-color: rgba(105, 156, 255, 0.78);
          background:
            linear-gradient(135deg, #377bf2 0%, #285fd8 58%, #2154c4 100%);
          box-shadow:
            0 19px 50px rgba(27, 86, 220, 0.31),
            inset 0 1px 0 rgba(255, 255, 255, 0.22);
        }

        .w1a-secondary-cta {
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035);
        }

        .w1a-preview-switcher button.active {
          border-color: rgba(102, 156, 255, 0.62) !important;
          background:
            radial-gradient(circle at 50% 0%, rgba(73, 132, 245, 0.24), transparent 80%),
            linear-gradient(180deg, rgba(42, 89, 185, 0.48), rgba(14, 36, 77, 0.72)) !important;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.08),
            0 8px 26px rgba(32, 82, 177, 0.13) !important;
        }

        .w1a-screen-card {
          border-color: rgba(92, 142, 225, 0.3) !important;
          box-shadow:
            0 18px 46px rgba(0, 0, 0, 0.2),
            inset 0 1px 0 rgba(255, 255, 255, 0.025);
        }

        /* ---------- Signature stakeholder section ---------- */
        .w1b-section {
          border-color: rgba(91, 143, 228, 0.28) !important;
          background:
            radial-gradient(circle at 74% 22%, rgba(42, 99, 211, 0.15), transparent 29rem),
            radial-gradient(circle at 22% 84%, rgba(25, 62, 132, 0.1), transparent 28rem),
            linear-gradient(145deg, rgba(9, 24, 51, 0.96), rgba(4, 13, 29, 0.985)) !important;
        }

        .w1b-role-tabs {
          border-color: rgba(92, 139, 216, 0.22) !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.025);
        }

        .w1b-role-tab:hover {
          color: #e7f0ff;
          background: rgba(29, 68, 137, 0.14);
        }

        .w1b-role-tab.active {
          border-color: rgba(95, 155, 255, 0.72) !important;
          background:
            radial-gradient(circle at 50% 0%, rgba(63, 126, 240, 0.25), transparent 78%),
            linear-gradient(155deg, rgba(31, 74, 153, 0.62), rgba(14, 37, 78, 0.72)) !important;
          box-shadow:
            0 9px 30px rgba(33, 91, 193, 0.16),
            inset 0 1px 0 rgba(255,255,255,0.07);
        }

        .w1b-showcase {
          border-color: rgba(89, 140, 224, 0.28) !important;
          box-shadow:
            0 28px 76px rgba(0, 0, 0, 0.2),
            inset 0 1px 0 rgba(255, 255, 255, 0.025);
        }

        .w1b-open-workspace {
          transition:
            transform 170ms ease,
            border-color 170ms ease,
            background 170ms ease,
            box-shadow 170ms ease;
        }

        .w1b-open-workspace:hover {
          transform: translateY(-2px);
          border-color: rgba(90, 151, 255, 0.64);
          background: rgba(27, 66, 139, 0.28);
          box-shadow: 0 12px 34px rgba(25, 72, 161, 0.13);
        }

        /* ---------- Original Operating Layer: emphasize the governed core ---------- */
        .w1c-section {
          border-color: rgba(88, 140, 226, 0.26) !important;
          background:
            radial-gradient(circle at 50% 48%, rgba(42, 102, 217, 0.12), transparent 30rem),
            linear-gradient(145deg, rgba(8, 22, 47, 0.95), rgba(3, 12, 27, 0.99)) !important;
        }

        .w1c-core-card {
          border-color: rgba(75, 139, 249, 0.7) !important;
          box-shadow:
            0 26px 74px rgba(0, 0, 0, 0.27),
            0 0 80px rgba(43, 104, 224, 0.1),
            inset 0 1px 0 rgba(255, 255, 255, 0.04);
        }

        .w1c-source-node,
        .w1c-output-list a,
        .w1c-core-grid > div {
          transition:
            transform 170ms ease,
            border-color 170ms ease,
            background 170ms ease;
        }

        .w1c-source-node:hover,
        .w1c-output-list a:hover,
        .w1c-core-grid > div:hover {
          transform: translateY(-2px);
          border-color: rgba(91, 146, 236, 0.4) !important;
          background: rgba(14, 34, 68, 0.72) !important;
        }

        .w1c-output-list a:hover {
          transform: translateX(3px);
        }

        /* ---------- Product Journey: make active stage feel alive ---------- */
        .w1f2-product-section {
          border-color: rgba(91, 142, 226, 0.27) !important;
          box-shadow:
            0 28px 88px rgba(0, 0, 0, 0.19),
            inset 0 1px 0 rgba(255, 255, 255, 0.02);
        }

        .w1f2-journey-tabs {
          background: rgba(4, 13, 28, 0.82) !important;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.025);
        }

        .w1f2-journey-tabs button:hover {
          color: #d8e7ff;
          background: rgba(29, 66, 132, 0.15);
        }

        .w1f2-journey-tabs button.active {
          border-color: rgba(95, 155, 255, 0.7) !important;
          background:
            radial-gradient(circle at 50% -15%, rgba(72, 136, 255, 0.3), transparent 75%),
            linear-gradient(150deg, rgba(34, 80, 165, 0.54), rgba(14, 37, 77, 0.78)) !important;
          box-shadow:
            0 10px 30px rgba(29, 83, 182, 0.13),
            inset 0 1px 0 rgba(255,255,255,0.07);
        }

        .w1f2-product-screen {
          border-color: rgba(91, 144, 232, 0.3) !important;
          box-shadow:
            0 26px 76px rgba(0, 0, 0, 0.28),
            0 0 64px rgba(42, 97, 202, 0.07);
          transition:
            transform 210ms ease,
            border-color 210ms ease,
            box-shadow 210ms ease;
        }

        .w1f2-product-screen:hover {
          transform: translateY(-3px);
          border-color: rgba(97, 155, 252, 0.46) !important;
          box-shadow:
            0 32px 88px rgba(0, 0, 0, 0.33),
            0 0 74px rgba(42, 97, 202, 0.11);
        }

        /* ---------- Platform breadth: quieter by default, crisp on hover ---------- */
        .w1f2-platform-group {
          transition:
            transform 190ms ease,
            border-color 190ms ease,
            box-shadow 190ms ease;
        }

        .w1f2-platform-group:hover {
          transform: translateY(-3px);
          border-color: rgba(94, 143, 222, 0.3);
          box-shadow: 0 20px 58px rgba(0, 0, 0, 0.15);
        }

        .w1f2-platform-items > a:hover {
          transform: translateX(3px);
          border-color: rgba(91, 147, 238, 0.38);
          background: rgba(13, 32, 65, 0.72);
        }

        /* ---------- AI + Control: stronger tab selection ---------- */
        .w1f2-intelligence-section {
          border-color: rgba(90, 141, 225, 0.27) !important;
          box-shadow:
            0 28px 84px rgba(0,0,0,0.18),
            inset 0 1px 0 rgba(255,255,255,0.02);
        }

        .w1f2-intelligence-tabs {
          background: rgba(4, 13, 28, 0.76) !important;
        }

        .w1f2-intelligence-tabs button:hover {
          color: #d8e7ff;
        }

        .w1f2-intelligence-tabs button.active {
          border-color: rgba(96, 157, 255, 0.66) !important;
          background:
            radial-gradient(circle at 50% -20%, rgba(72, 136, 255, 0.26), transparent 80%),
            rgba(29, 69, 143, 0.43) !important;
          box-shadow:
            0 9px 28px rgba(32, 84, 180, 0.12),
            inset 0 1px 0 rgba(255, 255, 255, 0.06);
        }

        /* ---------- Founder: give the operator story a premium focal point ---------- */
        .w1g-about-section {
          position: relative;
          isolation: isolate;
          box-shadow:
            0 30px 92px rgba(0, 0, 0, 0.18),
            inset 0 1px 0 rgba(255,255,255,0.02);
        }

        .w1g-about-section::before {
          content: "";
          position: absolute;
          width: 420px;
          height: 420px;
          right: -120px;
          top: -160px;
          z-index: -1;
          border-radius: 50%;
          background: rgba(45, 105, 224, 0.11);
          filter: blur(72px);
          pointer-events: none;
        }

        .w1g-founder-card {
          position: relative;
          overflow: hidden;
          transition:
            transform 210ms ease,
            border-color 210ms ease,
            box-shadow 210ms ease;
        }

        .w1g-founder-card::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: linear-gradient(
            135deg,
            rgba(255, 255, 255, 0.035),
            transparent 34%,
            transparent 68%,
            rgba(76, 133, 238, 0.04)
          );
        }

        .w1g-founder-card:hover {
          transform: translateY(-4px);
          border-color: rgba(104, 165, 255, 0.64);
          box-shadow:
            0 40px 100px rgba(0,0,0,0.34),
            0 0 75px rgba(43, 104, 224, 0.1);
        }

        .w1g-founder-card > button {
          transition:
            transform 170ms ease,
            border-color 170ms ease,
            background 170ms ease,
            box-shadow 170ms ease;
        }

        .w1g-founder-card > button:hover {
          transform: translateY(-2px);
          border-color: rgba(99, 158, 255, 0.7);
          background: rgba(31, 75, 155, 0.34);
          box-shadow: 0 12px 32px rgba(28, 79, 170, 0.14);
        }

        /* ---------- Final CTA: cinematic close ---------- */
        .w1g-final-section {
          position: relative;
          isolation: isolate;
          box-shadow:
            0 34px 100px rgba(0,0,0,0.26),
            0 0 85px rgba(42, 105, 228, 0.07),
            inset 0 1px 0 rgba(255,255,255,0.025);
        }

        .w1g-final-section::before {
          content: "";
          position: absolute;
          left: 12%;
          right: 12%;
          top: -1px;
          height: 1px;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(101, 161, 255, 0.7),
            rgba(173, 205, 255, 0.25),
            rgba(101, 161, 255, 0.7),
            transparent
          );
          pointer-events: none;
        }

        .w1e-final-actions button,
        .w1e-final-actions a {
          transition:
            transform 180ms ease,
            border-color 180ms ease,
            background 180ms ease,
            box-shadow 180ms ease;
        }

        .w1e-final-actions button {
          position: relative;
          overflow: hidden;
          box-shadow:
            0 18px 48px rgba(33, 91, 207, 0.25),
            inset 0 1px 0 rgba(255,255,255,0.18);
        }

        .w1e-final-actions button:hover,
        .w1e-final-actions a:hover {
          transform: translateY(-2px);
        }

        .w1e-final-actions a:hover {
          border-color: rgba(114, 164, 247, 0.52);
          background: rgba(17, 39, 78, 0.62);
        }

        /* ---------- Footer ---------- */
        .w1e-footer {
          border-top-color: rgba(91, 136, 207, 0.18) !important;
        }

        .w1e-footer-nav a {
          transition: color 150ms ease, transform 150ms ease;
        }

        .w1e-footer-nav a:hover {
          color: #d7e6ff !important;
          transform: translateX(2px);
        }

        /* Keep touch/mobile calm. */
        @media (max-width: 720px) {
          .w1a-product-stage:hover,
          .w1f2-product-screen:hover,
          .w1f2-platform-group:hover,
          .w1g-founder-card:hover {
            transform: none;
          }

          .w1f2-site-header::after {
            left: 12px;
            right: 12px;
          }
        }


        /* =========================================================
           W1G2.1 — COMPACT FINAL CTA
           Keep the premium conversion moment, remove excess empty height.
        ========================================================= */

        .w1g-final-section {
          margin-bottom: 30px !important;
          padding:
            clamp(46px, 4.6vw, 66px)
            clamp(42px, 5vw, 78px) !important;
        }

        .w1g-final-section .w1e-final-kicker {
          font-size: 10px !important;
        }

        .w1g-final-section .w1e-final-content {
          margin-top: 34px !important;
        }

        .w1g-final-section .w1e-final-content h2 {
          max-width: 1120px;
          margin-left: auto;
          margin-right: auto;
          font-size: clamp(50px, 4.8vw, 74px) !important;
          line-height: 0.98 !important;
        }

        .w1g-final-section .w1e-final-content > p {
          max-width: 850px;
          margin-top: 26px !important;
          font-size: 16px !important;
          line-height: 1.62 !important;
        }

        .w1g-final-section .w1e-final-actions {
          margin-top: 28px !important;
        }

        .w1g-final-section .w1e-final-actions button,
        .w1g-final-section .w1e-final-actions a {
          min-height: 54px !important;
          padding-left: 25px !important;
          padding-right: 25px !important;
        }

        .w1g-final-section .w1e-final-proof {
          margin-top: 34px !important;
        }

        .w1g-final-section .w1e-final-proof > div {
          min-height: 74px !important;
          padding: 16px 20px !important;
        }

        .w1g-final-section .w1e-final-proof span {
          font-size: 9px !important;
        }

        .w1g-final-section .w1e-final-proof strong {
          font-size: 12px !important;
        }

        @media (max-width: 720px) {
          .w1g-final-section {
            padding: 38px 20px !important;
          }

          .w1g-final-section .w1e-final-content {
            margin-top: 26px !important;
          }

          .w1g-final-section .w1e-final-content h2 {
            font-size: clamp(40px, 11vw, 54px) !important;
          }

          .w1g-final-section .w1e-final-content > p {
            margin-top: 20px !important;
            font-size: 15px !important;
          }

          .w1g-final-section .w1e-final-actions {
            margin-top: 22px !important;
          }

          .w1g-final-section .w1e-final-proof {
            margin-top: 26px !important;
          }
        }


        /* =========================================================
           W1G2.2 — INTELLIGENCE + CONTROL READABILITY
           Same layout. Larger, brighter content inside the cards.
        ========================================================= */

        .w1f2-control-grid {
          gap: 12px !important;
        }

        .w1f2-control-grid > div {
          min-height: 154px !important;
          padding: 22px 23px !important;
          border-color: rgba(95, 145, 224, 0.27) !important;
          background:
            radial-gradient(circle at 100% 0%, rgba(47, 102, 205, 0.09), transparent 15rem),
            rgba(8, 21, 43, 0.78) !important;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.025),
            0 12px 30px rgba(0, 0, 0, 0.08);
        }

        .w1f2-control-grid > div:hover {
          border-color: rgba(102, 161, 255, 0.46) !important;
          background:
            radial-gradient(circle at 100% 0%, rgba(54, 116, 232, 0.14), transparent 16rem),
            rgba(10, 25, 51, 0.88) !important;
        }

        .w1f2-control-grid span {
          color: #78a8f6 !important;
          font-size: 10px !important;
          font-weight: 950 !important;
          letter-spacing: 0.07em;
        }

        .w1f2-control-grid strong {
          margin-top: 14px !important;
          color: #f0f5fd !important;
          font-size: 15px !important;
          line-height: 1.3 !important;
        }

        .w1f2-control-grid p {
          margin-top: 10px !important;
          max-width: 390px;
          color: #aebfd6 !important;
          font-size: 12px !important;
          line-height: 1.58 !important;
        }

        .w1f2-control-copy > span,
        .w1f2-intelligence-copy > span {
          color: #79a8f2 !important;
          font-size: 10px !important;
        }

        .w1f2-control-copy > p,
        .w1f2-intelligence-copy > p {
          color: #b8c8dc !important;
          font-size: 15px !important;
          line-height: 1.65 !important;
        }

        .w1f2-control-copy a {
          margin-top: 22px !important;
          color: #a4c7ff !important;
          font-size: 11px !important;
          line-height: 1.4;
        }

        /* Keep the AI tab equally readable so the two modes feel intentional. */
        .w1f2-ai-top strong {
          font-size: 12px !important;
        }

        .w1f2-ai-top span {
          color: #8fa4c2 !important;
          font-size: 10px !important;
        }

        .w1f2-ai-opinion > span,
        .w1f2-ai-actions > span {
          color: #7aa9f6 !important;
          font-size: 9px !important;
        }

        .w1f2-ai-opinion h3 {
          font-size: 27px !important;
        }

        .w1f2-ai-opinion p {
          color: #b6c7dd !important;
          font-size: 12px !important;
          line-height: 1.58 !important;
        }

        .w1f2-ai-actions a {
          min-height: 42px !important;
          color: #e3ebf7 !important;
          font-size: 11px !important;
        }

        .w1f2-intelligence-tabs button {
          min-height: 48px !important;
          padding-left: 18px !important;
          padding-right: 18px !important;
          font-size: 12px !important;
        }

        @media (max-width: 980px) {
          .w1f2-control-grid > div {
            min-height: 142px !important;
          }
        }

        @media (max-width: 720px) {
          .w1f2-control-grid {
            gap: 10px !important;
          }

          .w1f2-control-grid > div {
            min-height: auto !important;
            padding: 19px !important;
          }

          .w1f2-control-grid strong {
            font-size: 15px !important;
          }

          .w1f2-control-grid p {
            font-size: 12px !important;
          }
        }


        /* =========================================================
           W1G2.3 — SECURITY CTA READABILITY
        ========================================================= */

        .w1f2-control-copy a {
          display: inline-flex !important;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          width: fit-content;
          min-height: 46px;
          margin-top: 26px !important;
          padding: 0 17px;
          border: 1px solid rgba(102, 158, 248, 0.38);
          border-radius: 13px;
          color: #d7e7ff !important;
          background:
            linear-gradient(
              135deg,
              rgba(29, 70, 145, 0.34),
              rgba(10, 29, 61, 0.62)
            );
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.04),
            0 10px 28px rgba(21, 61, 132, 0.08);
          font-size: 14px !important;
          font-weight: 850 !important;
          line-height: 1 !important;
          text-decoration: none !important;
          transition:
            transform 170ms ease,
            border-color 170ms ease,
            background 170ms ease,
            box-shadow 170ms ease;
        }

        .w1f2-control-copy a:hover {
          transform: translateY(-2px);
          border-color: rgba(116, 176, 255, 0.72);
          background:
            linear-gradient(
              135deg,
              rgba(37, 87, 179, 0.48),
              rgba(14, 38, 78, 0.74)
            );
          box-shadow:
            0 14px 34px rgba(31, 83, 177, 0.16),
            inset 0 1px 0 rgba(255,255,255,0.06);
        }

        .w1f2-control-copy a > span,
        .w1f2-control-copy a > i {
          color: #8fbbff !important;
          font-size: 16px !important;
          line-height: 1 !important;
        }

        @media (max-width: 720px) {
          .w1f2-control-copy a {
            min-height: 44px;
            padding: 0 15px;
            font-size: 13px !important;
          }
        }


        /* =========================================================
           W1G3 — FINAL VISUAL QA
           Structure frozen. Final pass for rhythm, readability and polish.
        ========================================================= */

        /* ---------- Typography floor: meaningful public copy should never feel like fine print ---------- */
        .w1a-private-walkthrough {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          width: fit-content;
          margin-top: 18px;
          color: #9fc1f7 !important;
          font-size: 13px !important;
          font-weight: 820 !important;
          line-height: 1.35;
          text-decoration: none;
          transition:
            color 160ms ease,
            transform 160ms ease;
        }

        .w1a-private-walkthrough:hover {
          color: #dceaff !important;
          transform: translateX(3px);
        }

        .w1a-private-walkthrough span {
          color: #79a9f7;
          font-size: 15px;
          transition: transform 160ms ease;
        }

        .w1a-private-walkthrough:hover span {
          transform: translateX(4px);
        }

        .w1b-role-tab span {
          font-size: 10px !important;
        }

        .w1b-role-tab strong {
          color: #aebfd7;
          font-size: 13px !important;
          line-height: 1.25;
        }

        .w1b-role-tab.active strong {
          color: #f0f6ff;
        }

        .w1f2-journey-tabs button span {
          font-size: 10px !important;
        }

        .w1f2-journey-tabs button strong {
          font-size: 13px !important;
          line-height: 1.25;
        }

        .w1f2-product-copy > span {
          font-size: 10px !important;
        }

        .w1f2-product-copy > p {
          color: #b7c7dc !important;
          font-size: 15px !important;
          line-height: 1.65 !important;
        }

        .w1f2-product-chips span {
          color: #a4badb !important;
          font-size: 11px !important;
        }

        .w1f2-product-copy > a {
          font-size: 13px !important;
        }

        .w1f2-product-screen-label {
          color: #9bb0cc !important;
          font-size: 11px !important;
        }

        .w1f2-platform-heading > p {
          color: #b9c9dd !important;
          font-size: 15px !important;
          line-height: 1.62 !important;
        }

        .w1f2-platform-status span {
          font-size: 10px !important;
        }

        .w1f2-platform-status strong {
          font-size: 13px !important;
        }

        .w1f2-platform-items strong {
          font-size: 14px !important;
        }

        .w1f2-platform-items span {
          color: #96abc8 !important;
          font-size: 11px !important;
          line-height: 1.45 !important;
        }

        .w1f2-roadmap-pill {
          font-size: 9px !important;
        }

        .w1e-footer-brand p {
          color: #a2b4ce !important;
          font-size: 13px !important;
        }

        .w1e-footer-nav span {
          font-size: 9px !important;
        }

        .w1e-footer-nav a {
          color: #aabbd2 !important;
          font-size: 12px !important;
        }

        .w1e-footer-bottom,
        .w1e-footer-bottom strong {
          font-size: 10px !important;
        }

        /* ---------- Section rhythm: same brand, different chapter personalities ---------- */
        .w1b-section {
          background:
            radial-gradient(circle at 72% 18%, rgba(47, 105, 221, 0.16), transparent 29rem),
            radial-gradient(circle at 18% 84%, rgba(28, 63, 129, 0.09), transparent 30rem),
            linear-gradient(145deg, rgba(9, 24, 51, 0.97), rgba(4, 13, 29, 0.99)) !important;
        }

        .w1c-section {
          background:
            linear-gradient(rgba(83, 126, 202, 0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(83, 126, 202, 0.025) 1px, transparent 1px),
            radial-gradient(circle at 50% 45%, rgba(43, 101, 215, 0.11), transparent 30rem),
            linear-gradient(145deg, rgba(7, 20, 43, 0.97), rgba(3, 11, 25, 0.995)) !important;
          background-size:
            58px 58px,
            58px 58px,
            auto,
            auto !important;
        }

        .w1f2-product-section {
          background:
            radial-gradient(circle at 78% 26%, rgba(38, 88, 190, 0.09), transparent 28rem),
            linear-gradient(145deg, rgba(5, 16, 34, 0.94), rgba(3, 11, 25, 0.99)) !important;
        }

        .w1f2-platform-section {
          position: relative;
          padding-top: 44px !important;
        }

        .w1f2-platform-section::before {
          content: "";
          position: absolute;
          left: 4%;
          right: 4%;
          top: 0;
          height: 1px;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(88, 137, 219, 0.22),
            transparent
          );
        }

        .w1f2-intelligence-section {
          background:
            radial-gradient(circle at 84% 18%, rgba(31, 82, 178, 0.11), transparent 28rem),
            linear-gradient(145deg, rgba(5, 15, 31, 0.97), rgba(3, 10, 22, 0.995)) !important;
        }

        .w1g-about-section {
          background:
            radial-gradient(circle at 83% 24%, rgba(51, 109, 219, 0.15), transparent 27rem),
            linear-gradient(145deg, rgba(5, 15, 31, 0.96), rgba(4, 12, 27, 0.995)) !important;
        }

        /* ---------- Stronger chapter entry without adding scrolling ---------- */
        .w1b-kicker,
        .w1c-kicker,
        .w1f2-product-kicker,
        .w1f2-intelligence-kicker,
        .w1e-final-kicker {
          text-shadow: 0 0 24px rgba(73, 132, 241, 0.1);
        }

        .w1b-section,
        .w1c-section,
        .w1f2-product-section,
        .w1f2-intelligence-section,
        .w1g-about-section,
        .w1g-final-section {
          scroll-margin-top: 104px;
        }

        /* ---------- Product images: crisp framing ---------- */
        .w1a-screen-card,
        .w1f2-product-screen {
          background: #06101f;
        }

        .w1a-screen-crop::after,
        .w1f2-product-screen::after {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          box-shadow: inset 0 0 0 1px rgba(255,255,255,0.018);
        }

        .w1a-screen-crop,
        .w1f2-product-screen {
          position: relative;
        }

        /* ---------- Keep hover polish restrained and institutional ---------- */
        .w1b-role-tab,
        .w1f2-journey-tabs button,
        .w1f2-platform-items > a,
        .w1c-output-list a,
        .w1g-founder-card {
          will-change: transform;
        }

        /* ---------- Tablet ---------- */
        @media (max-width: 980px) {
          .w1f2-platform-section {
            padding-top: 34px !important;
          }

          .w1b-role-tab strong,
          .w1f2-journey-tabs button strong {
            font-size: 12px !important;
          }
        }

        /* ---------- Mobile: readability wins over density ---------- */
        @media (max-width: 720px) {
          .w1a-private-walkthrough {
            font-size: 13px !important;
          }

          .w1b-role-tab strong,
          .w1f2-journey-tabs button strong {
            font-size: 12px !important;
          }

          .w1f2-product-copy > p,
          .w1f2-platform-heading > p {
            font-size: 15px !important;
          }

          .w1f2-product-chips span,
          .w1f2-platform-items span {
            font-size: 11px !important;
          }

          .w1e-footer-nav a {
            font-size: 13px !important;
          }

          .w1e-footer-bottom,
          .w1e-footer-bottom strong {
            font-size: 11px !important;
          }
        }


        /* =========================================================
           W1G3.1 — FINAL HERO MICRO-POLISH
           Hero structure locked. Only spacing, product weight and tertiary CTA.
        ========================================================= */

        /* 01 — Reduce the dead air below the header and bring the first view forward. */
        @media (min-width: 1181px) {
          .w1a-hero {
            grid-template-columns: minmax(0, 0.94fr) minmax(680px, 1.16fr) !important;
            gap: clamp(28px, 3vw, 48px) !important;
            min-height: min(660px, calc(100vh - 96px)) !important;
            padding-top: clamp(20px, 2.2vw, 32px) !important;
            padding-bottom: clamp(20px, 2vw, 28px) !important;
          }

          .w1a-hero-copy {
            transform: translateY(-4px);
          }

          /* 02 — Give real product proof a little more visual authority. */
          .w1a-hero-visual {
            min-height: 520px !important;
          }

          .w1a-product-stage {
            width: min(100%, 965px) !important;
          }
        }

        /* 03 — Keep this tertiary, but make the hand-off to section two unmistakable. */
        .w1a-private-walkthrough {
          gap: 11px !important;
          margin-top: 17px !important;
          color: #abc9f8 !important;
          font-size: 14px !important;
          font-weight: 860 !important;
          letter-spacing: -0.005em;
        }

        .w1a-private-walkthrough span {
          color: #8bb6fb !important;
          font-size: 16px !important;
        }

        .w1a-private-walkthrough:hover {
          color: #edf5ff !important;
        }

        /* Avoid forcing the desktop redistribution onto narrower layouts. */
        @media (max-width: 1180px) {
          .w1a-private-walkthrough {
            font-size: 14px !important;
          }
        }

        @media (max-width: 720px) {
          .w1a-private-walkthrough {
            margin-top: 15px !important;
            font-size: 13px !important;
          }

          .w1a-private-walkthrough span {
            font-size: 15px !important;
          }
        }


        /* =========================================================
           W1G4 — CENTERED HERO
           Remove the duplicate Hero product panel. Let the Hero sell
           the proposition; the existing stakeholder section below proves it.
        ========================================================= */

        .w1a-hero.w1a-hero-centered {
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          grid-template-columns: none !important;
          gap: 0 !important;
          width: 100%;
          min-height: min(610px, calc(100vh - 96px)) !important;
          padding: clamp(46px, 5vw, 72px) 28px clamp(46px, 4.5vw, 66px) !important;
          text-align: center;
        }

        .w1a-hero.w1a-hero-centered::before {
          inset: 2% 14% auto !important;
          height: 66% !important;
          background:
            radial-gradient(circle at 50% 40%, rgba(53, 112, 255, 0.13), transparent 48%),
            radial-gradient(circle at 50% 28%, rgba(92, 130, 246, 0.07), transparent 36%) !important;
        }

        .w1a-hero-copy.w1a-hero-copy-centered {
          width: min(980px, 100%) !important;
          max-width: 980px !important;
          margin: 0 auto !important;
          display: flex;
          flex-direction: column;
          align-items: center;
          transform: none !important;
        }

        .w1a-hero-copy-centered .w1a-eyebrow {
          margin: 0 auto 26px !important;
        }

        .w1a-hero .w1a-centered-title {
          width: 100%;
          max-width: 960px;
          margin: 0 auto;
          align-items: center;
          font-size: clamp(64px, 6.3vw, 104px) !important;
          line-height: 0.94 !important;
          letter-spacing: -0.065em !important;
          text-align: center;
        }

        .w1a-hero .w1a-centered-title > span {
          white-space: normal !important;
        }

        .w1a-centered-lede {
          max-width: 790px !important;
          margin: 30px auto 0 !important;
          text-align: center;
          font-size: clamp(18px, 1.25vw, 21px) !important;
          line-height: 1.58 !important;
        }

        .w1a-centered-actions {
          justify-content: center !important;
          margin-top: 32px !important;
        }

        .w1a-hero-scroll-cue {
          justify-content: center;
          margin-top: 23px !important;
          color: #9fc0ff !important;
        }

        .w1a-hero-scroll-cue:hover {
          transform: translateY(2px) !important;
        }

        /* Keep the first proof section close enough to feel like the next chapter. */
        .w1a-hero-centered + .w1b-section {
          margin-top: 18px !important;
        }

        @media (min-width: 1181px) {
          .w1a-hero.w1a-hero-centered {
            min-height: min(610px, calc(100vh - 96px)) !important;
            padding-top: clamp(38px, 4vw, 58px) !important;
            padding-bottom: clamp(42px, 4vw, 58px) !important;
          }
        }

        @media (max-width: 980px) {
          .w1a-hero.w1a-hero-centered {
            min-height: auto !important;
            padding: 70px 22px 58px !important;
          }

          .w1a-hero .w1a-centered-title {
            font-size: clamp(54px, 10vw, 82px) !important;
          }

          .w1a-centered-lede {
            max-width: 680px !important;
          }
        }

        @media (max-width: 720px) {
          .w1a-hero.w1a-hero-centered {
            padding: 56px 18px 48px !important;
          }

          .w1a-hero-copy-centered .w1a-eyebrow {
            margin-bottom: 21px !important;
          }

          .w1a-hero .w1a-centered-title {
            font-size: clamp(46px, 13.2vw, 68px) !important;
            line-height: 0.98 !important;
            letter-spacing: -0.055em !important;
          }

          .w1a-centered-lede {
            margin-top: 24px !important;
            font-size: 16px !important;
            line-height: 1.62 !important;
          }

          .w1a-centered-actions {
            width: 100%;
            flex-direction: column;
            margin-top: 28px !important;
          }

          .w1a-centered-actions .w1a-primary-cta,
          .w1a-centered-actions .w1a-secondary-cta {
            width: min(100%, 430px);
          }

          .w1a-hero-scroll-cue {
            margin-top: 21px !important;
          }

          .w1a-hero-centered + .w1b-section {
            margin-top: 8px !important;
          }
        }


        /* =========================================================
           W1G4.2 — FINAL HERO LOCK
           Hero structure frozen. Final micro-polish only: balance the
           supporting line and tighten the proof-to-section handoff.
        ========================================================= */

        .w1a-hero.w1g42-hero {
          min-height: 0 !important;
          padding-top: clamp(34px, 3vw, 46px) !important;
          padding-bottom: clamp(30px, 2.5vw, 40px) !important;
        }

        .w1g42-hero-copy {
          width: min(1120px, 100%) !important;
          max-width: 1120px !important;
        }

        .w1g42-hero .w1a-eyebrow {
          margin-bottom: 22px !important;
        }

        .w1a-hero .w1g42-title {
          max-width: 1040px !important;
          font-size: clamp(58px, 5.15vw, 86px) !important;
          line-height: 0.96 !important;
          letter-spacing: -0.055em !important;
        }

        .w1g42-lede {
          max-width: 1020px !important;
          margin-top: 24px !important;
          font-size: clamp(17px, 1.1vw, 20px) !important;
          line-height: 1.56 !important;
        }

        .w1g42-actions {
          margin-top: 27px !important;
        }

        .w1g42-scroll-cue {
          margin-top: 18px !important;
        }

        .w1g42-proof-rail {
          width: min(1040px, 100%);
          margin: 17px auto 0;
          padding-top: 22px;
          border-top: 1px solid rgba(112, 157, 233, 0.16);
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0;
          text-align: left;
        }

        .w1g42-proof-item {
          min-width: 0;
          display: grid;
          grid-template-columns: 12px minmax(0, 1fr);
          gap: 12px;
          align-items: start;
          padding: 0 28px;
          border-right: 1px solid rgba(112, 157, 233, 0.14);
        }

        .w1g42-proof-item:first-child {
          padding-left: 6px;
        }

        .w1g42-proof-item:last-child {
          padding-right: 6px;
          border-right: 0;
        }

        .w1g42-proof-mark {
          width: 7px;
          height: 7px;
          margin-top: 7px;
          border-radius: 999px;
          background: #5f96ff;
          box-shadow: 0 0 0 5px rgba(74, 126, 237, 0.09);
        }

        .w1g42-proof-item div {
          display: grid;
          gap: 5px;
        }

        .w1g42-proof-item strong {
          color: #f2f6ff;
          font-size: 12px;
          line-height: 1.2;
          font-weight: 850;
          letter-spacing: 0.09em;
        }

        .w1g42-proof-item div > span {
          color: #9eb0ca;
          font-size: 13px;
          line-height: 1.45;
        }

        .w1g42-hero + .w1b-section {
          margin-top: 0 !important;
        }

        @media (min-width: 1181px) {
          .w1a-hero.w1g42-hero {
            min-height: 0 !important;
            padding-top: 34px !important;
            padding-bottom: 34px !important;
          }
        }

        @media (max-width: 980px) {
          .w1a-hero .w1g42-title {
            font-size: clamp(52px, 9vw, 76px) !important;
          }

          .w1g42-proof-rail {
            width: min(760px, 100%);
          }

          .w1g42-proof-item {
            padding: 0 18px;
          }
        }


        /* =========================================================
           W1G6.1 — RESTRAINED PUBLIC NAVIGATION DEPTH
           Platform micro-polish: migration-first, lighter intro column.
           Every mega-menu destination remains public.
        ========================================================= */

        .w1g6-site-nav {
          overflow: visible !important;
        }

        .w1g6-nav-cluster {
          position: relative;
          display: inline-flex;
          align-items: center;
          flex: 0 0 auto;
        }

        .w1g6-nav-trigger {
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }

        .w1g6-chevron {
          display: inline-block;
          margin-top: -2px;
          color: #7894bc;
          font-size: 13px;
          line-height: 1;
          transition: transform 160ms ease, color 160ms ease;
        }

        .w1g6-has-menu:hover .w1g6-chevron,
        .w1g6-has-menu:focus-within .w1g6-chevron {
          transform: translateY(1px) rotate(180deg);
          color: #a8c4f1;
        }

        .w1g6-mega {
          position: absolute;
          top: calc(100% + 10px);
          left: 50%;
          z-index: 480;
          width: min(760px, calc(100vw - 36px));
          padding: 20px;
          border: 1px solid rgba(102, 151, 232, 0.25);
          border-radius: 22px;
          visibility: hidden;
          opacity: 0;
          pointer-events: none;
          transform: translate(-50%, -7px);
          background:
            radial-gradient(circle at 90% 4%, rgba(47, 111, 226, 0.13), transparent 31%),
            linear-gradient(155deg, rgba(5, 15, 32, 0.992), rgba(3, 10, 22, 0.997));
          box-shadow:
            0 28px 70px rgba(0, 0, 0, 0.46),
            inset 0 1px 0 rgba(255, 255, 255, 0.025);
          transition:
            opacity 150ms ease,
            transform 150ms ease,
            visibility 150ms ease;
        }

        .w1g6-mega::before {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          top: -14px;
          height: 14px;
        }

        .w1g6-has-menu:hover > .w1g6-mega,
        .w1g6-has-menu:focus-within > .w1g6-mega {
          visibility: visible;
          opacity: 1;
          pointer-events: auto;
          transform: translate(-50%, 0);
        }

        .w1g6-mega a::after {
          display: none !important;
        }

        .w1g6-mega-heading {
          display: grid;
          gap: 6px;
          margin-bottom: 15px;
          padding: 2px 4px 14px;
          border-bottom: 1px solid rgba(99, 145, 214, 0.16);
        }

        .w1g6-mega-heading span,
        .w1g6-platform-intro > span {
          color: #79a7f4;
          font-size: 9px;
          font-weight: 950;
          letter-spacing: 0.16em;
        }

        .w1g6-mega-heading strong,
        .w1g6-platform-intro > strong {
          color: #f5f9ff;
          font-size: 17px;
          line-height: 1.25;
          letter-spacing: -0.025em;
        }

        .w1g6-role-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 6px;
        }

        .w1g6-role-grid > a {
          display: grid;
          grid-template-columns: 30px minmax(0, 1fr);
          gap: 10px;
          min-width: 0;
          padding: 12px;
          border: 1px solid transparent;
          border-radius: 13px;
          color: #dfeaff !important;
          text-decoration: none;
          transition:
            border-color 150ms ease,
            background 150ms ease,
            transform 150ms ease;
        }

        .w1g6-role-grid > a:hover,
        .w1g6-platform-links > a:hover {
          border-color: rgba(94, 150, 241, 0.22);
          background: rgba(36, 86, 169, 0.12);
          transform: translateY(-1px);
        }

        .w1g6-role-index {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border: 1px solid rgba(93, 146, 229, 0.24);
          border-radius: 9px;
          color: #84aff4;
          background: rgba(38, 83, 155, 0.1);
          font-size: 9px;
          font-weight: 950;
        }

        .w1g6-role-grid strong,
        .w1g6-platform-links strong {
          display: block;
          color: #f2f7ff;
          font-size: 12px;
          font-weight: 900;
          line-height: 1.35;
        }

        .w1g6-role-grid small,
        .w1g6-platform-links small {
          display: block;
          margin-top: 4px;
          color: #8fa5c3;
          font-size: 10px;
          font-weight: 650;
          line-height: 1.45;
          white-space: normal;
        }

        .w1g6-mega-footer-link {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 10px;
          padding: 12px 14px 2px !important;
          color: #94baff !important;
          text-decoration: none;
          font-size: 10px !important;
          font-weight: 900 !important;
          letter-spacing: 0.02em;
        }

        .w1g6-platform-menu {
          width: min(800px, calc(100vw - 36px));
          display: grid;
          grid-template-columns: minmax(190px, 0.64fr) minmax(0, 1.36fr);
          gap: 14px;
          padding: 18px 18px 14px;
        }

        .w1g6-platform-intro {
          align-self: stretch;
          padding: 8px 18px 8px 4px;
          border-right: 1px solid rgba(93, 142, 219, 0.16);
        }

        .w1g6-platform-intro > strong {
          display: block;
          margin-top: 7px;
        }

        .w1g6-platform-intro p {
          margin: 8px 0 0;
          color: #8fa5c2;
          font-size: 10px;
          font-weight: 650;
          line-height: 1.5;
        }

        .w1g6-platform-links {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 4px;
        }

        .w1g6-platform-links > a {
          display: block;
          min-width: 0;
          padding: 9px 10px;
          border: 1px solid transparent;
          border-radius: 12px;
          color: inherit !important;
          text-decoration: none;
          transition:
            border-color 150ms ease,
            background 150ms ease,
            transform 150ms ease;
        }

        .w1g6-platform-links > a.w1g6-platform-primary {
          border-color: rgba(94, 150, 241, 0.16);
          background: rgba(36, 86, 169, 0.08);
        }

        .w1g6-platform-footer {
          grid-column: 1 / -1;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 10px 4px 0;
          border-top: 1px solid rgba(99, 145, 214, 0.14);
        }

        .w1g6-platform-footer a {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 0 !important;
          color: #91b7f8 !important;
          text-decoration: none;
          font-size: 10px !important;
          font-weight: 900 !important;
        }

        .w1g6-header-actions {
          display: flex;
          align-items: center;
          gap: 14px;
          white-space: nowrap;
        }

        .w1g6-sign-in {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 40px;
          padding: 0 4px;
          color: #b8c8dd;
          text-decoration: none;
          font-size: 12px;
          font-weight: 850;
          transition: color 150ms ease;
        }

        .w1g6-sign-in:hover {
          color: #ffffff;
        }

        .w1g6-sign-in:focus-visible,
        .w1g6-mega a:focus-visible {
          outline: 3px solid rgba(101, 159, 255, 0.7);
          outline-offset: 3px;
        }

        @media (max-width: 1240px) {
          .w1g6-header-actions {
            gap: 10px;
          }

          .w1g6-sign-in {
            font-size: 11px;
          }

          .w1g6-mega {
            width: min(700px, calc(100vw - 28px));
          }

          .w1g6-platform-menu {
            width: min(740px, calc(100vw - 28px));
          }
        }

        @media (max-width: 1060px) {
          .w1g6-sign-in {
            display: none;
          }

          .w1g6-role-grid {
            grid-template-columns: 1fr;
          }

          .w1g6-mega {
            width: min(540px, calc(100vw - 24px));
          }

          .w1g6-platform-menu {
            width: min(650px, calc(100vw - 24px));
            grid-template-columns: 190px minmax(0, 1fr);
          }
        }

        @media (max-width: 820px) {
          .w1g6-mega {
            display: none !important;
          }

          .w1g6-chevron {
            display: none;
          }
        }

        @media (max-width: 720px) {
          .w1g6-header-actions {
            display: contents;
          }

          .w1g6-sign-in {
            display: none;
          }
        }

        @media (max-width: 720px) {
          .w1a-hero.w1g42-hero {
            padding: 48px 18px 36px !important;
          }

          .w1a-hero .w1g42-title {
            font-size: clamp(43px, 12.2vw, 62px) !important;
            line-height: 0.99 !important;
          }

          .w1g42-lede {
            margin-top: 21px !important;
            font-size: 16px !important;
          }

          .w1g42-proof-rail {
            grid-template-columns: 1fr;
            margin-top: 22px;
            padding-top: 7px;
            border-top: 1px solid rgba(112, 157, 233, 0.16);
          }

          .w1g42-proof-item,
          .w1g42-proof-item:first-child,
          .w1g42-proof-item:last-child {
            padding: 14px 2px;
            border-right: 0;
            border-bottom: 1px solid rgba(112, 157, 233, 0.11);
          }

          .w1g42-proof-item:last-child {
            border-bottom: 0;
          }
        }


        /* =========================================================
           W1G7 — HERO -> SIGNATURE TRANSITION POLISH
           Keep W1G4.2 Hero and W1B stakeholder experience structurally
           unchanged. Refine only the first-scroll handoff.
        ========================================================= */

        .w1g42-hero + .w1b-section {
          margin-top: -8px !important;
          border-radius: 32px 32px 38px 38px !important;
          border-top-color: rgba(112, 162, 244, 0.34) !important;
          background:
            radial-gradient(circle at 50% -8%, rgba(69, 125, 232, 0.13), transparent 24rem),
            radial-gradient(circle at 72% 18%, rgba(47, 105, 221, 0.16), transparent 29rem),
            radial-gradient(circle at 18% 84%, rgba(28, 63, 129, 0.09), transparent 30rem),
            linear-gradient(145deg, rgba(9, 24, 51, 0.97), rgba(4, 13, 29, 0.99)) !important;
          box-shadow:
            0 30px 88px rgba(0, 0, 0, 0.24),
            inset 0 1px 0 rgba(133, 177, 255, 0.035) !important;
        }

        .w1g42-hero + .w1b-section::after {
          content: "";
          position: absolute;
          top: -1px;
          left: 16%;
          right: 16%;
          height: 1px;
          z-index: 2;
          pointer-events: none;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(104, 158, 255, 0.52),
            transparent
          );
        }

        .w1g42-hero + .w1b-section .w1b-kicker {
          margin-top: -2px;
        }

        @media (max-width: 980px) {
          .w1g42-hero + .w1b-section {
            margin-top: -4px !important;
            border-radius: 28px 28px 34px 34px !important;
          }

          .w1g42-hero + .w1b-section::after {
            left: 10%;
            right: 10%;
          }
        }

        @media (max-width: 720px) {
          .w1g42-hero + .w1b-section {
            margin-top: 0 !important;
            border-radius: 24px 24px 30px 30px !important;
          }

          .w1g42-hero + .w1b-section::after {
            left: 8%;
            right: 8%;
          }
        }


        /* =========================================================
           W1G8 — OPERATING LAYER COMPRESSION + JOURNEY ALIGNMENT
           Compact architecture bridge between role-native experiences
           and the real-product journey.
        ========================================================= */

        .w1g8-section {
          position: relative;
          width: min(calc(100% - 32px), 1540px);
          margin: 18px auto 0;
          padding: clamp(48px, 4.8vw, 76px) clamp(30px, 4.8vw, 74px) 38px;
          overflow: hidden;
          border: 1px solid rgba(91, 139, 228, 0.30);
          border-radius: 34px;
          background:
            radial-gradient(circle at 50% -16%, rgba(55, 113, 230, 0.13), transparent 28rem),
            linear-gradient(145deg, rgba(7, 20, 43, 0.98), rgba(3, 11, 25, 0.995));
          box-shadow:
            0 28px 82px rgba(0, 0, 0, 0.22),
            inset 0 1px 0 rgba(128, 172, 255, 0.035);
        }

        .w1g8-section::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background-image:
            linear-gradient(rgba(97, 143, 228, 0.033) 1px, transparent 1px),
            linear-gradient(90deg, rgba(97, 143, 228, 0.033) 1px, transparent 1px);
          background-size: 42px 42px;
          mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.72), transparent 88%);
        }

        .w1g8-kicker,
        .w1g8-heading-row,
        .w1g8-flow,
        .w1g8-principles {
          position: relative;
          z-index: 1;
        }

        .w1g8-kicker {
          display: grid;
          grid-template-columns: auto 1fr auto;
          align-items: center;
          gap: 22px;
          color: #82acfb;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        .w1g8-kicker div {
          height: 1px;
          background: linear-gradient(90deg, rgba(84, 137, 235, 0.58), rgba(84, 137, 235, 0.08));
        }

        .w1g8-heading-row {
          display: grid;
          grid-template-columns: minmax(0, 1.18fr) minmax(320px, 0.82fr);
          align-items: end;
          gap: clamp(42px, 6vw, 100px);
          margin-top: 30px;
        }

        .w1g8-heading-row h2 {
          max-width: 860px;
          margin: 0;
          color: #f5f8ff;
          font-size: clamp(39px, 3.7vw, 62px);
          font-weight: 900;
          line-height: 1.01;
          letter-spacing: -0.052em;
          text-wrap: balance;
        }

        .w1g8-heading-row p {
          max-width: 620px;
          margin: 0 0 5px;
          color: #b9c7df;
          font-size: clamp(16px, 1.18vw, 19px);
          line-height: 1.62;
          letter-spacing: -0.018em;
        }

        .w1g8-flow {
          display: grid;
          grid-template-columns:
            minmax(0, 1fr) 28px
            minmax(0, 1.06fr) 28px
            minmax(0, 1.06fr) 28px
            minmax(0, 1fr);
          align-items: stretch;
          gap: 10px;
          margin-top: 38px;
        }

        .w1g8-stage {
          min-width: 0;
          padding: 22px 21px 20px;
          border: 1px solid rgba(100, 145, 229, 0.20);
          border-radius: 22px;
          background: rgba(7, 20, 43, 0.66);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.025);
        }

        .w1g8-stage-primary {
          border-color: rgba(82, 143, 255, 0.68);
          background:
            radial-gradient(circle at 50% 0%, rgba(69, 130, 246, 0.20), transparent 64%),
            linear-gradient(160deg, rgba(19, 53, 111, 0.86), rgba(8, 26, 58, 0.92));
          box-shadow:
            0 18px 42px rgba(20, 73, 177, 0.16),
            inset 0 1px 0 rgba(168, 199, 255, 0.10);
        }

        .w1g8-stage-core {
          border-color: rgba(91, 139, 229, 0.36);
          background:
            linear-gradient(180deg, rgba(13, 32, 67, 0.86), rgba(7, 20, 43, 0.82));
        }

        .w1g8-stage-top {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 15px;
        }

        .w1g8-stage-top > span {
          display: grid;
          place-items: center;
          width: 32px;
          height: 32px;
          flex: 0 0 auto;
          border: 1px solid rgba(87, 143, 249, 0.34);
          border-radius: 10px;
          background: rgba(24, 59, 119, 0.52);
          color: #8cb5ff;
          font-size: 11px;
          font-weight: 900;
        }

        .w1g8-stage-top small {
          color: #80a9ee;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.13em;
          line-height: 1.3;
          text-transform: uppercase;
        }

        .w1g8-stage h3 {
          margin: 0;
          color: #eef4ff;
          font-size: clamp(17px, 1.3vw, 20px);
          font-weight: 850;
          line-height: 1.28;
          letter-spacing: -0.025em;
        }

        .w1g8-stage-items {
          display: grid;
          gap: 9px;
          margin-top: 19px;
        }

        .w1g8-stage-items span {
          position: relative;
          padding-left: 15px;
          color: #9fb0cb;
          font-size: 13px;
          font-weight: 650;
          line-height: 1.42;
        }

        .w1g8-stage-items span::before {
          content: "";
          position: absolute;
          top: 0.62em;
          left: 0;
          width: 5px;
          height: 5px;
          border-radius: 999px;
          background: #4f8fff;
          box-shadow: 0 0 12px rgba(79, 143, 255, 0.46);
        }

        .w1g8-stage-primary .w1g8-stage-items span {
          color: #b8c9e6;
        }

        .w1g8-flow-arrow {
          display: grid;
          place-items: center;
          color: rgba(109, 157, 245, 0.68);
          font-size: 22px;
          font-weight: 500;
        }

        .w1g8-principles {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          margin-top: 28px;
          border-top: 1px solid rgba(97, 143, 228, 0.17);
          border-bottom: 1px solid rgba(97, 143, 228, 0.17);
        }

        .w1g8-principles > div {
          min-width: 0;
          padding: 19px 20px 18px;
          border-right: 1px solid rgba(97, 143, 228, 0.17);
        }

        .w1g8-principles > div:first-child {
          padding-left: 0;
        }

        .w1g8-principles > div:last-child {
          padding-right: 0;
          border-right: 0;
        }

        .w1g8-principles span {
          display: block;
          margin-bottom: 6px;
          color: #5b94ff;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.12em;
        }

        .w1g8-principles strong {
          display: block;
          color: #dce6f7;
          font-size: 13px;
          font-weight: 800;
          line-height: 1.42;
        }

        .w1g8-section + .w1f2-product-section {
          margin-top: 52px !important;
        }

        @media (max-width: 1180px) {
          .w1g8-heading-row {
            grid-template-columns: 1fr;
            gap: 20px;
          }

          .w1g8-heading-row p {
            max-width: 760px;
          }

          .w1g8-flow {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 14px;
          }

          .w1g8-flow-arrow {
            display: none;
          }
        }

        @media (max-width: 760px) {
          .w1g8-section {
            width: min(calc(100% - 20px), 1540px);
            margin-top: 24px;
            padding: 38px 20px 28px;
            border-radius: 26px;
          }

          .w1g8-kicker {
            grid-template-columns: 1fr;
            gap: 8px;
          }

          .w1g8-kicker div {
            display: none;
          }

          .w1g8-heading-row {
            margin-top: 22px;
          }

          .w1g8-heading-row h2 {
            font-size: clamp(36px, 11vw, 50px);
          }

          .w1g8-flow {
            grid-template-columns: 1fr;
            margin-top: 28px;
          }

          .w1g8-stage {
            padding: 20px 18px;
          }

          .w1g8-principles {
            grid-template-columns: 1fr 1fr;
          }

          .w1g8-principles > div,
          .w1g8-principles > div:first-child,
          .w1g8-principles > div:last-child {
            padding: 16px 12px;
            border-right: 0;
            border-bottom: 1px solid rgba(97, 143, 228, 0.14);
          }
        }


        /* =========================================================
           W1G10 — MOBILE + TABLET HOMEPAGE RELEASE PASS
           Desktop is frozen. Responsive-only release hardening for
           ~1024px, ~768px, ~430px and ~390px viewports.
        ========================================================= */

        /* ---------- Tablet header: use the compact navigation before crowding starts ---------- */
        @media (max-width: 1100px) {
          .w1f2-site-header {
            min-height: 72px !important;
            grid-template-columns: auto minmax(0, 1fr) auto auto !important;
            gap: 10px !important;
            padding-left: 18px !important;
            padding-right: 18px !important;
          }

          .w1f2-site-nav {
            display: none !important;
          }

          .w1g6-header-actions {
            display: contents !important;
          }

          .w1g6-sign-in {
            display: none !important;
          }

          .w1f2-site-cta {
            justify-self: end;
            min-height: 44px !important;
            margin-right: 0 !important;
            padding-left: 16px !important;
            padding-right: 16px !important;
            font-size: 11px !important;
          }

          .w1f2-menu-toggle {
            display: inline-grid !important;
            place-items: center;
            width: 44px;
            height: 44px;
            padding: 10px;
            border: 1px solid rgba(104, 155, 228, 0.34);
            border-radius: 13px;
            background: rgba(8, 22, 43, 0.94);
            cursor: pointer;
          }

          .w1f2-menu-toggle span {
            display: block;
            width: 18px;
            height: 2px;
            border-radius: 999px;
            background: #edf5ff;
          }

          .w1f2-mobile-backdrop {
            position: fixed;
            inset: 72px 0 0;
            z-index: 398;
            display: block;
            border: 0;
            background: rgba(1, 6, 15, 0.72);
            backdrop-filter: blur(5px);
            -webkit-backdrop-filter: blur(5px);
            cursor: default;
          }

          .w1f2-mobile-menu {
            position: fixed;
            top: 82px;
            right: 14px;
            left: auto;
            z-index: 399;
            display: grid;
            gap: 3px;
            width: min(420px, calc(100vw - 28px));
            max-height: calc(100vh - 96px);
            overflow-y: auto;
            padding: 12px;
            border: 1px solid rgba(101, 159, 255, 0.28);
            border-radius: 22px;
            background:
              radial-gradient(circle at 92% 4%, rgba(45, 112, 235, 0.18), transparent 34%),
              rgba(4, 14, 30, 0.985);
            box-shadow: 0 30px 80px rgba(0, 0, 0, 0.46);
          }

          .w1f2-mobile-menu > a {
            display: flex;
            align-items: center;
            min-height: 48px;
            padding: 0 13px;
            border-radius: 12px;
            color: #dce8f8;
            text-decoration: none;
            font-size: 14px;
            font-weight: 820;
          }

          .w1f2-mobile-menu > button {
            display: flex;
            align-items: center;
            justify-content: space-between;
            min-height: 52px;
            margin-top: 6px;
            padding: 0 16px;
            border: 1px solid #659fff;
            border-radius: 14px;
            color: #ffffff;
            background: linear-gradient(135deg, #3477ef, #2861d5);
            cursor: pointer;
            font: inherit;
            font-size: 13px;
            font-weight: 900;
          }

          /* Product chapters should stop feeling desktop-compressed on a tablet. */
          .w1f2-platform-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .w1f2-platform-group:last-child {
            grid-column: 1 / -1;
          }
        }

        /* ---------- Small tablet: full-width compact menu and single-column product chapters ---------- */
        @media (max-width: 820px) {
          .w1f2-site-header {
            padding-left: 14px !important;
            padding-right: 14px !important;
          }

          .w1f2-mobile-menu {
            top: 80px;
            right: 12px;
            left: 12px;
            width: auto;
          }

          .w1f2-platform-grid {
            grid-template-columns: 1fr !important;
          }

          .w1f2-platform-group:last-child {
            grid-column: auto;
          }
        }

        /* ---------- Mobile ---------- */
        @media (max-width: 720px) {
          .w1f2-site-header {
            min-height: 68px !important;
            grid-template-columns: auto minmax(0, 1fr) auto auto !important;
            gap: 8px !important;
          }

          .w1f2-mobile-backdrop {
            inset: 68px 0 0;
          }

          .w1f2-mobile-menu {
            top: 78px;
            right: 12px;
            left: 12px;
            width: auto;
            max-height: calc(100vh - 94px);
          }

          .w1a-hero.w1g42-hero {
            padding-left: 16px !important;
            padding-right: 16px !important;
          }

          .w1g42-actions .w1a-primary-cta,
          .w1g42-actions .w1a-secondary-cta {
            width: min(100%, 390px) !important;
          }

          .w1b-section {
            overflow: hidden;
          }

          .w1g8-section + .w1f2-product-section {
            margin-top: 38px !important;
          }

          .w1f2-final-actions,
          .w1e-final-actions {
            width: 100%;
          }
        }

        /* ---------- Phone: make dense horizontal choices swipeable instead of cramped ---------- */
        @media (max-width: 560px) {
          .w1f2-site-header {
            grid-template-columns: auto minmax(0, 1fr) auto !important;
          }

          .w1f2-site-cta {
            display: none !important;
          }

          .w1f2-site-brand {
            font-size: 23px !important;
          }

          .w1b-heading-row h2 {
            font-size: clamp(42px, 11vw, 48px) !important;
          }

          .w1b-role-tabs {
            display: flex !important;
            grid-template-columns: none !important;
            gap: 8px !important;
            overflow-x: auto;
            overflow-y: hidden;
            padding-bottom: 4px;
            scroll-snap-type: x mandatory;
            scrollbar-width: none;
            -webkit-overflow-scrolling: touch;
          }

          .w1b-role-tabs::-webkit-scrollbar {
            display: none;
          }

          .w1b-role-tab {
            flex: 0 0 168px;
            min-width: 168px;
            min-height: 68px !important;
            scroll-snap-align: start;
          }

          .w1g8-heading-row h2 {
            font-size: clamp(34px, 9.6vw, 43px) !important;
          }

          .w1g8-heading-row p {
            font-size: 15px !important;
            line-height: 1.58 !important;
          }

          .w1g8-stage {
            border-radius: 18px;
          }

          .w1g8-principles {
            grid-template-columns: 1fr !important;
          }

          .w1g8-principles > div,
          .w1g8-principles > div:first-child,
          .w1g8-principles > div:last-child {
            padding: 14px 4px !important;
          }

          .w1f2-product-heading h2,
          .w1f2-intelligence-heading h2 {
            font-size: clamp(36px, 10vw, 42px) !important;
          }

          .w1f2-journey-tabs {
            scroll-snap-type: x mandatory;
            -webkit-overflow-scrolling: touch;
          }

          .w1f2-journey-tabs button {
            min-width: 152px !important;
            scroll-snap-align: start;
          }

          .w1f2-product-copy h3 {
            font-size: clamp(31px, 9vw, 40px) !important;
          }

          .w1f2-intelligence-tabs {
            display: grid !important;
            grid-template-columns: 1fr 1fr;
          }

          .w1f2-intelligence-tabs button {
            min-width: 0 !important;
            padding-left: 10px !important;
            padding-right: 10px !important;
            font-size: 11px !important;
          }

          .w1g-about-section .w1e-about-copy h2 {
            font-size: clamp(39px, 10.5vw, 45px) !important;
          }

          .w1g-founder-card h3 {
            font-size: clamp(30px, 8.8vw, 36px) !important;
          }

          .w1g-final-section .w1e-final-actions,
          .w1f2-final-actions {
            display: grid !important;
            grid-template-columns: 1fr;
            justify-items: stretch;
          }

          .w1g-final-section .w1e-final-actions button,
          .w1g-final-section .w1e-final-actions a,
          .w1f2-final-actions button,
          .w1f2-final-actions a {
            width: 100% !important;
            max-width: 390px;
            margin-left: auto;
            margin-right: auto;
          }
        }

        /* ---------- Narrow phone (~390px) ---------- */
        @media (max-width: 410px) {
          .w1f2-site-header {
            padding-left: 12px !important;
            padding-right: 12px !important;
          }

          .w1f2-site-brand {
            font-size: 22px !important;
          }

          .w1f2-menu-toggle {
            width: 40px;
            height: 40px;
            border-radius: 12px;
          }

          .w1a-hero.w1g42-hero {
            padding-top: 42px !important;
          }

          .w1a-hero .w1g42-title {
            font-size: clamp(40px, 11.5vw, 46px) !important;
          }

          .w1g42-lede {
            font-size: 15px !important;
          }

          .w1b-role-tab {
            flex-basis: 154px;
            min-width: 154px;
          }

          .w1g8-section {
            padding-left: 17px !important;
            padding-right: 17px !important;
          }

          .w1f2-product-section,
          .w1f2-intelligence-section {
            padding-left: 16px !important;
            padding-right: 16px !important;
          }

          .w1g-final-section {
            padding-left: 18px !important;
            padding-right: 18px !important;
          }
        }

      `}</style>

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

            <button
              className="w1f2-site-cta"
              type="button"
              onClick={() => setIsDemoOpen(true)}
            >
              Request walkthrough
            </button>
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
              <button
                className="w1a-primary-cta"
                type="button"
                onClick={() => setIsDemoOpen(true)}
              >
                Request private walkthrough
                <span aria-hidden="true">↗</span>
              </button>

              <a className="w1a-secondary-cta" href="/demo">
                Start guided demo
                <span aria-hidden="true">→</span>
              </a>
            </div>

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

              <a className="w1b-open-workspace" href={selectedWorkspace.href}>
                Open {selectedWorkspace.role} workspace
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
                        <a key={action} href={selectedWorkspace.href}>
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
                <a href="/capital-call"><strong>Capital Calls</strong><span>Allocations · approvals · notices</span><i>↗</i></a>
                <a href="/distribution-waterfall"><strong>Distribution Waterfall</strong><span>Waterfall · payouts · communication</span><i>↗</i></a>
                <a href="/debt-lms"><strong>Debt LMS</strong><span>Debt strategy-specific · repayments · notices · borrower tracking</span><i>↗</i></a>
                <a href="/repayment-notice"><strong>Repayment Notices</strong><span>Generation · email queue · audit trail</span><i>↗</i></a>
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
                <a href="/portfolio-intelligence"><strong>Portfolio Intelligence</strong><span>Movement · valuation · repayment risk</span><i>↗</i></a>
                <a href="/compliance-ai"><strong>Compliance & Regulatory</strong><span>Filings · evidence · readiness</span><i>↗</i></a>
                <a href="/activity-engine"><strong>Activity Engine</strong><span>Actions · approvals · operating history</span><i>↗</i></a>
                <a href="/document-studio"><strong>Document Studio</strong><span>Templates · generation · approval · publishing</span><i>↗</i></a>
              </div>
            </div>

            <div className="w1f2-platform-group roadmap">
              <div className="w1f2-platform-status">
                <i />
                <div>
                  <span>EXPANSION ENGINES</span>
                  <strong>Active development + roadmap</strong>
                </div>
              </div>

              <div className="w1f2-platform-items">
                <div><strong>Knowledge Hub</strong><span>Regulations · policies · institutional knowledge</span><em>In development</em></div>
                <div><strong>Bank Reconciliation</strong><span>Matching · exceptions · accounting prep</span><em>In development</em></div>
                <div><strong>Finance Mission Control</strong><span>Priorities · approvals · operating risk</span><em>In development</em></div>
                <div><strong>Fee & Carry Engine</strong><span>Fees · carry accruals · fund economics</span><em>Roadmap</em></div>
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
                  <a href="/managing-partner-ai"><strong>Generate LP deck narrative</strong><i>→</i></a>
                  <a href="/portfolio-intelligence"><strong>Review portfolio risk</strong><i>→</i></a>
                  <a href="/fundraising-ai"><strong>Prepare fundraising update</strong><i>→</i></a>
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
              being built from those workflows outward — a governed fund layer
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
              Contact founder
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