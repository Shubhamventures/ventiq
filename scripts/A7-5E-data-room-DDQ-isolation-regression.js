const { createClient } = require("@supabase/supabase-js");
const crypto = require("node:crypto");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
const SITE_LOCK_TOKEN = process.env.SITE_LOCK_TOKEN || process.env.VENTIQ_SITE_LOCK_TOKEN || "";
const APP_URL = process.env.VENTIQ_APP_URL || "http://localhost:3000";

const ORGANISATION_ID = "2febaacd-ef58-4444-8715-9bbd0d38238d";
const FUND_NAME = "VENTIQ Access Test Fund";
const SOURCE_BATCH_ID = "293e683d-dde0-4c56-a534-697e8405fe37";
const INVESTOR_A_CODE = "A3TEST001";
const INVESTOR_B_CODE = "A7-DATAROOM-ISOLATION-NO-A3";
const DOCUMENT_ID = "34a4a92f-d899-4639-be32-4af9d5ff2b5e";
const DOCUMENT_NAME = "A7 QA Fund Overview - A3TEST001";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
  console.error("FAIL - Missing required Supabase environment variables.");
  process.exit(1);
}
if (!SITE_LOCK_TOKEN) {
  console.error("FAIL - SITE_LOCK_TOKEN is missing from .env.local.");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const createdUserIds = [];
const pass = (message) => console.log(`PASS - ${message}`);
function fail(message, detail = "") {
  console.error(`FAIL - ${message}`);
  if (detail) console.error(detail);
  throw new Error(message);
}

function makeAccount(label, investorCode) {
  const nonce = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  return {
    label,
    investorCode,
    email: `a7.dataroom.${label.toLowerCase()}.${nonce}@ventiq.test`,
    password: `Ventiq-A7-${crypto.randomUUID()}!`,
    fullName: `A7 Data Room Test ${label}`,
  };
}

async function createQaInvestor(account) {
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: account.email,
    password: account.password,
    email_confirm: true,
    user_metadata: { full_name: account.fullName, ventiq_test_only: true, ventiq_test_stage: "A7-5E" },
  });
  if (authError || !authData?.user) fail(`${account.label} auth user provisioning`, authError?.message);

  account.userId = authData.user.id;
  createdUserIds.push(account.userId);
  pass(`${account.label} temporary auth user created`);

  const { error: profileError } = await admin.from("ventiq_user_profiles").upsert({
    user_id: account.userId,
    email: account.email,
    full_name: account.fullName,
    default_role: "investor",
    active_organisation_id: ORGANISATION_ID,
    investor_id: account.investorCode,
    status: "Active",
  }, { onConflict: "user_id" });
  if (profileError) fail(`${account.label} profile provisioning`, profileError.message);
  pass(`${account.label} Active Investor profile ready`);

  const { error: membershipError } = await admin.from("ventiq_organisation_members").insert({
    organisation_id: ORGANISATION_ID,
    user_id: account.userId,
    role: "investor",
    status: "Active",
    is_primary: true,
  });
  if (membershipError) fail(`${account.label} organisation membership`, membershipError.message);
  pass(`${account.label} organisation membership ready`);

  const { error: fundAccessError } = await admin.from("ventiq_user_fund_access").upsert({
    organisation_id: ORGANISATION_ID,
    user_id: account.userId,
    fund_name: FUND_NAME,
    role: "investor",
    can_view: true,
    can_edit: false,
    can_approve: false,
    investor_id: account.investorCode,
    status: "Active",
  }, { onConflict: "organisation_id,user_id,fund_name" });
  if (fundAccessError) fail(`${account.label} fund access provisioning`, fundAccessError.message);
  pass(`${account.label} read-only fund access ready`);

  const { error: entitlementError } = await admin.from("ventiq_user_investor_access").insert({
    organisation_id: ORGANISATION_ID,
    user_id: account.userId,
    fund_name: FUND_NAME,
    investor_code: account.investorCode,
    status: "Active",
    can_view_profile: true,
    can_view_financials: true,
    can_view_documents: true,
    can_download_documents: true,
    can_use_data_room: true,
    can_submit_questions: true,
  });
  if (entitlementError) fail(`${account.label} investor entitlement provisioning`, entitlementError.message);
  pass(`${account.label} Data Room + DDQ entitlement -> ${account.investorCode}`);
}

