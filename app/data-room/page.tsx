"use client";

import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "../../lib/supabaseClient";
import { useActiveFund } from "../../lib/useActiveFund";
import { useVentiqAuth } from "../../lib/auth/AuthProvider";

const DEFAULT_FUND_NAME = "VENTIQ Growth Fund II";

type DataRow = Record<string, unknown>;

type DataRoomAccessLevel =
  | "All LPs"
  | "Restricted LP Access"
  | "Internal Only"
  | "Prospective LPs Only";

type DataRoomDocument = {
  id: string;
  fund_name: string;
  source_batch_id: string;
  investor_code: string | null;
  investor_name: string | null;
  document_name: string;
  file_name: string;
  detected_type: string;
  suggested_folder: string;
  access_level: DataRoomAccessLevel;
  storage_bucket: string;
  storage_path: string;
  file_size: number;
  mime_type: string;
  document_status: string;
  ddq_impact: string;
  metadata: Record<string, unknown> | null;
  created_by_email: string | null;
  imported_at: string;
  updated_at: string;
};

type SourceBatch = {
  id: string;
  fund_name: string;
  batch_name: string | null;
  processing_status: string | null;
  processed_at: string | null;
};

type DocumentApiResponse = {
  documents?: DataRoomDocument[];
  document?: DataRoomDocument;
  sourceBatch?: SourceBatch | null;
  signedUrl?: string;
  expiresInSeconds?: number;
  count?: number;
  error?: string;
};

type UploadApiResponse = {
  message?: string;
  sourceBatch?: SourceBatch | null;
  uploadedCount?: number;
  failedCount?: number;
  documents?: DataRoomDocument[];
  failures?: Array<{ fileName: string; error: string }>;
  error?: string;
};

type WorkflowApiResponse = {
  sourceBatch?: SourceBatch | null;
  engagementEvents?: DataRow[];
  questions?: DataRow[];
  engagementEvent?: DataRow;
  question?: DataRow;
  counts?: {
    engagementEvents: number;
    questions: number;
    openQuestions: number;
    answeredQuestions: number;
  };
  message?: string;
  warning?: string;
  error?: string;
};

type UploadPreview = {
  id: string;
  file: File;
  name: string;
  size: number;
  detectedType: string;
  suggestedFolder: string;
  accessLevel: DataRoomAccessLevel;
  investorCode: string;
  investorName: string;
  ddqImpact: string;
  note: string;
  status: "Ready" | "Uploading" | "Uploaded" | "Failed";
  error: string;
};

type FolderDefinition = {
  name: string;
  description: string;
  expectedDocuments: string[];
};

const DATA_ROOM_FOLDERS: FolderDefinition[] = [
  {
    name: "Fund Overview",
    description: "Fund deck, strategy, sponsor profile and fund summary.",
    expectedDocuments: ["Fund Deck", "Strategy Note", "Sponsor Profile"],
  },
  {
    name: "Legal & Compliance",
    description: "PPM, trust deed, contribution documents and regulatory setup.",
    expectedDocuments: ["PPM", "Trust Deed", "SEBI / GIFT Registration"],
  },
  {
    name: "Track Record & Performance",
    description: "IRR, DPI, TVPI, MOIC and historical fund performance.",
    expectedDocuments: ["Track Record", "Performance Summary", "Valuation Policy"],
  },
  {
    name: "Portfolio Summary",
    description: "Portfolio overview, sector exposure, key updates and risks.",
    expectedDocuments: ["Portfolio Summary", "Company Updates", "Risk Summary"],
  },
  {
    name: "Investor Reporting Samples",
    description: "Sample capital calls, distribution notices, SOAs and reports.",
    expectedDocuments: ["Capital Call Notice", "Distribution Notice", "SOA"],
  },
  {
    name: "Tax & Regulatory",
    description: "Tax notes, 64C / 64D, compliance filings and circulars.",
    expectedDocuments: ["64C", "64D", "Tax Note"],
  },
  {
    name: "DDQ & Q&A",
    description: "LP diligence questionnaires, responses and question trackers.",
    expectedDocuments: ["DDQ", "Q&A Tracker", "Operational DD"],
  },
  {
    name: "Subscription Documents",
    description: "Investor onboarding, subscription and KYC documents.",
    expectedDocuments: ["Subscription Pack", "KYC Checklist", "Onboarding Guide"],
  },
  {
    name: "General Investor Documents",
    description: "Other diligence and investor reference documents.",
    expectedDocuments: ["Other Supporting Documents"],
  },
];

const DATA_ROOM_FAQ = [
  {
    question: "Can a fund use only the Data Room without adopting all of VENTIQ?",
    answer:
      "Yes. The Data Room and Investor Portal can be adopted as standalone modules, with historical documents uploaded and organised before the fund adopts additional VENTIQ workflows.",
  },
  {
    question: "Are uploaded documents publicly accessible?",
    answer:
      "No. Documents are stored in a private Supabase bucket. VENTIQ generates short-lived signed links only after an authenticated permission check.",
  },
  {
    question: "How are documents connected to the fund?",
    answer:
      "Every document is linked to the active fund and the latest completed authoritative canonical source batch.",
  },
  {
    question: "Can a document be restricted to one investor?",
    answer:
      "Yes. The upload queue can map a document to an investor code and investor name and assign an access level before upload.",
  },
];

