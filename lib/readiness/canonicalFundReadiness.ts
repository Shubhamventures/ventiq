"use client";

export type ReadinessStageStatus =
  | "Complete"
  | "Action Required"
  | "In Review"
  | "Not Started"
  | "Unavailable";

export type CanonicalReadinessStage = {
  stage: number;
  key:
    | "fund_identity"
    | "people_access"
    | "data_intake"
    | "review_calculations"
    | "maker_checker_activation"
    | "stakeholder_launch";
  title: string;
  status: ReadinessStageStatus;
  blockerCount: number;
  completedAt: string;
  nextHref: string;
  nextLabel: string;
};

type IntakeStatusApiResult = {
  error?: string;
  batch?: null | {
    id: string;
    batchName: string;
    fundName: string;
    status: string;
    processingStatus: string;
    totalFiles: number;
    uploadedFiles: number;
    processedFiles: number;
    totalRows: number;
    insertedRows: number;
    updatedRows: number;
    rejectedRows: number;
    warningRows: number;
    validationErrorCount: number;
    validationWarningCount: number;
    createdAt: string | null;
    updatedAt: string | null;
    processedAt: string | null;
  };
  files?: Array<{
    id: string;
    name: string;
    category: string;
    datasetKey: string;
    detectedType: string;
    status: string;
  }>;
};

type IssueApiResult = {
  error?: string;
  latestBatch?: null | {
    id: string;
    batch_name: string;
    status: string;
    processing_status: string;
    total_rows: number;
    validation_error_count: number;
    validation_warning_count: number;
    updated_at: string;
  };
  latestCalculation?: null | {
    id: string;
    as_of_date: string;
    calculation_status: string;
    completed_at: string;
  };
  summary?: {
    total: number;
    blocking: number;
    review: number;
    validation: number;
    reconciliation: number;
  };
};

export type OperationalLayerSnapshot = {
  key: "investor" | "pdf" | "portfolio" | "fund" | "compliance";
  title: string;
  source_table: string;
  source_batch_id: string;
  batch_name: string;
  data_ready: boolean;
  approval_status: string;
  approved: boolean;
  operational: boolean;
  count: number;
  primary_metric: string;
  secondary_metric: string;
  warning_count: number;
  blockers: string[];
};


type SetupReadinessApiResult = {
  error?: string;
  setup?: {
    fundIdentityReady: boolean;
    fundIdentitySource: string;
    fundCreatedAt: string;
    peopleAccessCount: number;
    peopleUpdatedAt: string;
  };
};

type LaunchApiResult = {
  error?: string;
  activation?: {
    status: string;
    readiness_score: number;
    activated_at: string;
    activated_by: string;
    is_active: boolean;
    using_frozen_batch_map: boolean;
    calculation_run_id: string;
    calculation_ready: boolean;
    calculation_as_of_date: string;
    reconciliation_controls: number;
    reconciliation_passed: number;
  };
  layers?: OperationalLayerSnapshot[];
  summary?: {
    operational_layers: number;
    total_layers: number;
    calculation_ready: boolean;
    launch_gate_open: boolean;
  };
};

export type CanonicalFundReadiness = {
  fundName: string;
  loadedAt: string;
  setup: {
    fundIdentityReady: boolean;
    fundIdentitySource: string;
    fundCreatedAt: string;
    peopleAccessCount: number;
    peopleUpdatedAt: string;
  };
  intake: {
    batchId: string;
    batchName: string;
    status: string;
    processingStatus: string;
    totalFiles: number;
    uploadedFiles: number;
    processedFiles: number;
    totalRows: number;
    insertedRows: number;
    updatedRows: number;
    rejectedRows: number;
    warningRows: number;
    validationErrorCount: number;
    validationWarningCount: number;
    processedAt: string;
    updatedAt: string;
    datasetKeys: string[];
  };
  issues: {
    total: number;
    blocking: number;
    review: number;
    validation: number;
    reconciliation: number;
  };
  calculation: {
    runId: string;
    status: string;
    asOfDate: string;
    completedAt: string;
    ready: boolean;
    reconciliationControls: number;
    reconciliationPassed: number;
  };
  checker: {
    approvedLayers: number;
    totalLayers: number;
    submittedLayers: number;
    changesRequestedLayers: number;
    draftLayers: number;
  };
  activation: {
    status: string;
    isActive: boolean;
    readinessScore: number;
    activatedAt: string;
    activatedBy: string;
  };
  launch: {
    gateOpen: boolean;
    operationalLayers: number;
    totalLayers: number;
    blockerCount: number;
  };
  layers: OperationalLayerSnapshot[];
  lastUpdated: string;
};

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function textValue(value: unknown) {
  return String(value ?? "").trim();
}

