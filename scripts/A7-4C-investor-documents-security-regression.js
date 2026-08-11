const { createClient } = require("@supabase/supabase-js");
const crypto = require("node:crypto");

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "";

const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  "";

const ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "";

const SITE_LOCK_TOKEN =
  process.env.SITE_LOCK_TOKEN ||
  process.env.VENTIQ_SITE_LOCK_TOKEN ||
  "";

const APP_URL = process.env.VENTIQ_APP_URL || "http://localhost:3000";

const ORGANISATION_ID = "2febaacd-ef58-4444-8715-9bbd0d38238d";
const FUND_NAME = "VENTIQ Access Test Fund";
const INVESTOR_A_CODE = "A3TEST001";
const INVESTOR_B_CODE = "A7-DOCUMENT-ISOLATION-NO-A3";
const CANONICAL_DOCUMENT_ID = "487c8e72-3c90-40ac-a01c-4ac19f1f98ac";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
  console.error("FAIL - Missing required Supabase environment variables.");
  process.exit(1);
}

if (!SITE_LOCK_TOKEN) {
  console.error("FAIL - SITE_LOCK_TOKEN is missing from .env.local.");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

const createdUserIds = [];

function pass(message) {
  console.log(`PASS - ${message}`);
}

function fail(message, detail) {
  console.error(`FAIL - ${message}`);
  if (detail) console.error(detail);
  throw new Error(message);
}

function makeAccount(label, investorCode) {
  const nonce = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

  return {
    label,
    investorCode,
    email: `a7.documents.${label.toLowerCase()}.${nonce}@ventiq.test`,
    password: `Ventiq-A7-${crypto.randomUUID()}!`,
    fullName: `A7 Documents Test ${label}`,
  };
}

async function createQaInvestor(account) {
  const { data: authData, error: authError } =
    await admin.auth.admin.createUser({
      email: account.email,
      password: account.password,
      email_confirm: true,
      user_metadata: {
        full_name: account.fullName,
        ventiq_test_only: true,
        ventiq_test_stage: "A7-4C",
      },
    });

  if (authError || !authData?.user) {
    fail(`${account.label} auth user provisioning`, authError?.message);
  }

  const userId = authData.user.id;
  createdUserIds.push(userId);
  account.userId = userId;
  pass(`${account.label} temporary auth user created`);

  const { error: profileError } = await admin
    .from("ventiq_user_profiles")
    .upsert(
      {
        user_id: userId,
        email: account.email,
        full_name: account.fullName,
        default_role: "investor",
        active_organisation_id: ORGANISATION_ID,
        investor_id: account.investorCode,
        status: "Active",
      },
      { onConflict: "user_id" }
    );

  if (profileError) {
    fail(`${account.label} profile provisioning`, profileError.message);
  }
  pass(`${account.label} Active Investor profile ready`);

  const { error: membershipError } = await admin
    .from("ventiq_organisation_members")
    .insert({
      organisation_id: ORGANISATION_ID,
      user_id: userId,
      role: "investor",
      status: "Active",
      is_primary: true,
    });

  if (membershipError) {
    fail(`${account.label} organisation membership`, membershipError.message);
  }
  pass(`${account.label} organisation membership ready`);

  const { error: fundAccessError } = await admin
    .from("ventiq_user_fund_access")
    .upsert(
      {
        organisation_id: ORGANISATION_ID,
        user_id: userId,
        fund_name: FUND_NAME,
        role: "investor",
        can_view: true,
        can_edit: false,
        can_approve: false,
        investor_id: account.investorCode,
        status: "Active",
      },
      { onConflict: "organisation_id,user_id,fund_name" }
    );

  if (fundAccessError) {
    fail(`${account.label} fund access provisioning`, fundAccessError.message);
  }
  pass(`${account.label} read-only fund access ready`);

  const { error: entitlementError } = await admin
    .from("ventiq_user_investor_access")
    .insert({
      organisation_id: ORGANISATION_ID,
      user_id: userId,
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

  if (entitlementError) {
    fail(
      `${account.label} investor entitlement provisioning`,
      entitlementError.message
    );
  }

  pass(`${account.label} document entitlement -> ${account.investorCode}`);
}

async function signIn(account) {
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data, error } = await client.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  });

  if (error || !data?.session?.access_token) {
    fail(`${account.label} JWT authentication`, error?.message);
  }

  pass(`${account.label} authenticated with real Investor JWT`);
  return data.session.access_token;
}

async function callDocuments(token, investorCodeParam) {
  const url = new URL("/api/investor-portal/documents", APP_URL);
  url.searchParams.set("fundName", FUND_NAME);

  // Deliberately tampered browser identity. Investor endpoint must ignore it.
  url.searchParams.set("investorCode", investorCodeParam);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Cookie: `ventiq_site_access=${encodeURIComponent(SITE_LOCK_TOKEN)}`,
      Accept: "application/json",
    },
  });

  let body = {};
  try {
    body = await response.json();
  } catch {
    body = {};
  }

  return { response, body };
}

