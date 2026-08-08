import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL;

const ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const FUND_NAME = "VENTIQ Growth Fund II";

const INVESTOR_A = {
  label: "Investor A",
  email: "scale50.inv001@ventiq.test",
  code: "SCALE50-INV-001",
  name: "Scale Pilot Investor 001 HNI",
};

const INVESTOR_B = {
  label: "Investor B",
  email: "scale50.inv002@ventiq.test",
  code: "SCALE50-INV-002",
  name: "Scale Pilot Investor 002 Family Office",
};

const QA_SOURCE =
  "phase1-investor-ab-isolation-qa-20260808";

if (
  !SUPABASE_URL ||
  !ANON_KEY ||
  !SERVICE_ROLE_KEY
) {
  console.error(
    "FAIL - Supabase URL, anon key, or service-role key missing from .env.local"
  );
  process.exit(1);
}


// ------------------------------------------------------------
// Hidden password input
// ------------------------------------------------------------

function readHiddenPassword(promptText) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      reject(
        new Error("Interactive terminal required.")
      );
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

      if (
        char === "\r" ||
        char === "\n"
      ) {
        cleanup();
        process.stdout.write("\n");
        resolve(password);
        return;
      }

      if (
        char === "\u0008" ||
        char === "\u007f"
      ) {
        if (password.length > 0) {
          password =
            password.slice(0, -1);
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


// ------------------------------------------------------------
// Clients
// ------------------------------------------------------------

const admin = createClient(
  SUPABASE_URL,
  SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
);

function createInvestorClient() {
  return createClient(
    SUPABASE_URL,
    ANON_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );
}


// ------------------------------------------------------------
// Temporary document fixtures
// ------------------------------------------------------------

async function cleanupQaDocuments() {
  const { error } = await admin
    .from("investor_documents")
    .delete()
    .eq("source", QA_SOURCE);

  if (error) {
    throw new Error(
      `Unable to clean QA documents: ${error.message}`
    );
  }
}

async function createQaDocuments() {
  // Clean leftovers from a previous interrupted run.
  await cleanupQaDocuments();

  const rows = [
    {
      fund_name: FUND_NAME,
      investor_code: INVESTOR_A.code,
      investor_name: INVESTOR_A.name,
      investor_email: INVESTOR_A.email,

      document_type:
        "Investor Isolation QA",
      document_name:
        "Investor A Phase 1 Isolation Test",

      document_category: "QA",
      source: QA_SOURCE,

      status: "generated",
      portal_status: "available",
      email_status: "not_sent",

      amount: 0,
    },

    {
      fund_name: FUND_NAME,
      investor_code: INVESTOR_B.code,
      investor_name: INVESTOR_B.name,
      investor_email: INVESTOR_B.email,

      document_type:
        "Investor Isolation QA",
      document_name:
        "Investor B Phase 1 Isolation Test",

      document_category: "QA",
      source: QA_SOURCE,

      status: "generated",
      portal_status: "available",
      email_status: "not_sent",

      amount: 0,
    },
  ];

  const {
    data,
    error,
  } = await admin
    .from("investor_documents")
    .insert(rows)
    .select(
      "id,investor_code,document_name"
    );

  if (error) {
    throw new Error(
      `Unable to create QA documents: ${error.message}`
    );
  }

  if (!data || data.length !== 2) {
    throw new Error(
      `Expected 2 QA documents; created ${data?.length ?? 0}`
    );
  }

  console.log(
    "PASS - temporary A/B document fixtures created"
  );
}


// ------------------------------------------------------------
// Authentication
// ------------------------------------------------------------

async function authenticate(
  investor,
  password
) {
  const client =
    createInvestorClient();

  const {
    data,
    error,
  } =
    await client.auth.signInWithPassword({
      email: investor.email,
      password,
    });

  if (
    error ||
    !data?.user
  ) {
    throw new Error(
      `${investor.label} authentication failed: ${
        error?.message ||
        "No user returned"
      }`
    );
  }

  console.log(
    `PASS - ${investor.label} authenticated as ${data.user.email}`
  );

  return client;
}


// ------------------------------------------------------------
// Row isolation test
// ------------------------------------------------------------

const TABLES = [
  "investor_master",
  "fund_commitments",
  "investor_cashflows",
  "investor_documents",
  "investor_performance_metrics",
];

async function countInvestorRows(
  client,
  table,
  investorCode
) {
  const {
    data,
    error,
  } = await client
    .from(table)
    .select("investor_code")
    .eq(
      "fund_name",
      FUND_NAME
    )
    .eq(
      "investor_code",
      investorCode
    );

  if (error) {
    return {
      error,
      count: null,
      rows: null,
    };
  }

  return {
    error: null,
    count: data?.length ?? 0,
    rows: data ?? [],
  };
}


async function runIsolationSide({
  client,
  viewer,
  other,
}) {
  console.log("");
  console.log(
    `Testing ${viewer.label}`
  );
  console.log(
    "--------------------------------"
  );

  let failures = 0;

  for (const table of TABLES) {
    const own =
      await countInvestorRows(
        client,
        table,
        viewer.code
      );

    const cross =
      await countInvestorRows(
        client,
        table,
        other.code
      );

    console.log("");
    console.log(table);

    if (own.error) {
      console.error(
        `FAIL - own-record query error: ${own.error.message}`
      );
      failures += 1;
    } else if (own.count > 0) {
      console.log(
        `PASS - own records visible (${own.count})`
      );
    } else {
      console.error(
        "FAIL - own records unexpectedly hidden"
      );
      failures += 1;
    }

    if (cross.error) {
      console.error(
        `FAIL - cross-record query error: ${cross.error.message}`
      );
      failures += 1;
    } else if (cross.count === 0) {
      console.log(
        `PASS - ${other.code} blocked (0 rows)`
      );
    } else {
      console.error(
        `FAIL - CROSS-INVESTOR DATA LEAK: ${cross.count} ${other.code} row(s) visible`
      );
      failures += 1;
    }
  }

  return failures;
}


// ------------------------------------------------------------
// Main
// ------------------------------------------------------------

console.log(
  "\nVENTIQ Investor A/B Isolation Regression"
);
console.log(
  "========================================"
);
console.log(
  `Fund: ${FUND_NAME}`
);
console.log(
  "Isolation requests use real Investor JWTs."
);

const passwordA =
  await readHiddenPassword(
    "Investor A password: "
  );

const passwordB =
  await readHiddenPassword(
    "Investor B password: "
  );

let clientA = null;
let clientB = null;
let totalFailures = 0;

try {
  // Service-role use is restricted to creating
  // the two temporary document test fixtures.
  await createQaDocuments();

  clientA =
    await authenticate(
      INVESTOR_A,
      passwordA
    );

  clientB =
    await authenticate(
      INVESTOR_B,
      passwordB
    );

  totalFailures +=
    await runIsolationSide({
      client: clientA,
      viewer: INVESTOR_A,
      other: INVESTOR_B,
    });

  totalFailures +=
    await runIsolationSide({
      client: clientB,
      viewer: INVESTOR_B,
      other: INVESTOR_A,
    });

} catch (error) {
  console.error("");
  console.error(
    "FAIL - regression could not complete:"
  );
  console.error(
    error instanceof Error
      ? error.message
      : String(error)
  );

  totalFailures += 1;

} finally {
  if (clientA) {
    await clientA.auth.signOut();
  }

  if (clientB) {
    await clientB.auth.signOut();
  }

  try {
    await cleanupQaDocuments();

    console.log("");
    console.log(
      "PASS - temporary QA documents cleaned"
    );
  } catch (cleanupError) {
    console.error(
      "FAIL - QA document cleanup failed:"
    );
    console.error(
      cleanupError instanceof Error
        ? cleanupError.message
        : String(cleanupError)
    );

    totalFailures += 1;
  }
}


console.log("");
console.log(
  "========================================"
);

if (totalFailures === 0) {
  console.log(
    "PASS - INVESTOR A/B ISOLATION"
  );

  console.log(
    "Investor A can see only SCALE50-INV-001."
  );

  console.log(
    "Investor B can see only SCALE50-INV-002."
  );

  console.log(
    "Cross-investor access blocked across all 5 LP tables."
  );
} else {
  console.error(
    `FAIL - ${totalFailures} Investor A/B isolation regression(s) detected.`
  );

  process.exitCode = 1;
}