function latestDate(values: Array<string | null | undefined>) {
  const valid = values
    .map((value) => textValue(value))
    .filter(Boolean)
    .map((value) => ({ value, time: Date.parse(value) }))
    .filter((item) => Number.isFinite(item.time))
    .sort((left, right) => right.time - left.time);

  return valid[0]?.value || "";
}

async function readJson<T>(url: string, accessToken: string): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const payload = (await response.json().catch(() => ({}))) as T & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(
      payload.error || `Readiness source failed with status ${response.status}.`
    );
  }

  return payload;
}

export async function loadCanonicalFundReadiness(
  fundName: string,
  accessToken: string
): Promise<CanonicalFundReadiness> {
  const normalizedFundName = fundName.trim();
  const normalizedToken = accessToken.trim();

  if (!normalizedFundName) {
    throw new Error("A governed active fund is required for readiness.");
  }

  if (!normalizedToken) {
    throw new Error("A signed-in VENTIQ session is required for readiness.");
  }

  const [setupResult, intakeResult, issueResult, launchResult] = await Promise.all([
    readJson<SetupReadinessApiResult>(
      `/api/setup/readiness?fundName=${encodeURIComponent(normalizedFundName)}`,
      normalizedToken
    ),
    readJson<IntakeStatusApiResult>(
      `/api/migration/intake-upload?fundName=${encodeURIComponent(normalizedFundName)}`,
      normalizedToken
    ),
    readJson<IssueApiResult>(
      `/api/issues?fundName=${encodeURIComponent(normalizedFundName)}`,
      normalizedToken
    ),
    readJson<LaunchApiResult>(
      `/api/migration/stakeholder-launch?fund_name=${encodeURIComponent(normalizedFundName)}`,
      normalizedToken
    ),
  ]);

  const setup = setupResult.setup ?? {
    fundIdentityReady: false,
    fundIdentitySource: "fund_master",
    fundCreatedAt: "",
    peopleAccessCount: 0,
    peopleUpdatedAt: "",
  };
  const batch = intakeResult.batch ?? null;
  const issueSummary = issueResult.summary ?? {
    total: 0,
    blocking: 0,
    review: 0,
    validation: 0,
    reconciliation: 0,
  };
  const activation = launchResult.activation ?? {
    status: "Setup Not Started",
    readiness_score: 0,
    activated_at: "",
    activated_by: "",
    is_active: false,
    using_frozen_batch_map: false,
    calculation_run_id: "",
    calculation_ready: false,
    calculation_as_of_date: "",
    reconciliation_controls: 0,
    reconciliation_passed: 0,
  };
  const layers = launchResult.layers ?? [];
  const launchSummary = launchResult.summary ?? {
    operational_layers: 0,
    total_layers: layers.length,
    calculation_ready: activation.calculation_ready,
    launch_gate_open: false,
  };

  const approvalStatuses = layers.map((layer) =>
    textValue(layer.approval_status).toLowerCase()
  );
  const layerBlockers = Array.from(
    new Set(
      layers.flatMap((layer) =>
        Array.isArray(layer.blockers) ? layer.blockers : []
      )
    )
  );

  const datasetKeys = Array.from(
    new Set(
      (intakeResult.files ?? [])
        .map((file) => textValue(file.datasetKey))
        .filter(Boolean)
    )
  ).sort();

  const latestCalculation = issueResult.latestCalculation ?? null;

  const lastUpdated = latestDate([
    setup.peopleUpdatedAt,
    setup.fundCreatedAt,
    batch?.processedAt,
    batch?.updatedAt,
    latestCalculation?.completed_at,
    activation.activated_at,
    issueResult.latestBatch?.updated_at,
  ]);

  return {
    fundName: normalizedFundName,
    loadedAt: new Date().toISOString(),
    setup: {
      fundIdentityReady: Boolean(setup.fundIdentityReady),
      fundIdentitySource: textValue(setup.fundIdentitySource) || "fund_master",
      fundCreatedAt: textValue(setup.fundCreatedAt),
      peopleAccessCount: numberValue(setup.peopleAccessCount),
      peopleUpdatedAt: textValue(setup.peopleUpdatedAt),
    },
    intake: {
      batchId: textValue(batch?.id),
      batchName: textValue(batch?.batchName),
      status: textValue(batch?.status),
      processingStatus: textValue(batch?.processingStatus),
      totalFiles: numberValue(batch?.totalFiles),
      uploadedFiles: numberValue(batch?.uploadedFiles),
      processedFiles: numberValue(batch?.processedFiles),
      totalRows: numberValue(batch?.totalRows),
      insertedRows: numberValue(batch?.insertedRows),
      updatedRows: numberValue(batch?.updatedRows),
      rejectedRows: numberValue(batch?.rejectedRows),
      warningRows: numberValue(batch?.warningRows),
      validationErrorCount: numberValue(batch?.validationErrorCount),
      validationWarningCount: numberValue(batch?.validationWarningCount),
      processedAt: textValue(batch?.processedAt),
      updatedAt: textValue(batch?.updatedAt),
      datasetKeys,
    },
    issues: {
      total: numberValue(issueSummary.total),
      blocking: numberValue(issueSummary.blocking),
      review: numberValue(issueSummary.review),
      validation: numberValue(issueSummary.validation),
      reconciliation: numberValue(issueSummary.reconciliation),
    },
    calculation: {
      runId: textValue(activation.calculation_run_id) || textValue(latestCalculation?.id),
      status: textValue(latestCalculation?.calculation_status),
      asOfDate:
        textValue(activation.calculation_as_of_date) ||
        textValue(latestCalculation?.as_of_date),
      completedAt: textValue(latestCalculation?.completed_at),
      ready: Boolean(activation.calculation_ready),
      reconciliationControls: numberValue(activation.reconciliation_controls),
      reconciliationPassed: numberValue(activation.reconciliation_passed),
    },
    checker: {
      approvedLayers: approvalStatuses.filter((status) => status === "approved").length,
      totalLayers: layers.length,
      submittedLayers: approvalStatuses.filter((status) => status === "submitted").length,
      changesRequestedLayers: approvalStatuses.filter(
        (status) => status === "changes requested"
      ).length,
      draftLayers: approvalStatuses.filter((status) => status === "draft").length,
    },
    activation: {
      status: textValue(activation.status) || "Setup Not Started",
      isActive: Boolean(activation.is_active),
      readinessScore: numberValue(activation.readiness_score),
      activatedAt: textValue(activation.activated_at),
      activatedBy: textValue(activation.activated_by),
    },
    launch: {
      gateOpen: Boolean(launchSummary.launch_gate_open),
      operationalLayers: numberValue(launchSummary.operational_layers),
      totalLayers: numberValue(launchSummary.total_layers),
      blockerCount: layerBlockers.length,
    },
    layers,
    lastUpdated,
  };
}