function getString(row: DataRow | undefined | null, keys: string[], fallback = "") {
  if (!row) return fallback;

  for (const key of keys) {
    const value = row[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return fallback;
}

function normalizeText(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function getNumber(row: DataRow | undefined | null, keys: string[]) {
  if (!row) return 0;

  for (const key of keys) {
    const value = row[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (
      typeof value === "string" &&
      value.trim() &&
      !Number.isNaN(Number(value))
    ) {
      return Number(value);
    }
  }

  return 0;
}

function formatDate(value: unknown) {
  const text = normalizeText(value);
  if (!text) return "-";

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value: unknown) {
  const text = normalizeText(value);
  if (!text) return "-";

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFileSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) return "0 B";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function shortBatchId(value: string) {
  if (!value) return "-";
  if (value.length <= 12) return value;
  return `…${value.slice(-12)}`;
}

function detectDocumentType(fileName: string) {
  const value = fileName.toLowerCase();

  if (value.includes("ppm") || value.includes("private placement")) {
    return "PPM / Fund Offering Document";
  }
  if (value.includes("ddq")) return "DDQ Response";
  if (value.includes("track") || value.includes("irr")) return "Track Record";
  if (value.includes("capital call")) return "Capital Call Notice";
  if (value.includes("distribution")) return "Distribution Notice";
  if (value.includes("soa") || value.includes("statement of account")) {
    return "Statement of Account";
  }
  if (
    value.includes("tax") ||
    value.includes("64c") ||
    value.includes("64d")
  ) {
    return "Tax / Regulatory Document";
  }
  if (value.includes("deck") || value.includes("presentation")) {
    return "Fundraising Deck";
  }
  if (
    value.includes("compliance") ||
    value.includes("sebi") ||
    value.includes("gift")
  ) {
    return "Compliance Document";
  }
  if (value.includes("portfolio")) return "Portfolio Summary";
  if (value.includes("subscription") || value.includes("kyc")) {
    return "Subscription / KYC Document";
  }

  return "Investor Document";
}

function suggestFolder(documentType: string) {
  if (documentType.includes("DDQ")) return "DDQ & Q&A";
  if (documentType.includes("Track")) return "Track Record & Performance";
  if (documentType.includes("Capital Call")) return "Investor Reporting Samples";
  if (documentType.includes("Distribution")) return "Investor Reporting Samples";
  if (documentType.includes("Statement")) return "Investor Reporting Samples";
  if (documentType.includes("Tax")) return "Tax & Regulatory";
  if (documentType.includes("Compliance")) return "Legal & Compliance";
  if (documentType.includes("Deck")) return "Fund Overview";
  if (documentType.includes("PPM")) return "Legal & Compliance";
  if (documentType.includes("Portfolio")) return "Portfolio Summary";
  if (documentType.includes("Subscription")) return "Subscription Documents";

  return "General Investor Documents";
}

function getDDQImpact(documentType: string, folder: string) {
  if (folder === "DDQ & Q&A") {
    return "Can support DDQ response drafting";
  }
  if (folder === "Track Record & Performance") {
    return "Can support performance DDQ questions";
  }
  if (folder === "Legal & Compliance") {
    return "Can support legal and compliance diligence";
  }
  if (folder === "Investor Reporting Samples") {
    return "Can support operations and investor reporting DDQ questions";
  }
  if (folder === "Tax & Regulatory") {
    return "Can support tax and regulatory DDQ questions";
  }
  if (folder === "Fund Overview") {
    return "Can support strategy, sponsor and fund overview questions";
  }
  if (folder === "Portfolio Summary") {
    return "Can support portfolio construction, monitoring and risk questions";
  }
  if (documentType.includes("Subscription")) {
    return "Can support investor onboarding and KYC diligence";
  }

  return "Available as supporting diligence evidence";
}

function getInvestorCode(row: DataRow) {
  return getString(row, ["investor_code", "code"], "");
}

function getInvestorName(row: DataRow) {
  return getString(row, ["investor_name", "name"], "Unknown Investor");
}

function documentMatchesSearch(document: DataRoomDocument, search: string) {
  if (!search.trim()) return true;
  const value = search.trim().toLowerCase();

  return [
    document.document_name,
    document.file_name,
    document.detected_type,
    document.suggested_folder,
    document.access_level,
    document.investor_code,
    document.investor_name,
    document.ddq_impact,
  ]
    .filter(Boolean)
    .some((field) => String(field).toLowerCase().includes(value));
}

export default function DataRoomPage() {
  const {
    activeFundName,
    setActiveFundName,
    isReady: fundContextReady,
  } = useActiveFund(DEFAULT_FUND_NAME);
  const {
    session,
    activeRole,
    fundAccess,
    loading: authLoading,
  } = useVentiqAuth();
  const isInvestorUser = activeRole === "investor";

  const investorAllowedFunds = useMemo(() => {
    if (!isInvestorUser) return [];

    return Array.from(
      new Set(
        fundAccess
          .filter(
            (access) =>
              access.status === "Active" &&
              Boolean(access.can_view) &&
              Boolean(access.fund_name?.trim())
          )
          .map((access) => access.fund_name.trim())
      )
    ).sort();
  }, [fundAccess, isInvestorUser]);

  const [availableFunds, setAvailableFunds] = useState<string[]>([
    DEFAULT_FUND_NAME,
  ]);
  const [activationStatus, setActivationStatus] = useState("Checking");
  const [activationReadiness, setActivationReadiness] = useState(0);

  const [sourceBatch, setSourceBatch] = useState<SourceBatch | null>(null);
  const [documents, setDocuments] = useState<DataRoomDocument[]>([]);
  const [investors, setInvestors] = useState<DataRow[]>([]);
  const [engagementEvents, setEngagementEvents] = useState<DataRow[]>([]);
  const [ddqQuestions, setDdqQuestions] = useState<DataRow[]>([]);

  const [uploadQueue, setUploadQueue] = useState<UploadPreview[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");

  const [folderFilter, setFolderFilter] = useState("All folders");
  const [accessFilter, setAccessFilter] = useState("All access levels");
  const [searchText, setSearchText] = useState("");

  const [loading, setLoading] = useState(true);
  const [downloadingDocumentId, setDownloadingDocumentId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [workflowBusyKey, setWorkflowBusyKey] = useState("");
  const [workflowMessage, setWorkflowMessage] = useState("");

  const [engagementInvestorCode, setEngagementInvestorCode] = useState("");
  const [questionInvestorCode, setQuestionInvestorCode] = useState("");
  const [questionDocumentId, setQuestionDocumentId] = useState("");
  const [questionCategory, setQuestionCategory] = useState("General");
  const [questionText, setQuestionText] = useState("");
  const [questionAssignedTo, setQuestionAssignedTo] = useState("");
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});
  const [assigneeDrafts, setAssigneeDrafts] = useState<Record<string, string>>(
    {}
  );

  const accessToken = session?.access_token ?? "";

  async function readJson<T>(response: Response): Promise<T> {
    const text = await response.text();

    if (!text) {
      return {} as T;
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(text || `Request failed with status ${response.status}`);
    }
  }

  function applyWorkflowResult(result: WorkflowApiResponse) {
    const nextEngagementEvents = result.engagementEvents ?? [];
    const nextQuestions = result.questions ?? [];

    setEngagementEvents(nextEngagementEvents);
    setDdqQuestions(nextQuestions);

    const nextAnswerDrafts: Record<string, string> = {};
    const nextAssigneeDrafts: Record<string, string> = {};

    nextQuestions.forEach((question) => {
      const questionId = getString(question, ["id"], "");

      if (!questionId) return;

      nextAnswerDrafts[questionId] = getString(question, ["answer"], "");
      nextAssigneeDrafts[questionId] = getString(
        question,
        ["assigned_to"],
        ""
      );
    });

    setAnswerDrafts(nextAnswerDrafts);
    setAssigneeDrafts(nextAssigneeDrafts);
  }

  async function loadWorkflowState(
    sourceBatchId: string,
    showLoading = true
  ) {
    if (!accessToken || !sourceBatchId) {
      setEngagementEvents([]);
      setDdqQuestions([]);
      return;
    }

    if (showLoading) {
      setWorkflowLoading(true);
    }

    try {
      const response = await fetch(
        `/api/data-room/workflow?fundName=${encodeURIComponent(
          activeFundName
        )}&sourceBatchId=${encodeURIComponent(sourceBatchId)}&limit=500`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
        }
      );

      const result = await readJson<WorkflowApiResponse>(response);

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to load LP engagement and DDQ records."
        );
      }

      applyWorkflowResult(result);
    } finally {
      if (showLoading) {
        setWorkflowLoading(false);
      }
    }
  }

  async function callWorkflowApi(
    method: "POST" | "PATCH",
    body: Record<string, unknown>
  ) {
    const response = await fetch("/api/data-room/workflow", {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const result = await readJson<WorkflowApiResponse>(response);

    if (!response.ok) {
      throw new Error(
        result.error || "Unable to update the Data Room workflow."
      );
    }

    return result;
  }

  async function loadDataRoom() {
    if (!fundContextReady || authLoading) return;

    if (isInvestorUser) {
      if (investorAllowedFunds.length === 0) {
        setSourceBatch(null);
        setDocuments([]);
        setInvestors([]);
        setEngagementEvents([]);
        setDdqQuestions([]);
        setErrorMessage(
          "No active governed fund access is available for this investor account."
        );
        setLoading(false);
        return;
      }

      const hasCurrentFundAccess = investorAllowedFunds.some(
        (fundName) =>
          fundName.trim().toLowerCase() ===
          activeFundName.trim().toLowerCase()
      );

      if (!hasCurrentFundAccess) {
        // The fund-lock effect below will move the page to the investor's
        // governed fund before any Data Room API request is released.
        setLoading(true);
        return;
      }
    }

    if (!isSupabaseConfigured || !supabase) {
      setErrorMessage(
        "The Investor Data Room is unavailable because Supabase is not configured."
      );
      setLoading(false);
      return;
    }

    if (!accessToken) {
      setErrorMessage("Please sign in to access the Investor Data Room.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage("");
    setUploadMessage("");

    try {
      const db = supabase as any;

      const [fundOptionsResult, activationResult] = await Promise.all([
        db.from("fund_master").select("fund_name").order("fund_name"),
        db
          .from("fund_activation_status")
          .select("status, readiness_score")
          .eq("fund_name", activeFundName)
          .maybeSingle(),
      ]);

      const fundOptions = Array.from(
        new Set(
          [
            DEFAULT_FUND_NAME,
            activeFundName,
            ...((fundOptionsResult.data ?? []) as DataRow[]).map((row) =>
              getString(row, ["fund_name"], "")
            ),
          ].filter(Boolean)
        )
      ).sort((left, right) => left.localeCompare(right));

      setAvailableFunds(fundOptions);
      setActivationStatus(
        activationResult.error
          ? "Unavailable"
          : getString(
              activationResult.data as DataRow | null,
              ["status"],
              "Setup Not Started"
            )
      );
      setActivationReadiness(
        activationResult.error
          ? 0
          : getNumber(activationResult.data as DataRow | null, [
              "readiness_score",
            ])
      );

      const documentResponse = await fetch(
        `/api/data-room/documents?fundName=${encodeURIComponent(
          activeFundName
        )}&limit=500`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
        }
      );

      const documentResult =
        await readJson<DocumentApiResponse>(documentResponse);

      if (!documentResponse.ok) {
        throw new Error(
          documentResult.error || "Unable to load data room documents."
        );
      }

      if (isInvestorUser) {
        setActivationStatus("Active");
        setActivationReadiness(100);
      }

      const resolvedBatch = documentResult.sourceBatch ?? null;
      const resolvedDocuments = documentResult.documents ?? [];

      setSourceBatch(resolvedBatch);
      setDocuments(resolvedDocuments);

      if (!resolvedBatch?.id) {
        setInvestors([]);
        setEngagementEvents([]);
        setDdqQuestions([]);
        setLoading(false);
        return;
      }

      const investorsResult = await db
        .from("investor_master")
        .select("*")
        .eq("fund_name", activeFundName)
        .eq("source_batch_id", resolvedBatch.id)
        .order("investor_code", { ascending: true });

      const loadedInvestors = investorsResult.error
        ? []
        : ((investorsResult.data ?? []) as DataRow[]);

      setInvestors(loadedInvestors);

      const firstInvestorCode = loadedInvestors[0]
        ? getInvestorCode(loadedInvestors[0])
        : "";

      setEngagementInvestorCode((current) => current || firstInvestorCode);
      setQuestionInvestorCode((current) => current || firstInvestorCode);

      await loadWorkflowState(resolvedBatch.id, false);
    } catch (error) {
      setSourceBatch(null);
      setDocuments([]);
      setInvestors([]);
      setEngagementEvents([]);
      setDdqQuestions([]);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load the Investor Data Room."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isInvestorUser || authLoading) return;

    if (investorAllowedFunds.length === 0) {
      setAvailableFunds([]);
      return;
    }

    setAvailableFunds(investorAllowedFunds);

    const hasCurrentFundAccess = investorAllowedFunds.some(
      (fundName) =>
        fundName.trim().toLowerCase() === activeFundName.trim().toLowerCase()
    );

    if (!hasCurrentFundAccess) {
      setActiveFundName(investorAllowedFunds[0]);
    }
  }, [
    activeFundName,
    authLoading,
    investorAllowedFunds,
    isInvestorUser,
    setActiveFundName,
  ]);

  useEffect(() => {
    loadDataRoom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeFundName,
    accessToken,
    authLoading,
    fundContextReady,
    investorAllowedFunds,
    isInvestorUser,
  ]);

  const metrics = useMemo(() => {
    const coveredFolders = new Set(
      documents
        .map((document) => document.suggested_folder)
        .filter(Boolean)
    );

    const requiredFolders = DATA_ROOM_FOLDERS.filter(
      (folder) => folder.name !== "General Investor Documents"
    );
    const coveredRequiredFolders = requiredFolders.filter((folder) =>
      coveredFolders.has(folder.name)
    ).length;

    const folderCoverage =
      requiredFolders.length > 0
        ? Math.round((coveredRequiredFolders / requiredFolders.length) * 100)
        : 0;

    const investorMapped = documents.filter(
      (document) => document.investor_code || document.investor_name
    ).length;
    const externalAccess = documents.filter(
      (document) => document.access_level !== "Internal Only"
    ).length;
    const openQuestions = ddqQuestions.filter(
      (question) =>
        getString(question, ["status"], "Open").toLowerCase() !== "answered"
    ).length;
    const answeredQuestions = ddqQuestions.length - openQuestions;

    const readinessScore = Math.min(
      100,
      Math.round(
        folderCoverage * 0.55 +
          Math.min(documents.length * 2, 20) +
          (investors.length > 0 ? 10 : 0) +
          (externalAccess > 0 ? 5 : 0) +
          (openQuestions === 0 ? 10 : Math.max(0, 10 - openQuestions * 2))
      )
    );

    return {
      totalDocuments: documents.length,
      investorMapped,
      externalAccess,
      internalOnly: documents.length - externalAccess,
      coveredFolders: coveredRequiredFolders,
      totalRequiredFolders: requiredFolders.length,
      folderCoverage,
      readinessScore,
      engagementCount: engagementEvents.length,
      openQuestions,
      answeredQuestions,
      totalSize: documents.reduce(
        (sum, document) => sum + Number(document.file_size || 0),
        0
      ),
    };
  }, [documents, investors.length, engagementEvents.length, ddqQuestions]);

  const filteredDocuments = useMemo(() => {
    return documents.filter((document) => {
      const folderMatches =
        folderFilter === "All folders" ||
        document.suggested_folder === folderFilter;
      const accessMatches =
        accessFilter === "All access levels" ||
        document.access_level === accessFilter;

      return (
        folderMatches &&
        accessMatches &&
        documentMatchesSearch(document, searchText)
      );
    });
  }, [documents, folderFilter, accessFilter, searchText]);

  const investorMap = useMemo(() => {
    return new Map(
      investors.map((investor) => [
        getInvestorCode(investor),
        getInvestorName(investor),
      ])
    );
  }, [investors]);

  function handleFilesSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;

    const newPreviews: UploadPreview[] = Array.from(fileList).map((file) => {
      const detectedType = detectDocumentType(file.name);
      const suggestedFolder = suggestFolder(detectedType);

      return {
        id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
        file,
        name: file.name,
        size: file.size,
        detectedType,
        suggestedFolder,
        accessLevel: "Internal Only",
        investorCode: "",
        investorName: "",
        ddqImpact: getDDQImpact(detectedType, suggestedFolder),
        note: "",
        status: "Ready",
        error: "",
      };
    });

    setUploadQueue((current) => [...newPreviews, ...current]);
    setUploadMessage(
      `${newPreviews.length} document${
        newPreviews.length === 1 ? "" : "s"
      } staged for secure upload.`
    );
  }

  function updateUploadPreview(
    fileId: string,
    changes: Partial<UploadPreview>
  ) {
    setUploadQueue((current) =>
      current.map((item) =>
        item.id === fileId ? { ...item, ...changes } : item
      )
    );
  }

  function handleFolderChange(fileId: string, folder: string) {
    const preview = uploadQueue.find((item) => item.id === fileId);
    if (!preview) return;

    updateUploadPreview(fileId, {
      suggestedFolder: folder,
      ddqImpact: getDDQImpact(preview.detectedType, folder),
    });
  }

  function handleInvestorChange(fileId: string, investorCode: string) {
    updateUploadPreview(fileId, {
      investorCode,
      investorName: investorCode ? investorMap.get(investorCode) ?? "" : "",
    });
  }

  function removeUploadPreview(fileId: string) {
    setUploadQueue((current) =>
      current.filter((item) => item.id !== fileId)
    );
  }

  async function uploadDocuments() {
    const readyFiles = uploadQueue.filter(
      (item) => item.status === "Ready" || item.status === "Failed"
    );

    if (readyFiles.length === 0) {
      setUploadMessage("No documents are ready for upload.");
      return;
    }

    if (!accessToken) {
      setUploadMessage("Please sign in before uploading documents.");
      return;
    }

    setIsUploading(true);
    setUploadMessage("Uploading documents to the private data room...");

    setUploadQueue((current) =>
      current.map((item) =>
        readyFiles.some((ready) => ready.id === item.id)
          ? { ...item, status: "Uploading", error: "" }
          : item
      )
    );

    try {
      const formData = new FormData();
      formData.append("fundName", activeFundName);

      if (sourceBatch?.id) {
        formData.append("sourceBatchId", sourceBatch.id);
      }

      readyFiles.forEach((item) => {
        formData.append("files", item.file);
        formData.append(
          "documentNames",
          item.name.replace(/\.[^.]+$/, "")
        );
        formData.append("detectedTypes", item.detectedType);
        formData.append("folders", item.suggestedFolder);
        formData.append("accessLevels", item.accessLevel);
        formData.append("investorCodes", item.investorCode);
        formData.append("investorNames", item.investorName);
        formData.append("ddqImpacts", item.ddqImpact);
        formData.append("notes", item.note);
      });

      const response = await fetch("/api/data-room/documents", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });

      const result = await readJson<UploadApiResponse>(response);

      if (!response.ok && (result.uploadedCount ?? 0) === 0) {
        throw new Error(result.error || result.message || "Upload failed.");
      }

      const uploadedNames = new Set(
        (result.documents ?? []).map((document) => document.file_name)
      );
      const failureMap = new Map(
        (result.failures ?? []).map((failure) => [
          failure.fileName,
          failure.error,
        ])
      );

      setUploadQueue((current) =>
        current.map((item) => {
          if (!readyFiles.some((ready) => ready.id === item.id)) return item;

          if (uploadedNames.has(item.name)) {
            return { ...item, status: "Uploaded", error: "" };
          }

          const failure = failureMap.get(item.name);
          return {
            ...item,
            status: failure ? "Failed" : "Uploaded",
            error: failure ?? "",
          };
        })
      );

      setUploadMessage(
        result.message ||
          `${result.uploadedCount ?? 0} document(s) uploaded; ${
            result.failedCount ?? 0
          } failed.`
      );

      await loadDataRoom();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Document upload failed.";

      setUploadQueue((current) =>
        current.map((item) =>
          item.status === "Uploading"
            ? { ...item, status: "Failed", error: message }
            : item
        )
      );
      setUploadMessage(message);
    } finally {
      setIsUploading(false);
    }
  }

  function getSelectedInvestor(investorCode: string) {
    return investors.find(
      (investor) => getInvestorCode(investor) === investorCode
    );
  }

  function getInvestorEmail(investor: DataRow | undefined) {
    return getString(investor, ["email", "investor_email"], "");
  }

  async function recordEngagement(
    document: DataRoomDocument,
    action: "Viewed" | "Downloaded"
  ) {
    if (!sourceBatch?.id) {
      throw new Error("The authoritative source batch is unavailable.");
    }

    const selectedInvestor = getSelectedInvestor(engagementInvestorCode);
    const busyKey = `engagement-${action}-${document.id}`;

    setWorkflowBusyKey(busyKey);
    setWorkflowMessage("");

    try {
      const result = await callWorkflowApi("POST", {
        operation: "record_engagement",
        fundName: activeFundName,
        sourceBatchId: sourceBatch.id,
        documentId: document.id,
        documentName: document.document_name,
        investorCode: selectedInvestor
          ? getInvestorCode(selectedInvestor)
          : "",
        investorName: selectedInvestor
          ? getInvestorName(selectedInvestor)
          : "Prospective LP",
        investorEmail: getInvestorEmail(selectedInvestor),
        action,
        note:
          action === "Viewed"
            ? "LP document view recorded from the Investor Data Room."
            : "LP private document download recorded from the Investor Data Room.",
      });

      setWorkflowMessage(
        result.message || `${action} event recorded successfully.`
      );
      await loadWorkflowState(sourceBatch.id, false);
    } finally {
      setWorkflowBusyKey("");
    }
  }

  async function createDdqQuestion() {
    if (!sourceBatch?.id) {
      setWorkflowMessage(
        "The authoritative source batch is unavailable for this question."
      );
      return;
    }

    if (!questionText.trim()) {
      setWorkflowMessage("Enter the LP or DDQ question first.");
      return;
    }

    const selectedInvestor = getSelectedInvestor(questionInvestorCode);
    const selectedDocument = documents.find(
      (document) => document.id === questionDocumentId
    );

    setWorkflowBusyKey("create-question");
    setWorkflowMessage("");

    try {
      const result = await callWorkflowApi("POST", {
        operation: "create_question",
        fundName: activeFundName,
        sourceBatchId: sourceBatch.id,
        documentId: selectedDocument?.id || "",
        documentName:
          selectedDocument?.document_name || "Investor Data Room",
        investorCode: selectedInvestor
          ? getInvestorCode(selectedInvestor)
          : "",
        investorName: selectedInvestor
          ? getInvestorName(selectedInvestor)
          : "Prospective LP",
        investorEmail: getInvestorEmail(selectedInvestor),
        category: questionCategory,
        question: questionText,
        assignedTo: questionAssignedTo,
        status: "Open",
      });

      setQuestionText("");
      setWorkflowMessage(
        [result.message, result.warning].filter(Boolean).join(" ")
      );
      await loadWorkflowState(sourceBatch.id, false);
    } catch (error) {
      setWorkflowMessage(
        error instanceof Error
          ? error.message
          : "Unable to create the DDQ question."
      );
    } finally {
      setWorkflowBusyKey("");
    }
  }

  async function updateDdqQuestion(
    question: DataRow,
    operation:
      | "assign_question"
      | "save_draft_answer"
      | "approve_answer"
      | "reopen_question"
  ) {
    if (!sourceBatch?.id) {
      setWorkflowMessage(
        "The authoritative source batch is unavailable for this update."
      );
      return;
    }

    const questionId = getString(question, ["id"], "");

    if (!questionId) {
      setWorkflowMessage("This DDQ question does not have a valid ID.");
      return;
    }

    const busyKey = `${operation}-${questionId}`;
    setWorkflowBusyKey(busyKey);
    setWorkflowMessage("");

    try {
      const result = await callWorkflowApi("PATCH", {
        operation,
        fundName: activeFundName,
        sourceBatchId: sourceBatch.id,
        questionId,
        assignedTo: assigneeDrafts[questionId] || "",
        answer: answerDrafts[questionId] || "",
      });

      setWorkflowMessage(
        result.message || "DDQ question updated successfully."
      );
      await loadWorkflowState(sourceBatch.id, false);
    } catch (error) {
      setWorkflowMessage(
        error instanceof Error
          ? error.message
          : "Unable to update the DDQ question."
      );
    } finally {
      setWorkflowBusyKey("");
    }
  }

  async function downloadDocument(document: DataRoomDocument) {
    if (!accessToken) {
      setErrorMessage("Please sign in before downloading documents.");
      return;
    }

    setDownloadingDocumentId(document.id);
    setErrorMessage("");

    try {
      const response = await fetch(
        `/api/data-room/documents?fundName=${encodeURIComponent(
          activeFundName
        )}&sourceBatchId=${encodeURIComponent(
          document.source_batch_id
        )}&documentId=${encodeURIComponent(document.id)}`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
        }
      );

      const result = await readJson<DocumentApiResponse>(response);

      if (!response.ok || !result.signedUrl) {
        throw new Error(
          result.error || "Unable to create a private download link."
        );
      }

      window.open(result.signedUrl, "_blank", "noopener,noreferrer");

      try {
        await recordEngagement(document, "Downloaded");
      } catch (workflowError) {
        setWorkflowMessage(
          workflowError instanceof Error
            ? `The file opened, but the download event was not recorded: ${workflowError.message}`
            : "The file opened, but the download event was not recorded."
        );
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to download this document."
      );
    } finally {
      setDownloadingDocumentId("");
    }
  }

  function clearCompletedUploads() {
    setUploadQueue((current) =>
      current.filter((item) => item.status !== "Uploaded")
    );
  }

  const readinessRecommendation = useMemo(() => {
    if (metrics.totalDocuments === 0) {
      return "Upload the first fund overview, legal, track-record and investor-reporting documents.";
    }

    if (metrics.coveredFolders < metrics.totalRequiredFolders) {
      const missing = DATA_ROOM_FOLDERS.filter(
        (folder) =>
          folder.name !== "General Investor Documents" &&
          !documents.some(
            (document) => document.suggested_folder === folder.name
          )
      );

      return `Complete folder coverage next: ${missing
        .slice(0, 3)
        .map((folder) => folder.name)
        .join(", ")}${missing.length > 3 ? " and others" : ""}.`;
    }

    if (metrics.externalAccess === 0) {
      return "Review document access levels and approve selected documents for LP visibility.";
    }

    if (metrics.openQuestions > 0) {
      return `Resolve ${metrics.openQuestions} open DDQ question${
        metrics.openQuestions === 1 ? "" : "s"
      } before marking the room diligence-ready.`;
    }

    return "Document coverage is ready. The next workflow is secure LP engagement and DDQ response management.";
  }, [metrics, documents]);

  const faqStructuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: DATA_ROOM_FAQ.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };


  if (isInvestorUser) {
    return (
      <main className="app-page">
        <section className="app-shell">
          <div className="app-header">
            <div>
              <p className="eyebrow">VENTIQ Investor Experience</p>
              <h1>My Investor Data Room</h1>
              <p>
                Secure access to documents and DDQ records explicitly shared
                with your authenticated investor account.
              </p>
            </div>

            <a className="back-link" href="/investor-portal">
              Back to Investor Portal
            </a>
          </div>

          <div
            className="preview-card"
            style={{ marginBottom: 18, padding: 22 }}
          >
            <div className="section-heading-row">
              <div>
                <p className="eyebrow">Active Fund Context</p>
                <h2 style={{ marginBottom: 8 }}>{activeFundName}</h2>
                <p style={{ margin: 0 }}>
                  Activation: <strong>{activationStatus}</strong>
                  {activationReadiness > 0
                    ? ` · ${activationReadiness.toFixed(0)}% activation readiness`
                    : ""}
                </p>
              </div>

              <span className="small-pill">
                Investor access · Authenticated
              </span>
            </div>
          </div>

          {sourceBatch && !loading && (
            <div className="sample-data-ribbon">
              Investor-scoped data room · canonical batch{" "}
              {shortBatchId(sourceBatch.id)}
            </div>
          )}

          {loading && (
            <div className="preview-card">
              <h2>Preparing your Data Room...</h2>
              <p>
                VENTIQ is loading only documents and DDQ records entitled to
                this investor login.
              </p>
            </div>
          )}

          {!loading && errorMessage && (
            <div className="preview-card">
              <h2>Data Room Message</h2>
              <div className="explain-box">{errorMessage}</div>
            </div>
          )}

          {!loading && !errorMessage && (
            <>
              <div className="preview-card">
                <div className="section-heading-row">
                  <div>
                    <p className="eyebrow">RLS + API Isolated</p>
                    <h2>Your Private Document Library</h2>
                    <p>
                      Only documents shared with your entitled investor
                      identity, plus fund-level documents marked for all LPs,
                      are returned to this browser.
                    </p>
                  </div>

                  <button type="button" onClick={loadDataRoom}>
                    Refresh Library
                  </button>
                </div>

                <div className="impact-grid">
                  <div className="impact-card">
                    <h3>{documents.length}</h3>
                    <p>Documents available to you</p>
                  </div>
                  <div className="impact-card">
                    <h3>{investors.length}</h3>
                    <p>Entitled investor entities</p>
                  </div>
                  <div className="impact-card">
                    <h3>{ddqQuestions.length}</h3>
                    <p>Your DDQ questions</p>
                  </div>
                  <div className="impact-card">
                    <h3>{engagementEvents.length}</h3>
                    <p>Your recorded activity</p>
                  </div>
                </div>

                {documents.length === 0 && (
                  <div className="explain-box">
                    No documents are currently shared with this investor
                    account. Internal-only and other-investor documents remain
                    unavailable.
                  </div>
                )}

                {documents.length > 0 && (
                  <div className="review-table-wrap">
                    <table className="review-table">
                      <thead>
                        <tr>
                          <th>Document</th>
                          <th>Folder</th>
                          <th>Access</th>
                          <th>Investor</th>
                          <th>Uploaded</th>
                          <th>Private File</th>
                        </tr>
                      </thead>
                      <tbody>
                        {documents.map((document) => (
                          <tr key={document.id}>
                            <td>
                              <strong>{document.document_name}</strong>
                              <br />
                              <span>{document.file_name}</span>
                            </td>
                            <td>{document.suggested_folder}</td>
                            <td>
                              <span className="small-pill">
                                {document.access_level}
                              </span>
                            </td>
                            <td>
                              {document.investor_code
                                ? `${document.investor_code} · ${
                                    document.investor_name || "Mapped investor"
                                  }`
                                : "All entitled LPs"}
                            </td>
                            <td>{formatDateTime(document.imported_at)}</td>
                            <td>
                              <button
                                type="button"
                                disabled={
                                  downloadingDocumentId === document.id
                                }
                                onClick={() => downloadDocument(document)}
                              >
                                {downloadingDocumentId === document.id
                                  ? "Creating Link..."
                                  : "Download"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="preview-card">
                <div className="section-heading-row">
                  <div>
                    <h2>My DDQ & Q&A</h2>
                    <p>
                      Ask a diligence question against your investor identity.
                      Internal assignment, drafting and approval controls remain
                      with the fund team.
                    </p>
                  </div>

                  {sourceBatch?.id && (
                    <button
                      type="button"
                      disabled={workflowLoading}
                      onClick={() =>
                        loadWorkflowState(sourceBatch.id).catch((error) =>
                          setWorkflowMessage(
                            error instanceof Error
                              ? error.message
                              : "Unable to refresh your DDQ records."
                          )
                        )
                      }
                    >
                      {workflowLoading ? "Refreshing..." : "Refresh"}
                    </button>
                  )}
                </div>

                {workflowMessage && (
                  <div className="explain-box">{workflowMessage}</div>
                )}

                <div className="form-card">
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(220px, 1fr))",
                      gap: 12,
                    }}
                  >
                    {investors.length > 1 && (
                      <label>
                        Investor entity
                        <select
                          value={questionInvestorCode}
                          onChange={(event) =>
                            setQuestionInvestorCode(event.target.value)
                          }
                        >
                          {investors.map((investor) => {
                            const code = getInvestorCode(investor);

                            return (
                              <option key={code} value={code}>
                                {code} · {getInvestorName(investor)}
                              </option>
                            );
                          })}
                        </select>
                      </label>
                    )}

                    <label>
                      Related document
                      <select
                        value={questionDocumentId}
                        onChange={(event) =>
                          setQuestionDocumentId(event.target.value)
                        }
                      >
                        <option value="">General Data Room question</option>
                        {documents.map((document) => (
                          <option key={document.id} value={document.id}>
                            {document.document_name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      Category
                      <select
                        value={questionCategory}
                        onChange={(event) =>
                          setQuestionCategory(event.target.value)
                        }
                      >
                        <option>General</option>
                        <option>Fund Strategy</option>
                        <option>Performance</option>
                        <option>Portfolio</option>
                        <option>Operations</option>
                        <option>Legal</option>
                        <option>Compliance</option>
                        <option>Tax</option>
                        <option>Investor Reporting</option>
                      </select>
                    </label>
                  </div>

                  <label style={{ display: "grid", gap: 8, marginTop: 14 }}>
                    Question
                    <textarea
                      value={questionText}
                      rows={4}
                      placeholder="Enter your diligence or investor question"
                      onChange={(event) => setQuestionText(event.target.value)}
                    />
                  </label>

                  <div className="action-row">
                    <button
                      type="button"
                      disabled={
                        workflowBusyKey === "create-question" ||
                        !questionText.trim()
                      }
                      onClick={createDdqQuestion}
                    >
                      {workflowBusyKey === "create-question"
                        ? "Submitting..."
                        : "Submit Question"}
                    </button>
                  </div>
                </div>

                {ddqQuestions.length === 0 && (
                  <div className="explain-box">
                    No DDQ questions have been recorded for your investor
                    account yet.
                  </div>
                )}

                {ddqQuestions.length > 0 && (
                  <div className="dashboard-grid">
                    {ddqQuestions.map((question) => {
                      const questionId = getString(question, ["id"], "");
                      const answer = getString(question, ["answer"], "");

                      return (
                        <div className="dashboard-card" key={questionId}>
                          <span className="dashboard-tag">
                            {getString(question, ["status"], "Open")}
                          </span>
                          <h3>
                            {getString(question, ["category"], "General")}
                          </h3>
                          <p>
                            Asked {formatDateTime(question["asked_at"])}
                          </p>
                          <div className="explain-box">
                            {getString(question, ["question"], "-")}
                          </div>
                          {answer && (
                            <div
                              className="explain-box"
                              style={{ marginTop: 12 }}
                            >
                              <strong>Response</strong>
                              <br />
                              {answer}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="preview-card">
                <h2>Recent Activity</h2>

                {engagementEvents.length === 0 && (
                  <div className="explain-box">
                    No document downloads or DDQ activity have been recorded
                    for your investor account yet.
                  </div>
                )}

                {engagementEvents.length > 0 && (
                  <div className="review-table-wrap">
                    <table className="review-table">
                      <thead>
                        <tr>
                          <th>Action</th>
                          <th>Document</th>
                          <th>Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {engagementEvents.slice(0, 20).map((event) => (
                          <tr key={getString(event, ["id"], `${getString(event, ["action"], "event")}-${getString(event, ["event_time"], "")}`)}>
                            <td>{getString(event, ["action"], "-")}</td>
                            <td>
                              {getString(
                                event,
                                ["document_name"],
                                "Investor Data Room"
                              )}
                            </td>
                            <td>{formatDateTime(event["event_time"])}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="app-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqStructuredData),
        }}
      />

      <section className="app-shell">
        <div className="app-header">
          <div>
            <p className="eyebrow">VENTIQ Investor Relations</p>
            <h1>Investor Data Room & DDQ Hub</h1>
            <p>
              Private fund document sharing, authoritative batch controls,
              investor-level mapping and diligence readiness in one workspace.
            </p>
          </div>

          <a className="back-link" href="/">
            Back to Home
          </a>
        </div>

        <div
          className="preview-card"
          style={{ marginBottom: 18, padding: 22 }}
        >
          <div className="section-heading-row">
            <div>
              <p className="eyebrow">Active Fund Context</p>
              <h2 style={{ marginBottom: 8 }}>{activeFundName}</h2>
              <p style={{ margin: 0 }}>
                Activation: <strong>{activationStatus}</strong>
                {activationReadiness > 0
                  ? ` · ${activationReadiness.toFixed(0)}% activation readiness`
                  : ""}
              </p>
            </div>

            <label style={{ display: "grid", gap: 6, minWidth: 290 }}>
              <span style={{ fontSize: 12, fontWeight: 800 }}>
                Active fund
              </span>
              <select
                value={activeFundName}
                onChange={(event) => setActiveFundName(event.target.value)}
              >
                {availableFunds.map((fundName) => (
                  <option key={fundName} value={fundName}>
                    {fundName}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {sourceBatch && !loading && (
          <div className="sample-data-ribbon">
            Authoritative canonical batch {shortBatchId(sourceBatch.id)} ·{" "}
            {sourceBatch.batch_name || "Canonical migration intake"} ·{" "}
            {sourceBatch.processing_status || "Completed"} · processed{" "}
            {formatDate(sourceBatch.processed_at)}
          </div>
        )}

        {loading && (
          <div className="preview-card">
            <h2>Preparing Investor Data Room...</h2>
            <p>
              VENTIQ is resolving the authoritative source batch and loading
              private fund documents.
            </p>
          </div>
        )}

        {!loading && errorMessage && (
          <div className="preview-card">
            <h2>Data Room Message</h2>
            <div className="explain-box">{errorMessage}</div>
          </div>
        )}

        {!loading && (
          <>
            <div className="preview-card">
              <h2>Data Room Overview</h2>

              <div className="explain-box">
                Documents are stored in the private{" "}
                <strong>ventiq-data-room</strong> bucket. Access is checked
                against the signed-in user, active fund and authoritative
                source batch before a five-minute download link is generated.
              </div>

              <div className="action-row">
                <a
                  className="monitor-btn monitor-btn-primary"
                  href="/investor-portal"
                >
                  Open Investor Portal
                </a>
                <a
                  className="monitor-btn monitor-btn-secondary"
                  href="/fundraising-ai"
                >
                  Open Investor Relations
                </a>
                <a
                  className="monitor-btn monitor-btn-secondary"
                  href="/migration/activation"
                >
                  Open Fund Activation
                </a>
              </div>
            </div>

            <div className="impact-grid">
              <div className="impact-card">
                <h3>{metrics.readinessScore}%</h3>
                <p>Document readiness score</p>
              </div>
              <div className="impact-card">
                <h3>{metrics.totalDocuments}</h3>
                <p>Private data-room documents</p>
              </div>
              <div className="impact-card">
                <h3>{investors.length}</h3>
                <p>Authoritative investor records</p>
              </div>
              <div className="impact-card">
                <h3>
                  {metrics.coveredFolders}/{metrics.totalRequiredFolders}
                </h3>
                <p>Core folders covered</p>
              </div>
            </div>

            <div className="impact-grid">
              <div className="impact-card">
                <h3>{metrics.investorMapped}</h3>
                <p>Investor-mapped documents</p>
              </div>
              <div className="impact-card">
                <h3>{metrics.externalAccess}</h3>
                <p>LP-visible access settings</p>
              </div>
              <div className="impact-card">
                <h3>{formatFileSize(metrics.totalSize)}</h3>
                <p>Private storage used</p>
              </div>
              <div className="impact-card">
                <h3>{metrics.engagementCount}</h3>
                <p>Recorded engagement events</p>
              </div>
            </div>

            <div className="preview-card">
              <div className="section-heading-row">
                <div>
                  <h2>Secure Document Upload</h2>
                  <p>
                    Upload PDFs, Excel, Word, PowerPoint, CSV or text files.
                    Maximum 10 files per request and 50 MB per file.
                  </p>
                </div>

                {uploadQueue.some((item) => item.status === "Uploaded") && (
                  <button type="button" onClick={clearCompletedUploads}>
                    Clear Uploaded
                  </button>
                )}
              </div>

              <div className="form-card">
                <label>Select documents</label>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.xlsx,.xls,.docx,.doc,.pptx,.ppt,.csv,.txt"
                  disabled={isUploading}
                  onChange={(event) => {
                    handleFilesSelected(event.target.files);
                    event.currentTarget.value = "";
                  }}
                />

                <div className="logic-note">
                  VENTIQ classifies each file locally before upload. You can
                  change the folder, access level and investor mapping in the
                  review queue.
                </div>
              </div>

              {uploadMessage && (
                <div className="explain-box">{uploadMessage}</div>
              )}

              {uploadQueue.length === 0 && (
                <div className="explain-box">
                  No files are staged. Select documents above to begin the
                  secure upload workflow.
                </div>
              )}

              {uploadQueue.length > 0 && (
                <>
                  <div className="action-row">
                    <button
                      type="button"
                      disabled={isUploading}
                      onClick={uploadDocuments}
                    >
                      {isUploading
                        ? "Uploading to Private Data Room..."
                        : "Upload Ready Documents"}
                    </button>
                  </div>

                  <div className="review-table-wrap">
                    <table className="review-table">
                      <thead>
                        <tr>
                          <th>File</th>
                          <th>Classification</th>
                          <th>Destination</th>
                          <th>Access</th>
                          <th>Investor Mapping</th>
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>

                      <tbody>
                        {uploadQueue.map((item) => (
                          <tr key={item.id}>
                            <td>
                              <strong>{item.name}</strong>
                              <br />
                              <span>{formatFileSize(item.size)}</span>
                              {item.error && (
                                <>
                                  <br />
                                  <span style={{ color: "var(--danger, #b42318)" }}>
                                    {item.error}
                                  </span>
                                </>
                              )}
                            </td>
                            <td>
                              <select
                                value={item.detectedType}
                                disabled={
                                  isUploading || item.status === "Uploaded"
                                }
                                onChange={(event) => {
                                  const detectedType = event.target.value;
                                  const folder = suggestFolder(detectedType);
                                  updateUploadPreview(item.id, {
                                    detectedType,
                                    suggestedFolder: folder,
                                    ddqImpact: getDDQImpact(
                                      detectedType,
                                      folder
                                    ),
                                  });
                                }}
                              >
                                <option>PPM / Fund Offering Document</option>
                                <option>DDQ Response</option>
                                <option>Track Record</option>
                                <option>Capital Call Notice</option>
                                <option>Distribution Notice</option>
                                <option>Statement of Account</option>
                                <option>Tax / Regulatory Document</option>
                                <option>Fundraising Deck</option>
                                <option>Compliance Document</option>
                                <option>Portfolio Summary</option>
                                <option>Subscription / KYC Document</option>
                                <option>Investor Document</option>
                              </select>
                            </td>
                            <td>
                              <select
                                value={item.suggestedFolder}
                                disabled={
                                  isUploading || item.status === "Uploaded"
                                }
                                onChange={(event) =>
                                  handleFolderChange(
                                    item.id,
                                    event.target.value
                                  )
                                }
                              >
                                {DATA_ROOM_FOLDERS.map((folder) => (
                                  <option
                                    key={folder.name}
                                    value={folder.name}
                                  >
                                    {folder.name}
                                  </option>
                                ))}
                              </select>
                              <br />
                              <span>{item.ddqImpact}</span>
                            </td>
                            <td>
                              <select
                                value={item.accessLevel}
                                disabled={
                                  isUploading || item.status === "Uploaded"
                                }
                                onChange={(event) =>
                                  updateUploadPreview(item.id, {
                                    accessLevel: event.target
                                      .value as DataRoomAccessLevel,
                                  })
                                }
                              >
                                <option>Internal Only</option>
                                <option>All LPs</option>
                                <option>Restricted LP Access</option>
                                <option>Prospective LPs Only</option>
                              </select>
                            </td>
                            <td>
                              <select
                                value={item.investorCode}
                                disabled={
                                  isUploading || item.status === "Uploaded"
                                }
                                onChange={(event) =>
                                  handleInvestorChange(
                                    item.id,
                                    event.target.value
                                  )
                                }
                              >
                                <option value="">Fund-level document</option>
                                {investors.map((investor) => {
                                  const code = getInvestorCode(investor);
                                  return (
                                    <option key={code} value={code}>
                                      {code} · {getInvestorName(investor)}
                                    </option>
                                  );
                                })}
                              </select>
                            </td>
                            <td>
                              <span className="small-pill">{item.status}</span>
                            </td>
                            <td>
                              <button
                                type="button"
                                disabled={
                                  isUploading ||
                                  item.status === "Uploading" ||
                                  item.status === "Uploaded"
                                }
                                onClick={() => removeUploadPreview(item.id)}
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            <div className="preview-card">
              <h2>Data Room Folders</h2>

              <div className="dashboard-grid">
                {DATA_ROOM_FOLDERS.map((folder) => {
                  const matchingDocuments = documents.filter(
                    (document) =>
                      document.suggested_folder === folder.name
                  );

                  return (
                    <div className="dashboard-card" key={folder.name}>
                      <span className="dashboard-tag">
                        {matchingDocuments.length > 0
                          ? "Covered"
                          : "Missing"}
                      </span>
                      <h3>{folder.name}</h3>
                      <p>{folder.description}</p>
                      <div className="logic-note">
                        {matchingDocuments.length} document
                        {matchingDocuments.length === 1 ? "" : "s"} · Expected:{" "}
                        {folder.expectedDocuments.join(", ")}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="preview-card">
              <div className="section-heading-row">
                <div>
                  <h2>Private Document Library</h2>
                  <p>
                    Batch-scoped documents with controlled signed downloads.
                  </p>
                </div>
                <button type="button" onClick={loadDataRoom}>
                  Refresh Library
                </button>
              </div>

              <div
                className="form-card"
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 12,
                }}
              >
                <label>
                  Folder
                  <select
                    value={folderFilter}
                    onChange={(event) =>
                      setFolderFilter(event.target.value)
                    }
                  >
                    <option>All folders</option>
                    {DATA_ROOM_FOLDERS.map((folder) => (
                      <option key={folder.name}>{folder.name}</option>
                    ))}
                  </select>
                </label>

                <label>
                  Access
                  <select
                    value={accessFilter}
                    onChange={(event) =>
                      setAccessFilter(event.target.value)
                    }
                  >
                    <option>All access levels</option>
                    <option>Internal Only</option>
                    <option>All LPs</option>
                    <option>Restricted LP Access</option>
                    <option>Prospective LPs Only</option>
                  </select>
                </label>

                <label>
                  Search
                  <input
                    type="search"
                    value={searchText}
                    placeholder="Search file, folder, investor or document type"
                    onChange={(event) => setSearchText(event.target.value)}
                  />
                </label>

                <label>
                  Engagement investor
                  <select
                    value={engagementInvestorCode}
                    onChange={(event) =>
                      setEngagementInvestorCode(event.target.value)
                    }
                  >
                    <option value="">Prospective LP / not mapped</option>
                    {investors.map((investor) => {
                      const code = getInvestorCode(investor);

                      return (
                        <option key={code} value={code}>
                          {code} · {getInvestorName(investor)}
                        </option>
                      );
                    })}
                  </select>
                </label>
              </div>

              {filteredDocuments.length === 0 && (
                <div className="explain-box">
                  No documents match the selected filters.
                </div>
              )}

              {filteredDocuments.length > 0 && (
                <div className="review-table-wrap">
                  <table className="review-table">
                    <thead>
                      <tr>
                        <th>Document</th>
                        <th>Folder</th>
                        <th>Access</th>
                        <th>Investor</th>
                        <th>Size</th>
                        <th>Uploaded</th>
                        <th>Engagement / Private File</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredDocuments.map((document) => (
                        <tr key={document.id}>
                          <td>
                            <strong>{document.document_name}</strong>
                            <br />
                            <span>{document.file_name}</span>
                            <br />
                            <span>{document.detected_type}</span>
                          </td>
                          <td>
                            {document.suggested_folder}
                            <br />
                            <span>{document.ddq_impact}</span>
                          </td>
                          <td>
                            <span className="small-pill">
                              {document.access_level}
                            </span>
                          </td>
                          <td>
                            {document.investor_code ? (
                              <>
                                <strong>{document.investor_code}</strong>
                                <br />
                                <span>
                                  {document.investor_name || "Mapped investor"}
                                </span>
                              </>
                            ) : (
                              "Fund-level"
                            )}
                          </td>
                          <td>{formatFileSize(document.file_size)}</td>
                          <td>
                            {formatDateTime(document.imported_at)}
                            <br />
                            <span>
                              {document.created_by_email || "VENTIQ user"}
                            </span>
                          </td>
                          <td>
                            <div
                              style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: 8,
                              }}
                            >
                              <button
                                type="button"
                                disabled={
                                  workflowBusyKey ===
                                  `engagement-Viewed-${document.id}`
                                }
                                onClick={() =>
                                  recordEngagement(document, "Viewed").catch(
                                    (error) =>
                                      setWorkflowMessage(
                                        error instanceof Error
                                          ? error.message
                                          : "Unable to record the view."
                                      )
                                  )
                                }
                              >
                                {workflowBusyKey ===
                                `engagement-Viewed-${document.id}`
                                  ? "Recording..."
                                  : "Record View"}
                              </button>

                              <button
                                type="button"
                                disabled={
                                  downloadingDocumentId === document.id
                                }
                                onClick={() => downloadDocument(document)}
                              >
                                {downloadingDocumentId === document.id
                                  ? "Creating Link..."
                                  : "Download + Log"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="preview-card">
              <h2>LP Access List</h2>

              <div className="explain-box">
                Investor records are read only from the authoritative source
                batch. Document-level investor mapping is available in the
                upload queue above.
              </div>

              {investors.length === 0 && (
                <div className="explain-box">
                  No investor records are available in this source batch.
                </div>
              )}

              {investors.length > 0 && (
                <div className="review-table-wrap">
                  <table className="review-table">
                    <thead>
                      <tr>
                        <th>Investor Code</th>
                        <th>Investor</th>
                        <th>Type</th>
                        <th>KYC</th>
                        <th>Bank</th>
                        <th>Mapped Documents</th>
                      </tr>
                    </thead>

                    <tbody>
                      {investors.slice(0, 100).map((investor) => {
                        const code = getInvestorCode(investor);
                        const mappedDocuments = documents.filter(
                          (document) => document.investor_code === code
                        ).length;

                        return (
                          <tr key={code}>
                            <td>
                              <strong>{code}</strong>
                            </td>
                            <td>{getInvestorName(investor)}</td>
                            <td>
                              {getString(
                                investor,
                                ["investor_type"],
                                "-"
                              )}
                            </td>
                            <td>
                              {getString(investor, ["kyc_status"], "-")}
                            </td>
                            <td>
                              {getString(investor, ["bank_status"], "-")}
                            </td>
                            <td>{mappedDocuments}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="preview-card">
              <div className="section-heading-row">
                <div>
                  <h2>LP Engagement & DDQ Workflow</h2>
                  <p>
                    Authenticated, fund-authorised and source-batch-scoped LP
                    activity and diligence management.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={workflowLoading || !sourceBatch?.id}
                  onClick={() =>
                    sourceBatch?.id &&
                    loadWorkflowState(sourceBatch.id).catch((error) =>
                      setWorkflowMessage(
                        error instanceof Error
                          ? error.message
                          : "Unable to refresh the workflow."
                      )
                    )
                  }
                >
                  {workflowLoading ? "Refreshing..." : "Refresh Workflow"}
                </button>
              </div>

              <div className="impact-grid">
                <div className="impact-card">
                  <h3>{metrics.engagementCount}</h3>
                  <p>Recorded engagement events</p>
                </div>
                <div className="impact-card">
                  <h3>{metrics.openQuestions}</h3>
                  <p>Open / review DDQ questions</p>
                </div>
                <div className="impact-card">
                  <h3>{metrics.answeredQuestions}</h3>
                  <p>Approved answers</p>
                </div>
                <div className="impact-card">
                  <h3>
                    {metrics.openQuestions === 0 ? "Clear" : "Action"}
                  </h3>
                  <p>DDQ response status</p>
                </div>
              </div>

              {workflowMessage && (
                <div className="explain-box">{workflowMessage}</div>
              )}

              <div className="explain-box">
                Select an engagement investor in the Private Document Library.
                <strong> Record View</strong> creates a viewed event, while
                <strong> Download + Log</strong> opens the private signed file
                and records the download against that investor.
              </div>

              <div className="form-card">
                <h3>Create LP / DDQ Question</h3>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 12,
                  }}
                >
                  <label>
                    Investor
                    <select
                      value={questionInvestorCode}
                      onChange={(event) =>
                        setQuestionInvestorCode(event.target.value)
                      }
                    >
                      <option value="">Prospective LP / not mapped</option>
                      {investors.map((investor) => {
                        const code = getInvestorCode(investor);

                        return (
                          <option key={code} value={code}>
                            {code} · {getInvestorName(investor)}
                          </option>
                        );
                      })}
                    </select>
                  </label>

                  <label>
                    Related document
                    <select
                      value={questionDocumentId}
                      onChange={(event) =>
                        setQuestionDocumentId(event.target.value)
                      }
                    >
                      <option value="">General Data Room question</option>
                      {documents.map((document) => (
                        <option key={document.id} value={document.id}>
                          {document.document_name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Category
                    <select
                      value={questionCategory}
                      onChange={(event) =>
                        setQuestionCategory(event.target.value)
                      }
                    >
                      <option>General</option>
                      <option>Fund Strategy</option>
                      <option>Performance</option>
                      <option>Portfolio</option>
                      <option>Operations</option>
                      <option>Legal</option>
                      <option>Compliance</option>
                      <option>Tax</option>
                      <option>Investor Reporting</option>
                    </select>
                  </label>

                  <label>
                    Assigned owner
                    <input
                      value={questionAssignedTo}
                      placeholder="Investor Relations / named owner"
                      onChange={(event) =>
                        setQuestionAssignedTo(event.target.value)
                      }
                    />
                  </label>
                </div>

                <label style={{ display: "grid", gap: 8, marginTop: 14 }}>
                  LP / DDQ question
                  <textarea
                    value={questionText}
                    rows={4}
                    placeholder="Enter the investor diligence question"
                    onChange={(event) => setQuestionText(event.target.value)}
                  />
                </label>

                <div className="action-row">
                  <button
                    type="button"
                    disabled={
                      workflowBusyKey === "create-question" ||
                      !questionText.trim()
                    }
                    onClick={createDdqQuestion}
                  >
                    {workflowBusyKey === "create-question"
                      ? "Creating Question..."
                      : "Create DDQ Question"}
                  </button>
                </div>
              </div>

              <div style={{ marginTop: 22 }}>
                <div className="section-heading-row">
                  <div>
                    <h3>Question Queue</h3>
                    <p>
                      Assign an owner, prepare a draft, approve the final
                      response or reopen a completed question.
                    </p>
                  </div>
                </div>

                {ddqQuestions.length === 0 && (
                  <div className="explain-box">
                    No DDQ questions have been recorded for this fund and source
                    batch.
                  </div>
                )}

                {ddqQuestions.length > 0 && (
                  <div className="dashboard-grid">
                    {ddqQuestions.map((question) => {
                      const questionId = getString(question, ["id"], "");
                      const status = getString(
                        question,
                        ["status"],
                        "Open"
                      );
                      const normalizedStatus = status.toLowerCase();
                      const isAnswered = normalizedStatus === "answered";
                      const isInInternalReview =
                        normalizedStatus === "needs internal review";
                      const isOpen = normalizedStatus === "open";

                      const statusGuidance = isAnswered
                        ? "Final answer approved. Reopen the question before making another draft."
                        : isInInternalReview
                        ? "Draft saved successfully. The question is now awaiting internal review and approval."
                        : "Question is open. Save a draft answer to move it to Needs Internal Review.";

                      return (
                        <div className="dashboard-card" key={questionId}>
                          <span className="dashboard-tag">
                            {isOpen
                              ? "Open"
                              : isInInternalReview
                              ? "Needs Internal Review"
                              : status}
                          </span>
                          <h3>
                            {getString(question, ["category"], "General")}
                          </h3>
                          <p>
                            <strong>
                              {getString(
                                question,
                                ["investor_name"],
                                "Prospective LP"
                              )}
                            </strong>
                            <br />
                            {getString(
                              question,
                              ["document_name"],
                              "Investor Data Room"
                            )}
                            <br />
                            Asked {formatDateTime(question["asked_at"])}
                          </p>

                          <div className="explain-box">
                            {getString(question, ["question"], "-")}
                          </div>

                          <label style={{ display: "grid", gap: 6 }}>
                            Assigned owner
                            <input
                              value={assigneeDrafts[questionId] ?? ""}
                              placeholder="Assign responsible person"
                              onChange={(event) =>
                                setAssigneeDrafts((current) => ({
                                  ...current,
                                  [questionId]: event.target.value,
                                }))
                              }
                            />
                          </label>

                          <label
                            style={{
                              display: "grid",
                              gap: 6,
                              marginTop: 12,
                            }}
                          >
                            Draft / approved answer
                            <textarea
                              rows={6}
                              value={answerDrafts[questionId] ?? ""}
                              placeholder="Prepare the evidence-backed response"
                              onChange={(event) =>
                                setAnswerDrafts((current) => ({
                                  ...current,
                                  [questionId]: event.target.value,
                                }))
                              }
                            />
                          </label>

                          <div
                            className="explain-box"
                            style={{ marginTop: 12 }}
                          >
                            <strong>Current workflow status: {status}</strong>
                            <br />
                            {statusGuidance}
                          </div>

                          {Boolean(
                            normalizeText(question["answered_at"])
                          ) && (
                            <div className="logic-note">
                              Approved{" "}
                              {formatDateTime(question["answered_at"])}
                            </div>
                          )}

                          <div
                            className="action-row"
                            style={{ marginTop: 12 }}
                          >
                            <button
                              type="button"
                              disabled={
                                isAnswered ||
                                workflowBusyKey ===
                                  `assign_question-${questionId}` ||
                                !(assigneeDrafts[questionId] ?? "").trim()
                              }
                              onClick={() =>
                                updateDdqQuestion(
                                  question,
                                  "assign_question"
                                )
                              }
                            >
                              Assign
                            </button>

                            <button
                              type="button"
                              disabled={
                                isAnswered ||
                                workflowBusyKey ===
                                  `save_draft_answer-${questionId}` ||
                                !(answerDrafts[questionId] ?? "").trim()
                              }
                              onClick={() =>
                                updateDdqQuestion(
                                  question,
                                  "save_draft_answer"
                                )
                              }
                            >
                              {workflowBusyKey ===
                              `save_draft_answer-${questionId}`
                                ? "Saving Draft..."
                                : "Save Draft → Internal Review"}
                            </button>

                            <button
                              type="button"
                              disabled={
                                !isInInternalReview ||
                                workflowBusyKey ===
                                  `approve_answer-${questionId}` ||
                                !(answerDrafts[questionId] ?? "").trim()
                              }
                              title={
                                isInInternalReview
                                  ? "Approve the internally reviewed answer"
                                  : "Save the draft first to move the question into internal review"
                              }
                              onClick={() =>
                                updateDdqQuestion(
                                  question,
                                  "approve_answer"
                                )
                              }
                            >
                              {workflowBusyKey ===
                              `approve_answer-${questionId}`
                                ? "Approving..."
                                : "Approve Reviewed Answer"}
                            </button>

                            {isAnswered && (
                              <button
                                type="button"
                                disabled={
                                  workflowBusyKey ===
                                  `reopen_question-${questionId}`
                                }
                                onClick={() =>
                                  updateDdqQuestion(
                                    question,
                                    "reopen_question"
                                  )
                                }
                              >
                                Reopen
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div style={{ marginTop: 22 }}>
                <h3>Recent LP Engagement</h3>

                {engagementEvents.length === 0 && (
                  <div className="explain-box">
                    No document views, downloads or question events have been
                    recorded yet.
                  </div>
                )}

                {engagementEvents.length > 0 && (
                  <div className="audit-timeline">
                    {engagementEvents.slice(0, 25).map((event) => (
                      <div
                        className="audit-item"
                        key={getString(
                          event,
                          ["id"],
                          `${getString(
                            event,
                            ["event_time"]
                          )}-${getString(event, ["document_name"])}`
                        )}
                      >
                        <strong>{formatDateTime(event["event_time"])}</strong>{" "}
                        · {getString(event, ["action"], "Activity")}
                        <br />
                        <span>
                          {getString(
                            event,
                            ["investor_name"],
                            "Prospective LP"
                          )}{" "}
                          ·{" "}
                          {getString(
                            event,
                            ["document_name"],
                            "Investor Data Room"
                          )}
                        </span>
                        <br />
                        <span>{getString(event, ["note"], "")}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="preview-card">
              <h2>Data Room Readiness Review</h2>

              <div className="journal-preview">
                <div className="journal-row">
                  <span>Authoritative source batch</span>
                  <strong>{shortBatchId(sourceBatch?.id ?? "")}</strong>
                </div>
                <div className="journal-row">
                  <span>Core folder coverage</span>
                  <strong>{metrics.folderCoverage}%</strong>
                </div>
                <div className="journal-row">
                  <span>Private documents uploaded</span>
                  <strong>{metrics.totalDocuments}</strong>
                </div>
                <div className="journal-row">
                  <span>Internal-only documents</span>
                  <strong>{metrics.internalOnly}</strong>
                </div>
                <div className="journal-row">
                  <span>LP-visible documents</span>
                  <strong>{metrics.externalAccess}</strong>
                </div>
                <div className="journal-row">
                  <span>Readiness recommendation</span>
                  <strong>{readinessRecommendation}</strong>
                </div>
              </div>
            </div>

            <div className="preview-card">
              <h2>Investor Data Room FAQ</h2>

              <div className="dashboard-grid">
                {DATA_ROOM_FAQ.map((item) => (
                  <div className="dashboard-card" key={item.question}>
                    <h3>{item.question}</h3>
                    <p>{item.answer}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="preview-card">
              <h2>Modular Adoption Path</h2>

              <div className="process-grid">
                <div className="process-card">
                  <span>01</span>
                  <h3>Start with Data Room</h3>
                  <p>
                    Upload legacy diligence, legal, performance and investor
                    reporting documents into private storage.
                  </p>
                </div>
                <div className="process-card">
                  <span>02</span>
                  <h3>Add Investor Portal</h3>
                  <p>
                    Map investor-specific records and publish controlled
                    documents to LPs.
                  </p>
                </div>
                <div className="process-card">
                  <span>03</span>
                  <h3>Activate DDQ Workflow</h3>
                  <p>
                    Track LP engagement, questions, owners, evidence and
                    approved responses.
                  </p>
                </div>
                <div className="process-card">
                  <span>04</span>
                  <h3>Expand to Full VENTIQ</h3>
                  <p>
                    Connect finance, compliance, investment, reporting and
                    managing-partner workflows to the same fund data layer.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