async function callDocumentAccess(token, mode) {
  const url = new URL("/api/investor-portal/document-access", APP_URL);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Cookie: `ventiq_site_access=${encodeURIComponent(SITE_LOCK_TOKEN)}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      document_id: CANONICAL_DOCUMENT_ID,
      access_mode: mode,
    }),
  });

  let body = {};
  try {
    body = await response.json();
  } catch {
    body = {};
  }

  return { response, body };
}

async function countDocumentAuditRows(userId) {
  const { count, error } = await admin
    .from("ventiq_investor_document_access_events")
    .select("id", { count: "exact", head: true })
    .eq("actor_user_id", userId)
    .eq("investor_document_id", CANONICAL_DOCUMENT_ID);

  if (error) {
    fail("document audit count", error.message);
  }

  return Number(count || 0);
}

async function cleanup() {
  for (const userId of [...createdUserIds].reverse()) {
    try {
      await admin
        .from("ventiq_user_investor_access")
        .delete()
        .eq("user_id", userId);

      await admin
        .from("ventiq_user_fund_access")
        .delete()
        .eq("user_id", userId);

      await admin
        .from("ventiq_organisation_members")
        .delete()
        .eq("user_id", userId);

      await admin
        .from("ventiq_user_profiles")
        .delete()
        .eq("user_id", userId);

      const { error: authDeleteError } =
        await admin.auth.admin.deleteUser(userId);

      if (authDeleteError) {
        console.warn(
          `WARN - auth cleanup failed for ${userId}: ${authDeleteError.message}`
        );
      }
    } catch (error) {
      console.warn(
        `WARN - cleanup failed for ${userId}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}