export function buildCanonicalSetupStages(input: {
  readiness: CanonicalFundReadiness | null;
  readinessError?: string;
  hasFundIdentity: boolean;
  fundCreatedAt?: string;
  peopleCount: number;
  peopleUpdatedAt?: string;
}): CanonicalReadinessStage[] {
  const {
    readiness,
    readinessError = "",
    hasFundIdentity,
    fundCreatedAt = "",
    peopleCount,
    peopleUpdatedAt = "",
  } = input;

  const unavailable = Boolean(readinessError) && !readiness;
  const resolvedHasFundIdentity =
    readiness?.setup.fundIdentityReady ?? hasFundIdentity;
  const resolvedFundCreatedAt =
    readiness?.setup.fundCreatedAt || fundCreatedAt;
  const resolvedPeopleCount =
    readiness?.setup.peopleAccessCount ?? peopleCount;
  const resolvedPeopleUpdatedAt =
    readiness?.setup.peopleUpdatedAt || peopleUpdatedAt;

  const stage1: CanonicalReadinessStage = {
    stage: 1,
    key: "fund_identity",
    title: "Fund Setup",
    status: resolvedHasFundIdentity ? "Complete" : "Action Required",
    blockerCount: resolvedHasFundIdentity ? 0 : 1,
    completedAt: resolvedHasFundIdentity ? resolvedFundCreatedAt : "",
    nextHref: "#create-fund",
    nextLabel: resolvedHasFundIdentity ? "Review Fund Setup" : "Create Fund",
  };

  const stage2Complete = resolvedHasFundIdentity && resolvedPeopleCount > 0;
  const stage2: CanonicalReadinessStage = {
    stage: 2,
    key: "people_access",
    title: "People & Access",
    status: !resolvedHasFundIdentity
      ? "Not Started"
      : stage2Complete
        ? "Complete"
        : "Action Required",
    blockerCount: !resolvedHasFundIdentity || stage2Complete ? 0 : 1,
    completedAt: stage2Complete ? resolvedPeopleUpdatedAt : "",
    nextHref: "/admin/role-access",
    nextLabel: stage2Complete ? "Review People & Access" : "Open Role Access",
  };

  const intakeComplete =
    Boolean(readiness?.intake.batchId) &&
    readiness?.intake.processingStatus === "Completed" &&
    readiness.intake.validationErrorCount === 0 &&
    readiness.intake.rejectedRows === 0 &&
    readiness.intake.processedFiles > 0;

  const stage3Blockers = !readiness
    ? unavailable
      ? 1
      : 0
    : (readiness.intake.batchId ? 0 : 1) +
      (readiness.intake.batchId && readiness.intake.processingStatus !== "Completed"
        ? 1
        : 0) +
      Math.max(
        readiness.intake.validationErrorCount,
        readiness.intake.rejectedRows
      );

  const stage3: CanonicalReadinessStage = {
    stage: 3,
    key: "data_intake",
    title: "Fund Data",
    status: unavailable
      ? "Unavailable"
      : !stage2Complete
        ? "Not Started"
        : intakeComplete
          ? "Complete"
          : readiness?.intake.batchId
            ? "In Review"
            : "Action Required",
    blockerCount: stage3Blockers,
    completedAt: intakeComplete
      ? readiness?.intake.processedAt || readiness?.intake.updatedAt || ""
      : "",
    nextHref: "/migration/data-intake",
    nextLabel: intakeComplete ? "Review Data Intake" : "Open Data Intake",
  };

  const reviewComplete =
    intakeComplete &&
    Boolean(readiness) &&
    readiness.issues.blocking === 0 &&
    readiness.calculation.ready;

  const stage4Blockers = !readiness
    ? unavailable
      ? 1
      : 0
    : readiness.issues.blocking + (readiness.calculation.ready ? 0 : 1);

  const stage4: CanonicalReadinessStage = {
    stage: 4,
    key: "review_calculations",
    title: "Review & Calculate",
    status: unavailable
      ? "Unavailable"
      : !intakeComplete
        ? "Not Started"
        : reviewComplete
          ? "Complete"
          : "Action Required",
    blockerCount: stage4Blockers,
    completedAt: reviewComplete ? readiness?.calculation.completedAt || "" : "",
    nextHref:
      readiness && readiness.issues.blocking > 0
        ? `/issues?fundName=${encodeURIComponent(readiness.fundName)}`
        : "/migration/performance-calculations",
    nextLabel:
      readiness && readiness.issues.blocking > 0
        ? "Resolve Blocking Issues"
        : reviewComplete
          ? "Review Calculations"
          : "Run / Review Calculations",
  };

  const approvalsComplete =
    readiness !== null &&
    readiness.checker.totalLayers > 0 &&
    readiness.checker.approvedLayers === readiness.checker.totalLayers;

  const activationComplete =
    reviewComplete && approvalsComplete && Boolean(readiness?.activation.isActive);

  const stage5Blockers = !readiness
    ? unavailable
      ? 1
      : 0
    : Math.max(
        0,
        readiness.checker.totalLayers - readiness.checker.approvedLayers
      ) + (readiness.activation.isActive ? 0 : 1);

  const stage5: CanonicalReadinessStage = {
    stage: 5,
    key: "maker_checker_activation",
    title: "Activate",
    status: unavailable
      ? "Unavailable"
      : !reviewComplete
        ? "Not Started"
        : activationComplete
          ? "Complete"
          : readiness?.checker.submittedLayers
            ? "In Review"
            : "Action Required",
    blockerCount: stage5Blockers,
    completedAt: activationComplete ? readiness?.activation.activatedAt || "" : "",
    nextHref: "/migration/activation",
    nextLabel: activationComplete ? "Review Activation" : "Open Activation",
  };

  const launchComplete =
    activationComplete && Boolean(readiness?.launch.gateOpen);

  const stage6: CanonicalReadinessStage = {
    stage: 6,
    key: "stakeholder_launch",
    title: "Launch",
    status: unavailable
      ? "Unavailable"
      : !activationComplete
        ? "Not Started"
        : launchComplete
          ? "Complete"
          : "Action Required",
    blockerCount: !readiness
      ? unavailable
        ? 1
        : 0
      : launchComplete
        ? 0
        : Math.max(1, readiness.launch.blockerCount),
    completedAt: launchComplete ? readiness?.activation.activatedAt || "" : "",
    nextHref: launchComplete ? "/launch-center" : "/migration/stakeholder-launch",
    nextLabel: launchComplete ? "Launch VENTIQ Workspaces" : "Review Launch Readiness",
  };

  return [stage1, stage2, stage3, stage4, stage5, stage6];
}

export function readinessPercentFromStages(stages: CanonicalReadinessStage[]) {
  if (!stages.length) return 0;
  const completed = stages.filter((stage) => stage.status === "Complete").length;
  return Math.round((completed / stages.length) * 100);
}
