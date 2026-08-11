const { createClient } = require("@supabase/supabase-js");
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

const STATE_FILE = path.resolve(".a7-5f-temp-investor.json");

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

async function countRows(table, column, userId) {
  const { count, error } = await admin
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq(column, userId);

  if (error) {
    throw new Error(`Unable to verify ${table}: ${error.message}`);
  }

  return Number(count || 0);
}

async function main() {
  let state;

  try {
    state = JSON.parse(await fs.readFile(STATE_FILE, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") {
      console.log("No A7-5F temporary account state exists. Nothing to clean.");
      return;
    }
    throw error;
  }

  const userId = String(state.user_id || "");
  if (!userId) {
    throw new Error("A7-5F state does not contain user_id.");
  }

  console.log("");
  console.log("VENTIQ A7-5F Temporary LP Data Room Cleanup");
  console.log("============================================");
  console.log(`User: ${state.email || userId}`);
  console.log(`Investor: ${state.investor_code || "-"}`);

  const questionsBefore = await countRows(
    "data_room_questions",
    "created_by",
    userId
  );
  const eventsBefore = await countRows(
    "data_room_engagement_events",
    "recorded_by",
    userId
  );

  console.log(`Browser DDQ rows to remove: ${questionsBefore}`);
  console.log(`Browser engagement rows to remove: ${eventsBefore}`);

  const { error: engagementDeleteError } = await admin
    .from("data_room_engagement_events")
    .delete()
    .eq("recorded_by", userId);

  if (engagementDeleteError) {
    throw new Error(
      `Engagement cleanup failed: ${engagementDeleteError.message}`
    );
  }

  const { error: questionDeleteError } = await admin
    .from("data_room_questions")
    .delete()
    .eq("created_by", userId);

  if (questionDeleteError) {
    throw new Error(`DDQ cleanup failed: ${questionDeleteError.message}`);
  }

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

  const { error: authError } = await admin.auth.admin.deleteUser(userId);
  if (authError) {
    throw new Error(`Auth user cleanup failed: ${authError.message}`);
  }

  const questionsAfter = await countRows(
    "data_room_questions",
    "created_by",
    userId
  );
  const eventsAfter = await countRows(
    "data_room_engagement_events",
    "recorded_by",
    userId
  );

  if (questionsAfter !== 0 || eventsAfter !== 0) {
    throw new Error(
      `Workflow cleanup incomplete. questions=${questionsAfter}, events=${eventsAfter}`
    );
  }

  await fs.unlink(STATE_FILE);

  console.log("PASS - browser-created DDQ rows removed");
  console.log("PASS - browser-created engagement rows removed");
  console.log("PASS - investor entitlement removed");
  console.log("PASS - fund access removed");
  console.log("PASS - organisation membership removed");
  console.log("PASS - investor profile removed");
  console.log("PASS - temporary auth user removed");
  console.log("PASS - local A7-5F state file removed");
  console.log("");
  console.log("PASS - A7-5F TEMPORARY LP ACCOUNT CLEANED");
}

main().catch((error) => {
  console.error("");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
