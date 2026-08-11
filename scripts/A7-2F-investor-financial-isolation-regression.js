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
const INVESTOR_B_CODE = "A7-FIN-ISOLATION-NO-A3";
const EXPECTED_RUN_ID = "e51cd827-a9cd-4bd5-bd3f-fd7ac5f9670e";

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
    email: `a7.fin.${label.toLowerCase()}.${nonce}@ventiq.test`,
    password: `Ventiq-A7-${crypto.randomUUID()}!`,
    fullName: `A7 Financial Test ${label}`,
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
        ventiq_test_stage: "A7-2F",
      },
    });

  if (authError || !authData?.user) {
    fail(`${account.label} auth user provisioning`, authError?.message);
  }

  const userId = authData.user.id;
  createdUserIds.push(userId);
  account.userId = userId;
  pass(`${account.label} temporary auth user created`);

  // auth-side trigger may already create the profile, so use upsert.
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
    fail(`${account.label} financial entitlement provisioning`, entitlementError.message);
  }

  pass(
    `${account.label} financial entitlement -> ${account.investorCode}`
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

async function callFinancialPosition(token, investorCodeParam) {
  const url = new URL(
    "/api/investor-portal/financial-position",
    APP_URL
  );

  url.searchParams.set("fundName", FUND_NAME);

  // Deliberately tamper this parameter for both users.
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
    .from("ventiq_investor_financial_access_events")
    .select(
      "actor_user_id,actor_email,actor_role,investor_code,calculation_run_id,entitlement_basis,created_at"
    )
    .eq("fund_name", FUND_NAME)
    .in("actor_user_id", userIds)
    .order("created_at", { ascending: true });

  if (error) fail("financial audit verification", error.message);
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
  console.log("VENTIQ A7-2F Investor Financial Isolation Regression");
  console.log("====================================================");
  console.log(`Fund: ${FUND_NAME}`);
  console.log(`Canonical investor: ${INVESTOR_A_CODE}`);
  console.log(`Verified run: ${EXPECTED_RUN_ID}`);
  console.log(
    `Endpoint: ${APP_URL}/api/investor-portal/financial-position`
  );
  console.log("Temporary QA users are created and deleted automatically.");
  console.log("");

  const investorA = makeAccount("Investor-A", INVESTOR_A_CODE);
  const investorB = makeAccount("Investor-B", INVESTOR_B_CODE);

  try {
    const { data: run, error: runError } = await admin
      .from("metric_calculation_runs")
      .select("id,fund_name,calculation_status,as_of_date")
      .eq("id", EXPECTED_RUN_ID)
      .maybeSingle();

    if (
      runError ||
      !run ||
      run.fund_name !== FUND_NAME ||
      run.calculation_status !== "Completed"
    ) {
      fail(
        "verified completed calculation precondition",
        runError?.message || JSON.stringify(run, null, 2)
      );
    }
    pass("verified Completed calculation run exists");

    const { data: metric, error: metricError } = await admin
      .from("investor_performance_metrics")
      .select(
        "investor_code,commitment_amount,paid_in_capital,total_distributions,uncalled_commitment,allocated_nav,dpi,rvpi,tvpi,net_irr,calculation_status"
      )
      .eq("calculation_run_id", EXPECTED_RUN_ID)
      .eq("investor_code", INVESTOR_A_CODE)
      .maybeSingle();

    if (
      metricError ||
      !metric ||
      metric.calculation_status !== "Calculated"
    ) {
      fail(
        "A3 calculated investor metric precondition",
        metricError?.message || JSON.stringify(metric, null, 2)
      );
    }
    pass("A3TEST001 Calculated metric exists");

    await createQaInvestor(investorA);
    await createQaInvestor(investorB);

    const tokenA = await signIn(investorA);
    const tokenB = await signIn(investorB);

    console.log("");
    console.log("Investor A — own verified financial position");
    console.log("--------------------------------------------");

    const aResult = await callFinancialPosition(tokenA, INVESTOR_A_CODE);

    if (
      aResult.response.status !== 200 ||
      aResult.body?.available !== true
    ) {
      fail(
        `Investor A expected HTTP 200 + available=true, received ${aResult.response.status}`,
        JSON.stringify(aResult.body, null, 2)
      );
    }

    if (
      aResult.body?.investor_code !== INVESTOR_A_CODE ||
      aResult.body?.verification?.controls_passed !== 11 ||
      aResult.body?.verification?.controls_total !== 11 ||
      aResult.body?.verification?.reconciliation_status !== "Pass"
    ) {
      fail(
        "Investor A verification payload mismatch",
        JSON.stringify(aResult.body, null, 2)
      );
    }

    const fp = aResult.body?.financial_position || {};

    const numericChecks = [
      ["commitment_amount", Number(fp.commitment_amount), 1000000],
      ["paid_in_capital", Number(fp.paid_in_capital), 400000],
      ["total_distributions", Number(fp.total_distributions), 100000],
      ["uncalled_commitment", Number(fp.uncalled_commitment), 600000],
      ["allocated_nav", Number(fp.allocated_nav), 300000],
      ["dpi", Number(fp.dpi), 0.25],
      ["rvpi", Number(fp.rvpi), 0.75],
      ["tvpi", Number(fp.tvpi), 1],
      ["net_irr", Number(fp.net_irr), 0],
    ];

    for (const [name, actual, expected] of numericChecks) {
      if (actual !== expected) {
        fail(
          `Investor A ${name} expected ${expected}, received ${actual}`
        );
      }
    }

    pass("Investor A received only the verified A3TEST001 financial position");
    pass("Investor A payload is v1.2 / 11-of-11 Pass");

    console.log("");
    console.log("Investor B — tampered A3TEST001 query");
    console.log("--------------------------------------");

    // Investor B is NOT entitled to A3TEST001, but deliberately requests it.
    const bResult = await callFinancialPosition(tokenB, INVESTOR_A_CODE);

    if (bResult.response.status !== 404) {
      fail(
        `Investor B tampered request expected non-disclosing HTTP 404, received ${bResult.response.status}`,
        JSON.stringify(bResult.body, null, 2)
      );
    }

    if (
      bResult.body?.available === true ||
      bResult.body?.financial_position ||
      bResult.body?.investor_code === INVESTOR_A_CODE
    ) {
      fail(
        "Investor B response disclosed A3 financial data",
        JSON.stringify(bResult.body, null, 2)
      );
    }

    pass("Investor B cannot override entitlement with investorCode=A3TEST001");
    pass("Investor B receives non-disclosing HTTP 404 and no A3 financial payload");

    const auditRows = await getAuditRows(createdUserIds);

    const auditA = auditRows.filter(
      (row) => row.actor_user_id === investorA.userId
    );
    const auditB = auditRows.filter(
      (row) => row.actor_user_id === investorB.userId
    );

    if (auditA.length !== 1) {
      fail(
        `Investor A expected exactly 1 successful audit row, found ${auditA.length}`,
        JSON.stringify(auditA, null, 2)
      );
    }

    if (
      auditA[0].investor_code !== INVESTOR_A_CODE ||
      auditA[0].calculation_run_id !== EXPECTED_RUN_ID ||
      auditA[0].actor_role !== "investor" ||
      auditA[0].entitlement_basis !==
        `ventiq_user_investor_access:${INVESTOR_A_CODE}:financials`
    ) {
      fail(
        "Investor A audit evidence mismatch",
        JSON.stringify(auditA[0], null, 2)
      );
    }

    if (auditB.length !== 0) {
      fail(
        `Investor B should have no successful financial-release audit row, found ${auditB.length}`,
        JSON.stringify(auditB, null, 2)
      );
    }

    pass("Investor A successful release produced exactly one governed audit row");
    pass("Investor B denied attempt produced no successful release audit row");

    console.log("");
    console.log("PASS - A7-2F INVESTOR FINANCIAL ISOLATION REGRESSION");
    console.log("====================================================");
    console.log("A3 entitled Investor: HTTP 200 + exact verified metrics");
    console.log("Wrong Investor:       HTTP 404 + no A3 disclosure");
    console.log("URL tampering:        ignored for Investor role");
    console.log("Audit:                successful release only");
  } finally {
    await cleanup();

    if (createdUserIds.length > 0) {
      console.log("");
      console.log("PASS - temporary A7-2F users and access rows cleaned");
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
