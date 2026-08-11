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

const STATE_FILE = path.resolve(".a7-2g-temp-investor.json");

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

async function main() {
  let state;

  try {
    state = JSON.parse(await fs.readFile(STATE_FILE, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") {
      console.log("No A7-2G temporary account state exists. Nothing to clean.");
      return;
    }
    throw error;
  }

  const userId = String(state.user_id || "");
  if (!userId) {
    throw new Error("A7-2G state does not contain user_id.");
  }

  console.log("");
  console.log("VENTIQ A7-2G Temporary LP Cleanup");
  console.log("=================================");
  console.log(`User: ${state.email || userId}`);
  console.log(`Investor: ${state.investor_code || "-"}`);

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

  const { error: authError } =
    await admin.auth.admin.deleteUser(userId);

  if (authError) {
    throw new Error(`Auth user cleanup failed: ${authError.message}`);
  }

  await fs.unlink(STATE_FILE);

  console.log("PASS - investor entitlement removed");
  console.log("PASS - fund access removed");
  console.log("PASS - organisation membership removed");
  console.log("PASS - investor profile removed");
  console.log("PASS - temporary auth user removed");
  console.log("PASS - local A7-2G state file removed");
  console.log("");
  console.log("PASS - A7-2G TEMPORARY LP ACCOUNT CLEANED");
}

main().catch((error) => {
  console.error("");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
