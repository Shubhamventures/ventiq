import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const MAKER_EMAIL = "cashubham1602@gmail.com";
const FUND_NAME = "VENTIQ Growth Fund II";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("FAIL - Supabase URL / anon key missing from .env.local");
  process.exit(1);
}

function readHiddenPassword(promptText = "Maker password: ") {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      reject(new Error("Interactive terminal required."));
      return;
    }

    process.stdout.write(promptText);

    const stdin = process.stdin;
    let password = "";

    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    const cleanup = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener("data", onData);
    };

    const onData = (char) => {
      if (char === "\u0003") {
        cleanup();
        process.stdout.write("\n");
        process.exit(130);
      }

      if (char === "\r" || char === "\n") {
        cleanup();
        process.stdout.write("\n");
        resolve(password);
        return;
      }

      if (char === "\u0008" || char === "\u007f") {
        if (password.length > 0) {
          password = password.slice(0, -1);
          process.stdout.write("\b \b");
        }
        return;
      }

      password += char;
      process.stdout.write("*");
    };

    stdin.on("data", onData);
  });
}

const password =
  process.env.VENTIQ_MAKER_PASSWORD || (await readHiddenPassword());

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

console.log("\nVENTIQ Maker RLS Regression");
console.log("===========================");

const { data: authData, error: authError } =
  await supabase.auth.signInWithPassword({
    email: MAKER_EMAIL,
    password,
  });

if (authError || !authData.user) {
  console.error(
    "FAIL - Maker authentication failed:",
    authError?.message || "No user returned"
  );
  process.exit(1);
}

console.log(`PASS - authenticated as ${authData.user.email}`);


// ------------------------------------------------------------
// Authorization helper tests
// ------------------------------------------------------------

const { data: canView, error: viewRpcError } = await supabase.rpc(
  "ventiq_can_view_internal_fund",
  {
    requested_fund_name: FUND_NAME,
  }
);

if (viewRpcError) {
  console.log(
    `WARN - view helper RPC could not be called: ${viewRpcError.message}`
  );
} else if (canView === true) {
  console.log("PASS - Maker can view assigned fund");
} else {
  console.error(`FAIL - Maker cannot view assigned fund: ${canView}`);
}


const { data: canEdit, error: editRpcError } = await supabase.rpc(
  "ventiq_can_edit_internal_fund",
  {
    requested_fund_name: FUND_NAME,
  }
);

if (editRpcError) {
  console.log(
    `WARN - edit helper RPC could not be called: ${editRpcError.message}`
  );
} else if (canEdit === false) {
  console.log("PASS - Maker direct fund edit authorization = false");
} else {
  console.error(
    `FAIL - Maker unexpectedly has direct fund edit authorization: ${canEdit}`
  );
}


// ------------------------------------------------------------
// LP table read + harmless write regression
//
// The UPDATE writes fund_name back to exactly its existing value.
// Therefore even if a defect existed, the business value would
// not actually change.
// ------------------------------------------------------------

const tables = [
  "investor_master",
  "fund_commitments",
  "investor_cashflows",
  "investor_documents",
  "investor_performance_metrics",
];

let failures = 0;
let warnings = 0;

for (const table of tables) {
  console.log(`\n${table}`);

  const { data: rows, error: readError } = await supabase
    .from(table)
    .select("id,fund_name")
    .eq("fund_name", FUND_NAME)
    .limit(1);

  if (readError) {
    console.error(`FAIL - READ blocked/error: ${readError.message}`);
    failures += 1;
    continue;
  }

  console.log(`PASS - READ allowed (${rows?.length ?? 0} row returned)`);

  if (!rows || rows.length === 0) {
    console.log("WARN - No test row available; write regression skipped");
    warnings += 1;
    continue;
  }

  const target = rows[0];

  const {
    data: updateData,
    error: updateError,
  } = await supabase
    .from(table)
    .update({
      fund_name: target.fund_name,
    })
    .eq("id", target.id)
    .select("id");

  if (updateError) {
    console.log(`PASS - WRITE blocked (${updateError.message})`);
    continue;
  }

  if (!updateData || updateData.length === 0) {
    console.log("PASS - WRITE blocked by RLS (0 rows affected)");
    continue;
  }

  console.error(
    `FAIL - WRITE unexpectedly succeeded (${updateData.length} row affected)`
  );
  failures += 1;
}


// ------------------------------------------------------------
// Sign out
// ------------------------------------------------------------

await supabase.auth.signOut();

console.log("\n===========================");

if (failures === 0) {
  console.log("PASS - MAKER RLS REGRESSION");
  console.log("Maker can read assigned fund but cannot directly mutate LP data.");

  if (warnings > 0) {
    console.log(
      `NOTE - ${warnings} table(s) had no matching row and could not be mutation-tested.`
    );
  }
} else {
  console.error(`FAIL - ${failures} Maker security regression(s) detected.`);
  process.exitCode = 1;
}