const { createClient } = require("@supabase/supabase-js");
const { createInterface } = require("node:readline/promises");
const { stdin: input, stdout: output } = require("node:process");
const fs = require("node:fs/promises");
const path = require("node:path");

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "";

const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  "";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("FAIL - Missing Supabase server environment variables.");
  process.exit(1);
}

const ORGANISATION_ID = "2febaacd-ef58-4444-8715-9bbd0d38238d";
const FUND_NAME = "VENTIQ Access Test Fund";
const INVESTOR_CODE = "A3TEST001";
const INVESTOR_MASTER_ID = "e2003f74-d0aa-4476-87a2-a9a790a5afc6";
const STATE_FILE = path.resolve(".a7-2g-temp-investor.json");

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

function pass(message) {
  console.log(`PASS - ${message}`);
}

function fail(message, details = "") {
  console.error(`FAIL - ${message}`);
  if (details) console.error(details);
  throw new Error(message);
}

async function cleanupUser(userId) {
  if (!userId) return;

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

  await admin.auth.admin.deleteUser(userId);
}

async function main() {
  console.log("");
  console.log("VENTIQ A7-2G Temporary LP Browser Account");
  console.log("==========================================");
  console.log(`Fund: ${FUND_NAME}`);
  console.log(`Investor: ${INVESTOR_CODE}`);
  console.log("");

  try {
    await fs.access(STATE_FILE);
    fail(
      "A temporary A7-2G account state file already exists.",
      `Run the A7-2G cleanup script first or inspect: ${STATE_FILE}`
    );
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  const { data: investor, error: investorError } = await admin
    .from("investor_master")
    .select("id,investor_code,investor_name,email,fund_name")
    .eq("id", INVESTOR_MASTER_ID)
    .eq("fund_name", FUND_NAME)
    .eq("investor_code", INVESTOR_CODE)
    .maybeSingle();

  if (investorError || !investor) {
    fail(
      "canonical A3TEST001 investor record was not found",
      investorError?.message
    );
  }
  pass("canonical A3TEST001 investor master found");

  const rl = createInterface({ input, output });
  const password = await rl.question(
    "Choose a temporary password for the A7-2G LP login (minimum 10 characters): "
  );
  rl.close();

  if (!password || password.length < 10) {
    fail("temporary password must contain at least 10 characters");
  }

  const email = `a7.lp.financial.${Date.now()}@ventiq.test`;

  const { data: authData, error: authError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: "A7 Financial Browser LP - A3TEST001",
        ventiq_test_only: true,
        ventiq_test_stage: "A7-2G",
      },
    });

  if (authError || !authData?.user) {
    fail("unable to create temporary LP auth user", authError?.message);
  }

  const userId = authData.user.id;
  pass(`temporary auth user created: ${userId}`);

  try {
    const { error: profileError } = await admin
      .from("ventiq_user_profiles")
      .upsert(
        {
          user_id: userId,
          email,
          full_name: "A7 Financial Browser LP - A3TEST001",
          default_role: "investor",
          active_organisation_id: ORGANISATION_ID,
          investor_id: INVESTOR_CODE,
          status: "Active",
        },
        { onConflict: "user_id" }
      );

    if (profileError) {
      fail("investor profile provisioning", profileError.message);
    }
    pass("Active Investor profile ready with investor_id A3TEST001");

    const { data: existingMembership, error: membershipLookupError } =
      await admin
        .from("ventiq_organisation_members")
        .select("id")
        .eq("organisation_id", ORGANISATION_ID)
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();

    if (membershipLookupError) {
      fail("organisation membership lookup", membershipLookupError.message);
    }

    const membershipWrite = existingMembership?.id
      ? await admin
          .from("ventiq_organisation_members")
          .update({
            role: "investor",
            status: "Active",
            is_primary: true,
          })
          .eq("id", existingMembership.id)
      : await admin
          .from("ventiq_organisation_members")
          .insert({
            organisation_id: ORGANISATION_ID,
            user_id: userId,
            role: "investor",
            status: "Active",
            is_primary: true,
          });

    if (membershipWrite.error) {
      fail(
        "organisation membership provisioning",
        membershipWrite.error.message
      );
    }
    pass("Active organisation membership ready");

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
          investor_id: INVESTOR_CODE,
          status: "Active",
        },
        { onConflict: "organisation_id,user_id,fund_name" }
      );

    if (fundAccessError) {
      fail("read-only fund access provisioning", fundAccessError.message);
    }
    pass("read-only fund access ready");

    const { data: existingEntitlement, error: entitlementLookupError } =
      await admin
        .from("ventiq_user_investor_access")
        .select("id")
        .eq("organisation_id", ORGANISATION_ID)
        .eq("user_id", userId)
        .eq("fund_name", FUND_NAME)
        .eq("investor_code", INVESTOR_CODE)
        .limit(1)
        .maybeSingle();

    if (entitlementLookupError) {
      fail("investor entitlement lookup", entitlementLookupError.message);
    }

    const entitlementPayload = {
      organisation_id: ORGANISATION_ID,
      user_id: userId,
      fund_name: FUND_NAME,
      investor_code: INVESTOR_CODE,
      status: "Active",
      can_view_profile: true,
      can_view_financials: true,
      can_view_documents: true,
      can_download_documents: true,
      can_use_data_room: true,
      can_submit_questions: true,
    };

    const entitlementWrite = existingEntitlement?.id
      ? await admin
          .from("ventiq_user_investor_access")
          .update(entitlementPayload)
          .eq("id", existingEntitlement.id)
      : await admin
          .from("ventiq_user_investor_access")
          .insert(entitlementPayload);

    if (entitlementWrite.error) {
      fail(
        "investor entitlement provisioning",
        entitlementWrite.error.message
      );
    }

    pass("A3TEST001 financial/document/data-room entitlement ready");

    await fs.writeFile(
      STATE_FILE,
      JSON.stringify(
        {
          stage: "A7-2G",
          user_id: userId,
          email,
          organisation_id: ORGANISATION_ID,
          fund_name: FUND_NAME,
          investor_code: INVESTOR_CODE,
          created_at: new Date().toISOString(),
        },
        null,
        2
      ),
      "utf8"
    );

    console.log("");
    console.log("==========================================");
    console.log("PASS - A7-2G TEMPORARY LP ACCOUNT READY");
    console.log("");
    console.log(`LOGIN EMAIL: ${email}`);
    console.log("LOGIN PASSWORD: use the password you just entered locally");
    console.log("");
    console.log("Open: http://localhost:3000/auth/login");
    console.log("Expected role: Investor");
    console.log(`Expected fund: ${FUND_NAME}`);
    console.log(`Expected investor code: ${INVESTOR_CODE}`);
    console.log("Expected financial access: Enabled");
    console.log("");
    console.log("Do NOT run cleanup until the browser proof is finished.");
    console.log(`Cleanup state: ${STATE_FILE}`);
  } catch (error) {
    console.log("");
    console.log("Provisioning failed; cleaning temporary account...");
    await cleanupUser(userId);
    throw error;
  }
}

main().catch((error) => {
  console.error("");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
