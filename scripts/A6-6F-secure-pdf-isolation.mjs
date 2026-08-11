import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

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

const APP_URL = (process.env.VENTIQ_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
const SITE_LOCK_TOKEN = process.env.SITE_LOCK_TOKEN || "";

const ORGANISATION_ID = "2febaacd-ef58-4444-8715-9bbd0d38238d";
const FUND_NAME = "VENTIQ Access Test Fund";
const INVESTOR_A_CODE = "A3TEST001";
const INVESTOR_B_CODE = "A6-ISOLATION-NO-A3";
const DOCUMENT_ID = "487c8e72-3c90-40ac-a01c-4ac19f1f98ac";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY || !SITE_LOCK_TOKEN) {
  console.error("FAIL - Missing Supabase environment variables.");
  console.error(
    "Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY, SITE_LOCK_TOKEN"
  );
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

const publicClient = createClient(SUPABASE_URL, ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

function randomPassword() {
  return `A6!${crypto.randomBytes(18).toString("base64url")}9z`;
}

function stamp() {
  return `${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
}

const runKey = stamp();
const investorA = {
  email: `a6.pdf.a.${runKey}@ventiq.test`,
  password: randomPassword(),
  name: "A6 PDF Isolation Investor A",
  investorCode: INVESTOR_A_CODE,
};

const investorB = {
  email: `a6.pdf.b.${runKey}@ventiq.test`,
  password: randomPassword(),
  name: "A6 PDF Isolation Investor B",
  investorCode: INVESTOR_B_CODE,
};

const createdUserIds = [];

function pass(message) {
  console.log(`PASS - ${message}`);
}

function fail(message, details) {
  console.error(`FAIL - ${message}`);
  if (details) console.error(details);
  throw new Error(message);
}

async function createQaInvestor(account, entitleToA3) {
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: account.email,
    password: account.password,
    email_confirm: true,
    user_metadata: {
      full_name: account.name,
      ventiq_test_only: true,
      ventiq_test_key: runKey,
    },
  });

  if (authError || !authData?.user) {
    fail(`unable to create ${account.name}`, authError?.message);
  }

  const userId = authData.user.id;
  createdUserIds.push(userId);
  pass(`${account.name} auth user created`);

  const { error: profileError } = await admin
    .from("ventiq_user_profiles")
    .upsert(
      {
        user_id: userId,
        email: account.email,
        full_name: account.name,
        default_role: "investor",
        active_organisation_id: ORGANISATION_ID,
        status: "Active",
      },
      { onConflict: "user_id" }
    );

  if (profileError) {
    fail(`${account.name} profile provisioning`, profileError.message);
  }
  pass(`${account.name} active investor profile`);

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
        investor_id: entitleToA3 ? INVESTOR_A_CODE : INVESTOR_B_CODE,
        status: "Active",
      },
      { onConflict: "organisation_id,user_id,fund_name" }
    );

  if (fundAccessError) {
    fail(`${account.name} fund access provisioning`, fundAccessError.message);
  }
  pass(`${account.name} read-only fund access`);

  const { error: entitlementError } = await admin
    .from("ventiq_user_investor_access")
    .insert({
      organisation_id: ORGANISATION_ID,
      user_id: userId,
      fund_name: FUND_NAME,
      investor_code: entitleToA3 ? INVESTOR_A_CODE : INVESTOR_B_CODE,
      status: "Active",
      can_view_documents: true,
      can_download_documents: true,
    });

  if (entitlementError) {
    fail(`${account.name} investor entitlement provisioning`, entitlementError.message);
  }

  pass(
    `${account.name} entitlement -> ${
      entitleToA3 ? INVESTOR_A_CODE : INVESTOR_B_CODE
    }`
  );

  return userId;
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
    fail(`${account.name} JWT authentication`, error?.message);
  }

  pass(`${account.name} authenticated with real Investor JWT`);
  return data.session.access_token;
}

async function callSecurePdf(token, accessMode) {
  const response = await fetch(`${APP_URL}/api/investor-portal/document-access`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Cookie: `ventiq_site_access=${encodeURIComponent(SITE_LOCK_TOKEN)}`,
    },
    body: JSON.stringify({
      document_id: DOCUMENT_ID,
      access_mode: accessMode,
    }),
  });

  let body;
  try {
    body = await response.json();
  } catch {
    body = {};
  }

  return { response, body };
}

async function countAuditRowsForQaUsers(userIds) {
  const { count, error } = await admin
    .from("ventiq_investor_document_access_events")
    .select("id", { count: "exact", head: true })
    .eq("investor_document_id", DOCUMENT_ID)
    .in("actor_user_id", userIds);

  if (error) fail("audit-row verification", error.message);
  return count ?? 0;
}

async function cleanup() {
  for (const userId of createdUserIds.reverse()) {
    try {
      // Child access/profile rows should cascade from auth.users. Explicit deletes
      // below keep the test clean even if a particular FK does not cascade.
      await admin
        .from("ventiq_user_investor_access")
        .delete()
        .eq("user_id", userId)
        .eq("fund_name", FUND_NAME);

      await admin
        .from("ventiq_user_fund_access")
        .delete()
        .eq("user_id", userId)
        .eq("fund_name", FUND_NAME);

      await admin
        .from("ventiq_user_profiles")
        .delete()
        .eq("user_id", userId);

      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) {
        console.warn(`WARN - QA auth cleanup failed for ${userId}: ${error.message}`);
      }
    } catch (error) {
      console.warn(
        `WARN - QA cleanup failed for ${userId}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}

async function main() {
  console.log("");
  console.log("VENTIQ A6-6F Secure Investor PDF Isolation Regression");
  console.log("======================================================");
  console.log(`Fund: ${FUND_NAME}`);
  console.log(`Canonical investor: ${INVESTOR_A_CODE}`);
  console.log(`Canonical document: ${DOCUMENT_ID}`);
  console.log(`Endpoint: ${APP_URL}/api/investor-portal/document-access`);
  console.log("Site lock: authenticated from SITE_LOCK_TOKEN in .env.local");
  console.log("Temporary QA users are created and deleted automatically.");
  console.log("");

  try {
    const { data: documentRow, error: documentError } = await admin
      .from("investor_documents")
      .select(
        "id, fund_name, investor_code, status, portal_status, storage_bucket, storage_path"
      )
      .eq("id", DOCUMENT_ID)
      .maybeSingle();

    if (documentError || !documentRow) {
      fail("canonical A3 investor document exists", documentError?.message);
    }

    if (
      String(documentRow.fund_name || "") !== FUND_NAME ||
      String(documentRow.investor_code || "") !== INVESTOR_A_CODE ||
      String(documentRow.status || "").toLowerCase() !== "published" ||
      String(documentRow.portal_status || "").toLowerCase() !== "available" ||
      !documentRow.storage_bucket ||
      !documentRow.storage_path
    ) {
      fail(
        "canonical document preconditions",
        JSON.stringify(documentRow, null, 2)
      );
    }
    pass("canonical A3 document is Published, available, and privately stored");

    await createQaInvestor(investorA, true);
    await createQaInvestor(investorB, false);

    const tokenA = await signIn(investorA);
    const tokenB = await signIn(investorB);

    const auditBefore = await countAuditRowsForQaUsers(createdUserIds);

    console.log("");
    console.log("Investor A — own document");
    console.log("--------------------------");

    const aView = await callSecurePdf(tokenA, "view");
    if (aView.response.status !== 200 || !aView.body?.signed_url) {
      fail(
        `Investor A own View expected HTTP 200, received ${aView.response.status}`,
        JSON.stringify(aView.body, null, 2)
      );
    }
    pass("Investor A can View own A3TEST001 PDF");

    const aDownload = await callSecurePdf(tokenA, "download");
    if (aDownload.response.status !== 200 || !aDownload.body?.signed_url) {
      fail(
        `Investor A own Download expected HTTP 200, received ${aDownload.response.status}`,
        JSON.stringify(aDownload.body, null, 2)
      );
    }
    pass("Investor A can Download own A3TEST001 PDF");

    console.log("");
    console.log("Investor B — cross-investor attack");
    console.log("----------------------------------");

    const bView = await callSecurePdf(tokenB, "view");
    if (bView.response.status !== 404) {
      fail(
        `Investor B cross-investor View expected non-disclosing HTTP 404, received ${bView.response.status}`,
        JSON.stringify(bView.body, null, 2)
      );
    }
    if (bView.body?.signed_url) {
      fail("Investor B cross-investor View unexpectedly received a signed URL");
    }
    pass("Investor B cannot View A3TEST001 PDF; endpoint returns non-disclosing 404");

    const bDownload = await callSecurePdf(tokenB, "download");
    if (bDownload.response.status !== 404) {
      fail(
        `Investor B cross-investor Download expected non-disclosing HTTP 404, received ${bDownload.response.status}`,
        JSON.stringify(bDownload.body, null, 2)
      );
    }
    if (bDownload.body?.signed_url) {
      fail("Investor B cross-investor Download unexpectedly received a signed URL");
    }
    pass("Investor B cannot Download A3TEST001 PDF; endpoint returns non-disclosing 404");

    const auditAfter = await countAuditRowsForQaUsers(createdUserIds);
    const newAuditRows = auditAfter - auditBefore;

    if (newAuditRows !== 2) {
      fail(
        `expected exactly 2 successful QA access audit rows (A view + A download), got ${newAuditRows}`
      );
    }
    pass("Only successful Investor A access created audit evidence (2 rows)");

    console.log("");
    console.log("======================================");
    console.log("PASS - A6-6F SECURE PDF ISOLATION");
    console.log(`Investor A (${INVESTOR_A_CODE}) -> View allowed, Download allowed`);
    console.log(`Investor B (${INVESTOR_B_CODE}) -> A3 PDF View blocked, Download blocked`);
    console.log("Cross-investor document existence is not disclosed.");
    console.log("Signed URLs are never released to Investor B.");
  } finally {
    await cleanup();
    console.log("");
    console.log("PASS - temporary A6 PDF isolation users/access rows cleaned up");
  }
}

main().catch((error) => {
  console.error("");
  console.error(
    error instanceof Error ? error.stack || error.message : String(error)
  );
  process.exit(1);
});