async function signIn(account) {
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email: account.email, password: account.password });
  if (error || !data?.session?.access_token) fail(`${account.label} JWT authentication`, error?.message);
  pass(`${account.label} authenticated with real Investor JWT`);
  return data.session.access_token;
}

function headers(token, json = false) {
  return {
    Authorization: `Bearer ${token}`,
    Cookie: `ventiq_site_access=${encodeURIComponent(SITE_LOCK_TOKEN)}`,
    Accept: "application/json",
    ...(json ? { "Content-Type": "application/json" } : {}),
  };
}
async function readBody(response) { try { return await response.json(); } catch { return {}; } }

async function listDocuments(token, tamperedInvestorCode) {
  const url = new URL("/api/data-room/documents", APP_URL);
  url.searchParams.set("fundName", FUND_NAME);
  url.searchParams.set("sourceBatchId", SOURCE_BATCH_ID);
  url.searchParams.set("investorCode", tamperedInvestorCode);
  url.searchParams.set("limit", "100");
  const response = await fetch(url, { method: "GET", headers: headers(token) });
  return { response, body: await readBody(response) };
}

async function accessDocument(token) {
  const url = new URL("/api/data-room/documents", APP_URL);
  url.searchParams.set("fundName", FUND_NAME);
  url.searchParams.set("sourceBatchId", SOURCE_BATCH_ID);
  url.searchParams.set("documentId", DOCUMENT_ID);
  const response = await fetch(url, { method: "GET", headers: headers(token) });
  return { response, body: await readBody(response) };
}

async function workflowGet(token, tamperedInvestorCode) {
  const url = new URL("/api/data-room/workflow", APP_URL);
  url.searchParams.set("fundName", FUND_NAME);
  url.searchParams.set("sourceBatchId", SOURCE_BATCH_ID);
  url.searchParams.set("investorCode", tamperedInvestorCode);
  url.searchParams.set("limit", "100");
  const response = await fetch(url, { method: "GET", headers: headers(token) });
  return { response, body: await readBody(response) };
}

async function workflowPost(token, body) {
  const response = await fetch(new URL("/api/data-room/workflow", APP_URL), {
    method: "POST",
    headers: headers(token, true),
    body: JSON.stringify(body),
  });
  return { response, body: await readBody(response) };
}

function assertNoStorageCoordinates(document, label) {
  for (const key of ["storage_bucket", "storage_path", "storage_url", "signed_url"]) {
    if (Object.prototype.hasOwnProperty.call(document || {}, key)) {
      fail(`${label} unexpectedly exposes ${key}`, JSON.stringify(document, null, 2));
    }
  }
}

async function countRows(table, column, userId) {
  const { count, error } = await admin.from(table).select("id", { count: "exact", head: true }).eq(column, userId);
  if (error) fail(`count ${table}`, error.message);
  return Number(count || 0);
}