async function main() {
  console.log("");
  console.log("VENTIQ A7-4C Investor Documents Security Regression");
  console.log("====================================================");
  console.log(`Fund: ${FUND_NAME}`);
  console.log(`Canonical investor: ${INVESTOR_A_CODE}`);
  console.log(`Canonical document: ${CANONICAL_DOCUMENT_ID}`);
  console.log("Temporary QA users are created and deleted automatically.");
  console.log("");

  const investorA = makeAccount("Investor-A", INVESTOR_A_CODE);
  const investorB = makeAccount("Investor-B", INVESTOR_B_CODE);

  try {
    const { data: moduleRow, error: moduleError } = await admin
      .from("ventiq_module_activation_status")
      .select("status,readiness_score")
      .eq("organisation_id", ORGANISATION_ID)
      .eq("fund_name", FUND_NAME)
      .eq("module_key", "investor_documents_portal")
      .maybeSingle();

    if (
      moduleError ||
      !moduleRow ||
      moduleRow.status !== "Active" ||
      Number(moduleRow.readiness_score) !== 100
    ) {
      fail(
        "Investor Documents Portal activation precondition",
        moduleError?.message || JSON.stringify(moduleRow, null, 2)
      );
    }
    pass("Investor Documents Portal is Active at 100% readiness");

    const { data: documentRow, error: documentError } = await admin
      .from("investor_documents")
      .select(
        "id,fund_name,investor_code,document_type,document_name,status,portal_status,storage_bucket,storage_path,publish_source,fund_memory_snapshot_id,document_studio_generated_document_id"
      )
      .eq("id", CANONICAL_DOCUMENT_ID)
      .maybeSingle();

    if (
      documentError ||
      !documentRow ||
      documentRow.fund_name !== FUND_NAME ||
      documentRow.investor_code !== INVESTOR_A_CODE ||
      String(documentRow.status || "").toLowerCase() !== "published" ||
      String(documentRow.portal_status || "").toLowerCase() !== "available" ||
      !documentRow.storage_bucket ||
      !documentRow.storage_path
    ) {
      fail(
        "canonical A3 document precondition",
        documentError?.message || JSON.stringify(documentRow, null, 2)
      );
    }
    pass("canonical A3 SOA is Published, available, and privately stored");

    await createQaInvestor(investorA);
    await createQaInvestor(investorB);

    const tokenA = await signIn(investorA);
    const tokenB = await signIn(investorB);

    console.log("");
    console.log("Investor A — governed document listing");
    console.log("---------------------------------------");

    const aList = await callDocuments(tokenA, INVESTOR_A_CODE);

    if (
      aList.response.status !== 200 ||
      aList.body?.available !== true
    ) {
      fail(
        `Investor A listing expected HTTP 200 + available=true, received ${aList.response.status}`,
        JSON.stringify(aList.body, null, 2)
      );
    }

    if (aList.body?.investor_code !== INVESTOR_A_CODE) {
      fail(
        "Investor A listing investor_code mismatch",
        JSON.stringify(aList.body, null, 2)
      );
    }

    if (
      Number(aList.body?.summary?.total_documents) !== 1 ||
      Number(aList.body?.summary?.download_ready) !== 1 ||
      Number(aList.body?.summary?.canonical_documents) !== 1
    ) {
      fail(
        "Investor A document summary mismatch",
        JSON.stringify(aList.body, null, 2)
      );
    }

    const documents = Array.isArray(aList.body?.documents)
      ? aList.body.documents
      : [];

    if (
      documents.length !== 1 ||
      documents[0]?.id !== CANONICAL_DOCUMENT_ID ||
      documents[0]?.investor_code !== INVESTOR_A_CODE ||
      documents[0]?.download_ready !== true ||
      documents[0]?.canonical !== true
    ) {
      fail(
        "Investor A canonical document listing mismatch",
        JSON.stringify(aList.body, null, 2)
      );
    }

    const forbiddenKeys = [
      "storage_bucket",
      "storage_path",
      "storage_url",
      "file_url",
      "signed_url",
    ];

    for (const key of forbiddenKeys) {
      if (Object.prototype.hasOwnProperty.call(documents[0], key)) {
        fail(
          `Investor A listing unexpectedly exposes ${key}`,
          JSON.stringify(documents[0], null, 2)
        );
      }
    }

    pass("Investor A listing returns only the canonical A3 SOA");
    pass("Investor A listing exposes no storage path, bucket, permanent URL or signed URL");

    const auditBeforeA = await countDocumentAuditRows(investorA.userId);

    const aView = await callDocumentAccess(tokenA, "view");
    if (aView.response.status !== 200 || !aView.body?.signed_url) {
      fail(
        `Investor A View expected HTTP 200 + signed URL, received ${aView.response.status}`,
        JSON.stringify(aView.body, null, 2)
      );
    }
    pass("Investor A can securely View own A3 SOA");

    const aDownload = await callDocumentAccess(tokenA, "download");
    if (aDownload.response.status !== 200 || !aDownload.body?.signed_url) {
      fail(
        `Investor A Download expected HTTP 200 + signed URL, received ${aDownload.response.status}`,
        JSON.stringify(aDownload.body, null, 2)
      );
    }
    pass("Investor A can securely Download own A3 SOA");

    const auditAfterA = await countDocumentAuditRows(investorA.userId);

    if (auditAfterA - auditBeforeA !== 2) {
      fail(
        `Investor A expected exactly 2 new document-access audit rows, got ${auditAfterA - auditBeforeA}`
      );
    }
    pass("Investor A View + Download created exactly 2 governed audit rows");

    console.log("");
    console.log("Investor B — tampered A3TEST001 listing/access");
    console.log("-----------------------------------------------");

    const bList = await callDocuments(tokenB, INVESTOR_A_CODE);

    if (bList.response.status !== 404) {
      fail(
        `Investor B tampered listing expected non-disclosing HTTP 404, received ${bList.response.status}`,
        JSON.stringify(bList.body, null, 2)
      );
    }

    if (
      bList.body?.available === true ||
      bList.body?.investor_code === INVESTOR_A_CODE ||
      Array.isArray(bList.body?.documents)
    ) {
      fail(
        "Investor B listing disclosed A3 document metadata",
        JSON.stringify(bList.body, null, 2)
      );
    }

    pass("Investor B cannot override listing identity with investorCode=A3TEST001");
    pass("Investor B receives non-disclosing HTTP 404 and no A3 document metadata");

    const auditBeforeB = await countDocumentAuditRows(investorB.userId);

    const bView = await callDocumentAccess(tokenB, "view");
    if (bView.response.status !== 404 || bView.body?.signed_url) {
      fail(
        `Investor B cross-investor View expected HTTP 404 with no signed URL, received ${bView.response.status}`,
        JSON.stringify(bView.body, null, 2)
      );
    }
    pass("Investor B cannot View the A3 SOA");

    const bDownload = await callDocumentAccess(tokenB, "download");
    if (bDownload.response.status !== 404 || bDownload.body?.signed_url) {
      fail(
        `Investor B cross-investor Download expected HTTP 404 with no signed URL, received ${bDownload.response.status}`,
        JSON.stringify(bDownload.body, null, 2)
      );
    }
    pass("Investor B cannot Download the A3 SOA");

    const auditAfterB = await countDocumentAuditRows(investorB.userId);

    if (auditAfterB !== auditBeforeB) {
      fail(
        `Investor B denied attempts should create no successful document release audit rows; before=${auditBeforeB}, after=${auditAfterB}`
      );
    }
    pass("Investor B denied attempts created no successful release audit rows");

    console.log("");
    console.log("PASS - A7-4C INVESTOR DOCUMENTS SECURITY REGRESSION");
    console.log("====================================================");
    console.log("A3 entitled Investor: listing 200 + own canonical SOA only");
    console.log("Metadata exposure:     no storage path/bucket/permanent URL");
    console.log("View / Download:       200 + short-lived signed URLs");
    console.log("Wrong Investor:        404 + no A3 metadata/PDF disclosure");
    console.log("URL tampering:         ignored for Investor role");
    console.log("Audit:                 successful PDF releases only");
  } finally {
    await cleanup();

    if (createdUserIds.length > 0) {
      console.log("");
      console.log("PASS - temporary A7-4C users and access rows cleaned");
    }
  }
}

main().catch((error) => {
  console.error("");
  console.error(
    error instanceof Error ? error.message : String(error)
  );
  process.exit(1);
});
