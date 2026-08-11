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
const DATA_ROOM_DOCUMENT_ID = "34a4a92f-d899-4639-be32-4af9d5ff2b5e";
const STATE_FILE = path.resolve(".a7-5f-temp-investor.json");

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

function fail(message, detail = "") {
  console.error(`FAIL - ${message}`);
  if (detail) console.error(detail);
  throw new Error(message);
}

async function cleanupUser(userId) {
  if (!userId) return;

  await admin
    .from("data_room_engagement_events")
    .delete()
    .eq("recorded_by", userId);

  await admin
    .from("data_room_questions")
    .delete()
    .eq("created_by", userId);

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
  console.log("VENTIQ A7-5F Temporary LP Data Room Account");
  console.log("============================================");
  console.log(`Fund: ${FUND_NAME}`);
  console.log(`Investor: ${INVESTOR_CODE}`);
  console.log(`Data Room document: ${DATA_ROOM_DOCUMENT_ID}`);
  console.log("");

  try {
    await fs.access(STATE_FILE);
    fail(
      "An A7-5F temporary account state file already exists.",
      `Run the A7-5F cleanup script first or inspect: ${STATE_FILE}`
    );
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  const { data: investor, error: investorError } = await admin
    .from("investor_master")
    .select("id,investor_code,investor_name,fund_name")
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

  const { data: dataRoomDocument, error: documentError } = await admin
    .from("data_room_documents")
    .select(
      "id,fund_name,investor_code,document_name,access_level,storage_bucket,storage_path"
    )
    .eq("id", DATA_ROOM_DOCUMENT_ID)
    .maybeSingle();

  if (
    documentError ||
    !dataRoomDocument ||
    dataRoomDocument.fund_name !== FUND_NAME ||
    dataRoomDocument.investor_code !== INVESTOR_CODE ||
    dataRoomDocument.access_level !== "Restricted LP Access" ||
    !dataRoomDocument.storage_bucket ||
    !dataRoomDocument.storage_path
  ) {
    fail(
      "A3 restricted Data Room document precondition",
      documentError?.message || JSON.stringify(dataRoomDocument, null, 2)
    );
  }
  pass("A3 restricted Data Room document verified");

  const { data: moduleRow, error: moduleError } = await admin
    .from("ventiq_module_activation_status")
    .select("status,readiness_score")
    .eq("organisation_id", ORGANISATION_ID)
    .eq("fund_name", FUND_NAME)
    .eq("module_key", "investor_data_room_portal")
    .maybeSingle();

  if (
    moduleError ||
    !moduleRow ||
    moduleRow.status !== "Active" ||
    Number(moduleRow.readiness_score) !== 100
  ) {
    fail(
      "Investor Data Room module activation precondition",
      moduleError?.message || JSON.stringify(moduleRow, null, 2)
    );
  }
  pass("Investor Data Room module Active at 100%");

  const rl = createInterface({ input, output });
  const password = await rl.question(
    "Choose a temporary password for the A7-5F LP login (minimum 10 characters): "
  );
  rl.close();

  if (!password || password.length < 10) {
    fail("temporary password must contain at least 10 characters");
  }

  const email = `a7.lp.dataroom.${Date.now()}@ventiq.test`;

  const { data: authData, error: authError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: "A7 Data Room Browser LP - A3TEST001",
        ventiq_test_only: true,
        ventiq_test_stage: "A7-5F",
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
          full_name: "A7 Data Room Browser LP - A3TEST001",
          default_role: "investor",
          active_organisation_id: ORGANISATION_ID,
          investor_id: INVESTOR_CODE,
          status: "Active",
        },
        { onConflict: "user_id" }
      );

    if (profileError) {
      fail("Investor profile provisioning", profileError.message);
    }
    pass("Active Investor profile ready with investor_id A3TEST001");

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
      fail("organisation membership provisioning", membershipError.message);
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
    pass("read-only governed fund access ready");

    const { error: entitlementError } = await admin
      .from("ventiq_user_investor_access")
      .insert({
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
      });

    if (entitlementError) {
      fail("Investor entitlement provisioning", entitlementError.message);
    }
    pass("Data Room + download + DDQ question entitlements ready");

    await fs.writeFile(
      STATE_FILE,
      JSON.stringify(
        {
          stage: "A7-5F",
          user_id: userId,
          email,
          organisation_id: ORGANISATION_ID,
          fund_name: FUND_NAME,
          investor_code: INVESTOR_CODE,
          data_room_document_id: DATA_ROOM_DOCUMENT_ID,
          created_at: new Date().toISOString(),
        },
        null,
        2
      ),
      "utf8"
    );

    console.log("");
    console.log("============================================");
    console.log("PASS - A7-5F TEMPORARY LP ACCOUNT READY");
    console.log("");
    console.log(`LOGIN EMAIL: ${email}`);
    console.log("LOGIN PASSWORD: use the password you just entered locally");
    console.log("");
    console.log("Open: http://localhost:3000/auth/login");
    console.log("Then open: http://localhost:3000/data-room");
    console.log("");
    console.log(`Expected fund: ${FUND_NAME}`);
    console.log("Expected heading: My Investor Data Room");
    console.log("Expected documents available: 1");
    console.log("Expected document: A7 QA Fund Overview - A3TEST001");
    console.log("Expected access: Restricted LP Access");
    console.log("Expected actions: Download + Submit Question");
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