async function cleanup() {
  for (const userId of [...createdUserIds].reverse()) {
    try {
      await admin.from("data_room_engagement_events").delete().eq("recorded_by", userId);
      await admin.from("data_room_questions").delete().eq("created_by", userId);
      await admin.from("ventiq_user_investor_access").delete().eq("user_id", userId);
      await admin.from("ventiq_user_fund_access").delete().eq("user_id", userId);
      await admin.from("ventiq_organisation_members").delete().eq("user_id", userId);
      await admin.from("ventiq_user_profiles").delete().eq("user_id", userId);
      await admin.auth.admin.deleteUser(userId);
    } catch (error) {
      console.warn(`WARN - cleanup failed for ${userId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

async function main() {
  console.log("");
  console.log("VENTIQ A7-5E Investor Data Room + DDQ Isolation Regression");
  console.log("==========================================================");
  console.log(`Fund: ${FUND_NAME}`);
  console.log(`Canonical investor: ${INVESTOR_A_CODE}`);
  console.log(`QA Data Room document: ${DOCUMENT_ID}`);
  console.log("Temporary QA users and workflow rows are cleaned automatically.");
  console.log("");

  const investorA = makeAccount("Investor-A", INVESTOR_A_CODE);
  const investorB = makeAccount("Investor-B", INVESTOR_B_CODE);

  try {
    const { data: moduleRow, error: moduleError } = await admin.from("ventiq_module_activation_status")
      .select("status,readiness_score")
      .eq("organisation_id", ORGANISATION_ID)
      .eq("fund_name", FUND_NAME)
      .eq("module_key", "investor_data_room_portal")
      .maybeSingle();
    if (moduleError || !moduleRow || moduleRow.status !== "Active" || Number(moduleRow.readiness_score) !== 100) {
      fail("Investor Data Room module activation precondition", moduleError?.message || JSON.stringify(moduleRow, null, 2));
    }
    pass("Investor Data Room module is Active at 100% readiness");

    const { data: documentRow, error: documentError } = await admin.from("data_room_documents")
      .select("id,fund_name,source_batch_id,investor_code,document_name,access_level,storage_bucket,storage_path,document_status")
      .eq("id", DOCUMENT_ID).maybeSingle();
    if (documentError || !documentRow || documentRow.investor_code !== INVESTOR_A_CODE || documentRow.access_level !== "Restricted LP Access" || !documentRow.storage_path) {
      fail("A3 restricted Data Room document precondition", documentError?.message || JSON.stringify(documentRow, null, 2));
    }
    pass("A3 restricted private Data Room document exists");

    await createQaInvestor(investorA);
    await createQaInvestor(investorB);
    const tokenA = await signIn(investorA);
    const tokenB = await signIn(investorB);

    console.log("");
    console.log("Investor A — entitled Data Room + DDQ workflow");
    console.log("------------------------------------------------");

    const aList = await listDocuments(tokenA, INVESTOR_B_CODE);
    if (aList.response.status !== 200) fail(`Investor A listing expected HTTP 200, received ${aList.response.status}`, JSON.stringify(aList.body, null, 2));
    const aDocuments = Array.isArray(aList.body?.documents) ? aList.body.documents : [];
    if (aDocuments.length !== 1 || aDocuments[0]?.id !== DOCUMENT_ID || aDocuments[0]?.investor_code !== INVESTOR_A_CODE || aDocuments[0]?.document_name !== DOCUMENT_NAME || aDocuments[0]?.download_ready !== true) {
      fail("Investor A Data Room listing mismatch", JSON.stringify(aList.body, null, 2));
    }
    assertNoStorageCoordinates(aDocuments[0], "Investor A listing");
    pass("Investor A sees only the entitled A3 restricted Data Room document");
    pass("Investor A listing ignores tampered investorCode and exposes no storage coordinates");

    const aAccess = await accessDocument(tokenA);
    if (aAccess.response.status !== 200 || !aAccess.body?.signedUrl || Number(aAccess.body?.expiresInSeconds) <= 0) {
      fail(`Investor A document access expected HTTP 200 + signed URL, received ${aAccess.response.status}`, JSON.stringify(aAccess.body, null, 2));
    }
    assertNoStorageCoordinates(aAccess.body?.document, "Investor A signed response");
    pass("Investor A receives a short-lived signed URL for own Data Room document");
    pass("Signed-document response exposes no permanent storage coordinates");

    const eventsBeforeA = await countRows("data_room_engagement_events", "recorded_by", investorA.userId);
    const questionsBeforeA = await countRows("data_room_questions", "created_by", investorA.userId);

    const viewEvent = await workflowPost(tokenA, {
      operation: "record_engagement",
      fundName: FUND_NAME,
      sourceBatchId: SOURCE_BATCH_ID,
      investorCode: INVESTOR_B_CODE,
      documentId: DOCUMENT_ID,
      action: "Viewed",
      note: "A7-5E governed Investor view proof",
    });
    if (viewEvent.response.status !== 201 || viewEvent.body?.engagementEvent?.investor_code !== INVESTOR_A_CODE || viewEvent.body?.engagementEvent?.action !== "Viewed") {
      fail(`Investor A engagement expected HTTP 201 for A3, received ${viewEvent.response.status}`, JSON.stringify(viewEvent.body, null, 2));
    }
    pass("Investor A View engagement is recorded against A3 despite tampered body investorCode");

    const qaQuestion = "For A7-5 QA, please confirm whether this Fund Overview is the current portal version available to my investor account.";
    const questionResult = await workflowPost(tokenA, {
      operation: "create_question",
      fundName: FUND_NAME,
      sourceBatchId: SOURCE_BATCH_ID,
      investorCode: INVESTOR_B_CODE,
      documentId: DOCUMENT_ID,
      category: "Fund Overview",
      question: qaQuestion,
      status: "Open",
    });
    if (questionResult.response.status !== 201 || questionResult.body?.question?.investor_code !== INVESTOR_A_CODE || questionResult.body?.question?.question !== qaQuestion) {
      fail(`Investor A DDQ expected HTTP 201 for A3, received ${questionResult.response.status}`, JSON.stringify(questionResult.body, null, 2));
    }
    const questionId = questionResult.body?.question?.id;
    if (!questionId) fail("Investor A DDQ response has no question id");
    pass("Investor A created a real A3 DDQ question through the production workflow");

    const aWorkflow = await workflowGet(tokenA, INVESTOR_B_CODE);
    if (aWorkflow.response.status !== 200) fail(`Investor A workflow GET expected HTTP 200, received ${aWorkflow.response.status}`, JSON.stringify(aWorkflow.body, null, 2));
    const aQuestions = Array.isArray(aWorkflow.body?.questions) ? aWorkflow.body.questions : [];
    const aEvents = Array.isArray(aWorkflow.body?.engagementEvents) ? aWorkflow.body.engagementEvents : [];
    if (!aQuestions.some((row) => row?.id === questionId && row?.investor_code === INVESTOR_A_CODE) || !aEvents.some((row) => row?.action === "Viewed" && row?.investor_code === INVESTOR_A_CODE) || !aEvents.some((row) => row?.action === "Asked Question" && row?.investor_code === INVESTOR_A_CODE)) {
      fail("Investor A governed DDQ/history retrieval mismatch", JSON.stringify(aWorkflow.body, null, 2));
    }

    const eventsAfterA = await countRows("data_room_engagement_events", "recorded_by", investorA.userId);
    const questionsAfterA = await countRows("data_room_questions", "created_by", investorA.userId);
    if (eventsAfterA - eventsBeforeA !== 2) fail(`Investor A expected exactly 2 new engagement rows, got ${eventsAfterA - eventsBeforeA}`);
    if (questionsAfterA - questionsBeforeA !== 1) fail(`Investor A expected exactly 1 new DDQ row, got ${questionsAfterA - questionsBeforeA}`);
    pass("Investor A workflow history returns its A3 question and engagement evidence");
    pass("Investor A created exactly 1 DDQ row + 2 engagement rows");

    console.log("");
    console.log("Investor B — tampered A3 Data Room access");
    console.log("------------------------------------------");

    const bList = await listDocuments(tokenB, INVESTOR_A_CODE);
    if (bList.response.status !== 200) fail(`Investor B listing expected HTTP 200 for own context, received ${bList.response.status}`, JSON.stringify(bList.body, null, 2));
    const bDocuments = Array.isArray(bList.body?.documents) ? bList.body.documents : [];
    if (bDocuments.some((row) => row?.id === DOCUMENT_ID || row?.investor_code === INVESTOR_A_CODE)) {
      fail("Investor B listing disclosed A3 restricted document", JSON.stringify(bList.body, null, 2));
    }
    pass("Investor B cannot force A3 document metadata with investorCode=A3TEST001");

    const bAccess = await accessDocument(tokenB);
    if (bAccess.response.status !== 404 || bAccess.body?.signedUrl) {
      fail(`Investor B direct A3 access expected HTTP 404, received ${bAccess.response.status}`, JSON.stringify(bAccess.body, null, 2));
    }
    pass("Investor B direct A3 document access returns HTTP 404 and no signed URL");

    const bWorkflow = await workflowGet(tokenB, INVESTOR_A_CODE);
    if (bWorkflow.response.status !== 200) fail(`Investor B workflow GET expected HTTP 200 for own context, received ${bWorkflow.response.status}`, JSON.stringify(bWorkflow.body, null, 2));
    const bQuestions = Array.isArray(bWorkflow.body?.questions) ? bWorkflow.body.questions : [];
    const bEvents = Array.isArray(bWorkflow.body?.engagementEvents) ? bWorkflow.body.engagementEvents : [];
    if (bQuestions.some((row) => row?.investor_code === INVESTOR_A_CODE) || bEvents.some((row) => row?.investor_code === INVESTOR_A_CODE)) {
      fail("Investor B workflow disclosed A3 DDQ/engagement history", JSON.stringify(bWorkflow.body, null, 2));
    }
    pass("Investor B tampered workflow query cannot disclose A3 DDQ or engagement history");

    const bQuestionsBefore = await countRows("data_room_questions", "created_by", investorB.userId);
    const bEventsBefore = await countRows("data_room_engagement_events", "recorded_by", investorB.userId);
    const bQuestionAttempt = await workflowPost(tokenB, {
      operation: "create_question",
      fundName: FUND_NAME,
      sourceBatchId: SOURCE_BATCH_ID,
      investorCode: INVESTOR_A_CODE,
      documentId: DOCUMENT_ID,
      category: "Fund Overview",
      question: "Attempted cross-investor A3 question",
      status: "Open",
    });
    if (bQuestionAttempt.response.status !== 404) {
      fail(`Investor B cross-investor DDQ expected HTTP 404, received ${bQuestionAttempt.response.status}`, JSON.stringify(bQuestionAttempt.body, null, 2));
    }
    const bQuestionsAfter = await countRows("data_room_questions", "created_by", investorB.userId);
    const bEventsAfter = await countRows("data_room_engagement_events", "recorded_by", investorB.userId);
    if (bQuestionsAfter !== bQuestionsBefore || bEventsAfter !== bEventsBefore) fail("Investor B denied DDQ attempt created workflow rows");
    pass("Investor B cannot submit a DDQ against the A3 restricted document");
    pass("Investor B denied attempt creates no DDQ or engagement rows");

    console.log("");
    console.log("PASS - A7-5E INVESTOR DATA ROOM + DDQ ISOLATION REGRESSION");
    console.log("==========================================================");
    console.log("A3 entitled Investor: restricted listing + signed access PASS");
    console.log("Metadata exposure:     no permanent storage coordinates PASS");
    console.log("DDQ workflow:          real A3 question + engagement history PASS");
    console.log("URL/body tampering:    ignored for Investor role PASS");
    console.log("Wrong Investor:        no A3 metadata / signed URL / DDQ disclosure PASS");
  } finally {
    await cleanup();
    if (createdUserIds.length > 0) {
      console.log("");
      console.log("PASS - temporary A7-5E users and workflow test rows cleaned");
    }
  }
}

main().catch((error) => {
  console.error("");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
