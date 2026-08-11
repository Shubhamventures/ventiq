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
const INVESTOR_B_CODE = "A7-CASHFLOW-ISOLATION-NO-A3";

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
    email: `a7.cashflow.${label.toLowerCase()}.${nonce}@ventiq.test`,
    password: `Ventiq-A7-${crypto.randomUUID()}!`,
    fullName: `A7 Cashflow Test ${label}`,
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
        ventiq_test_stage: "A7-3E",
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

  pass(
    `${account.label} cashflow entitlement -> ${account.investorCode}`
  );
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

async function callCashflows(token, investorCodeParam) {
  const url = new URL("/api/investor-portal/cashflows", APP_URL);

  url.searchParams.set("fundName", FUND_NAME);

  // Deliberately include a browser-requested investorCode.
  // Investor-role endpoint must ignore it and derive identity from entitlement.
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

async function getAuditRows(userIds) {
  const { data, error } = await admin
    .from("ventiq_investor_cashflow_access_events")
    .select(
      "actor_user_id,actor_email,actor_role,investor_code,entitlement_basis,capital_call_count,receipt_count,distribution_count,created_at"
    )
    .eq("fund_name", FUND_NAME)
    .in("actor_user_id", userIds)
    .order("created_at", { ascending: true });

  if (error) {
    fail("cashflow audit verification", error.message);
  }

  return data || [];
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
  console.log("VENTIQ A7-3E Investor Cashflow Isolation Regression");
  console.log("====================================================");
  console.log(`Fund: ${FUND_NAME}`);
  console.log(`Canonical investor: ${INVESTOR_A_CODE}`);
  console.log(`Endpoint: ${APP_URL}/api/investor-portal/cashflows`);
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
      .eq("module_key", "investor_cashflows_portal")
      .maybeSingle();

    if (
      moduleError ||
      !moduleRow ||
      moduleRow.status !== "Active" ||
      Number(moduleRow.readiness_score) !== 100
    ) {
      fail(
        "Investor Cashflows Portal activation precondition",
        moduleError?.message || JSON.stringify(moduleRow, null, 2)
      );
    }
    pass("Investor Cashflows Portal is Active at 100% readiness");

    const { data: allocation, error: allocationError } = await admin
      .from("capital_call_allocations")
      .select(
        "allocation_code,investor_code,called_amount,total_due,status"
      )
      .eq("fund_name", FUND_NAME)
      .eq("investor_code", INVESTOR_A_CODE)
      .eq("allocation_code", "A7QA-CCA-001-A3TEST001")
      .maybeSingle();

    if (
      allocationError ||
      !allocation ||
      Number(allocation.called_amount) !== 400000 ||
      Number(allocation.total_due) !== 400000
    ) {
      fail(
        "A3 capital-call allocation precondition",
        allocationError?.message || JSON.stringify(allocation, null, 2)
      );
    }
    pass("A3TEST001 ₹4,00,000 capital-call allocation exists");

    const { data: receipt, error: receiptError } = await admin
      .from("capital_call_receipts")
      .select(
        "receipt_code,investor_code,amount_received,net_contribution,receipt_status"
      )
      .eq("fund_name", FUND_NAME)
      .eq("investor_code", INVESTOR_A_CODE)
      .eq("receipt_code", "A7QA-CCR-001-A3TEST001")
      .maybeSingle();

    if (
      receiptError ||
      !receipt ||
      Number(receipt.amount_received) !== 400000
    ) {
      fail(
        "A3 capital-call receipt precondition",
        receiptError?.message || JSON.stringify(receipt, null, 2)
      );
    }
    pass("A3TEST001 ₹4,00,000 receipt exists");

    const { data: distribution, error: distributionError } = await admin
      .from("distribution_allocations")
      .select(
        "distribution_allocation_code,investor_code,net_distribution,payment_status"
      )
      .eq("fund_name", FUND_NAME)
      .eq("investor_code", INVESTOR_A_CODE)
      .eq(
        "distribution_allocation_code",
        "A7QA-DA-001-A3TEST001"
      )
      .maybeSingle();

    if (
      distributionError ||
      !distribution ||
      Number(distribution.net_distribution) !== 100000
    ) {
      fail(
        "A3 distribution precondition",
        distributionError?.message || JSON.stringify(distribution, null, 2)
      );
    }
    pass("A3TEST001 ₹1,00,000 distribution exists");

    await createQaInvestor(investorA);
    await createQaInvestor(investorB);

    const tokenA = await signIn(investorA);
    const tokenB = await signIn(investorB);

    console.log("");
    console.log("Investor A — own governed cashflow history");
    console.log("-------------------------------------------");

    const aResult = await callCashflows(tokenA, INVESTOR_A_CODE);

    if (
      aResult.response.status !== 200 ||
      aResult.body?.available !== true
    ) {
      fail(
        `Investor A expected HTTP 200 + available=true, received ${aResult.response.status}`,
        JSON.stringify(aResult.body, null, 2)
      );
    }

    if (aResult.body?.investor_code !== INVESTOR_A_CODE) {
      fail(
        "Investor A investor_code mismatch",
        JSON.stringify(aResult.body, null, 2)
      );
    }

    const summary = aResult.body?.summary || {};

    const expectedSummary = {
      capital_call_count: 1,
      receipt_count: 1,
      distribution_count: 1,
      total_called: 400000,
      total_due: 400000,
      total_received: 400000,
      total_outstanding: 0,
      total_distributed: 100000,
    };

    for (const [key, expected] of Object.entries(expectedSummary)) {
      const actual = Number(summary[key]);

      if (actual !== expected) {
        fail(
          `Investor A ${key} expected ${expected}, received ${actual}`,
          JSON.stringify(aResult.body, null, 2)
        );
      }
    }

    const capitalCalls = Array.isArray(aResult.body?.capital_calls)
      ? aResult.body.capital_calls
      : [];
    const distributions = Array.isArray(aResult.body?.distributions)
      ? aResult.body.distributions
      : [];

    if (
      capitalCalls.length !== 1 ||
      capitalCalls[0]?.capital_call_code !== "A7QA-CC-001" ||
      Number(capitalCalls[0]?.called_amount) !== 400000 ||
      Number(capitalCalls[0]?.amount_received) !== 400000 ||
      Number(capitalCalls[0]?.outstanding_amount) !== 0
    ) {
      fail(
        "Investor A capital-call payload mismatch",
        JSON.stringify(aResult.body, null, 2)
      );
    }

    if (
      distributions.length !== 1 ||
      distributions[0]?.distribution_code !== "A7QA-DIST-001" ||
      Number(distributions[0]?.net_distribution) !== 100000
    ) {
      fail(
        "Investor A distribution payload mismatch",
        JSON.stringify(aResult.body, null, 2)
      );
    }

    pass("Investor A received only the governed A3TEST001 cashflow history");
    pass(
      "Investor A summary = ₹4,00,000 called / ₹4,00,000 received / ₹0 outstanding / ₹1,00,000 distributed"
    );

    console.log("");
    console.log("Investor B — tampered A3TEST001 query");
    console.log("--------------------------------------");

    const bResult = await callCashflows(tokenB, INVESTOR_A_CODE);

    if (bResult.response.status !== 404) {
      fail(
        `Investor B tampered request expected non-disclosing HTTP 404, received ${bResult.response.status}`,
        JSON.stringify(bResult.body, null, 2)
      );
    }

    if (
      bResult.body?.available === true ||
      bResult.body?.investor_code === INVESTOR_A_CODE ||
      Array.isArray(bResult.body?.capital_calls) ||
      Array.isArray(bResult.body?.distributions)
    ) {
      fail(
        "Investor B response disclosed A3 cashflow data",
        JSON.stringify(bResult.body, null, 2)
      );
    }

    pass("Investor B cannot override entitlement with investorCode=A3TEST001");
    pass("Investor B receives non-disclosing HTTP 404 and no A3 cashflow payload");

    const auditRows = await getAuditRows(createdUserIds);

    const auditA = auditRows.filter(
      (row) => row.actor_user_id === investorA.userId
    );
    const auditB = auditRows.filter(
      (row) => row.actor_user_id === investorB.userId
    );

    if (auditA.length !== 1) {
      fail(
        `Investor A expected exactly 1 successful cashflow audit row, found ${auditA.length}`,
        JSON.stringify(auditA, null, 2)
      );
    }

    if (
      auditA[0].investor_code !== INVESTOR_A_CODE ||
      auditA[0].actor_role !== "investor" ||
      auditA[0].entitlement_basis !==
        `ventiq_user_investor_access:${INVESTOR_A_CODE}:financials` ||
      Number(auditA[0].capital_call_count) !== 1 ||
      Number(auditA[0].receipt_count) !== 1 ||
      Number(auditA[0].distribution_count) !== 1
    ) {
      fail(
        "Investor A audit evidence mismatch",
        JSON.stringify(auditA[0], null, 2)
      );
    }

    if (auditB.length !== 0) {
      fail(
        `Investor B should have no successful cashflow-release audit row, found ${auditB.length}`,
        JSON.stringify(auditB, null, 2)
      );
    }

    pass("Investor A successful release produced exactly one governed audit row");
    pass("Investor B denied attempt produced no successful release audit row");

    console.log("");
    console.log("PASS - A7-3E INVESTOR CASHFLOW ISOLATION REGRESSION");
    console.log("====================================================");
    console.log("A3 entitled Investor: HTTP 200 + exact governed cashflow history");
    console.log("Wrong Investor:       HTTP 404 + no A3 disclosure");
    console.log("URL tampering:        ignored for Investor role");
    console.log("Audit:                successful release only");
  } finally {
    await cleanup();

    if (createdUserIds.length > 0) {
      console.log("");
      console.log("PASS - temporary A7-3E users and access rows cleaned");
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
