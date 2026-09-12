const BASE_URL = (process.env.VENTIQ_APP_URL || "http://localhost:3000").replace(/\/+$/, "");

const publicRoutes = [
  "/",
  "/demo",
  "/product-overview",
  "/faq",
  "/security",
  "/privacy",
  "/terms",
  "/auth/login",
];

const privateRoutes = [
  "/managing-partner-ai",
  "/finance-head-ai",
  "/compliance-ai",
  "/investment-team-ai",
  "/fundraising-ai",
  "/investor-portal",
  "/migration/data-intake",
  "/migration/activation",
  "/document-studio",
  "/data-room",
  "/capital-call",
  "/distribution-waterfall",
  "/debt-lms",
  "/repayment-notice",
  "/portfolio-intelligence",
  "/activity-engine",
];

function classify(status, location) {
  if (status >= 200 && status < 300) return "OPEN";
  if (location?.includes("/auth/login")) return "AUTH LOGIN";
  if (location?.includes("/site-lock")) return "SITE LOCK";
  return "OTHER";
}

async function request(path) {
  const response = await fetch(`${BASE_URL}${path}`, {
    redirect: "manual",
    headers: { Accept: "text/html" },
  });

  return {
    path,
    status: response.status,
    location: response.headers.get("location") || "",
  };
}

async function main() {
  console.log("");
  console.log("# VENTIQ W1F5B LOGIN-FIRST BOUNDARY AUDIT");
  console.log("");
  console.log(`Base URL: ${BASE_URL}`);
  console.log("Visitor state: no legacy site-lock cookie, no app-access cookie, no VENTIQ session");
  console.log("");

  let publicFailures = 0;

  console.log("## Public routes");
  console.log("");

  for (const path of publicRoutes) {
    const result = await request(path);
    const classification = classify(result.status, result.location);

    console.log(
      `${classification.padEnd(10)} ${String(result.status).padEnd(4)} ${path}${
        result.location ? ` -> ${result.location}` : ""
      }`
    );

    if (classification !== "OPEN") publicFailures += 1;
  }

  console.log("");
  console.log("## Private homepage/workspace destinations");
  console.log("");

  let authLogin = 0;
  let siteLock = 0;
  let open = 0;
  let other = 0;

  for (const path of privateRoutes) {
    const result = await request(path);
    const classification = classify(result.status, result.location);

    console.log(
      `${classification.padEnd(10)} ${String(result.status).padEnd(4)} ${path}${
        result.location ? ` -> ${result.location}` : ""
      }`
    );

    if (classification === "AUTH LOGIN") authLogin += 1;
    else if (classification === "SITE LOCK") siteLock += 1;
    else if (classification === "OPEN") open += 1;
    else other += 1;
  }

  console.log("");
  console.log("## API perimeter");
  console.log("");

  const apiResult = await fetch(`${BASE_URL}/api/fund-context`, {
    redirect: "manual",
    headers: { Accept: "application/json" },
  });

  const perimeterNoToken = await fetch(`${BASE_URL}/api/auth/perimeter`, {
    method: "POST",
    redirect: "manual",
    headers: { Accept: "application/json" },
  });

  console.log(`PRIVATE API without app cookie: ${apiResult.status} /api/fund-context`);
  console.log(`Perimeter bridge without bearer: ${perimeterNoToken.status} /api/auth/perimeter`);

  console.log("");
  console.log("## Summary");
  console.log("");
  console.log(`Public-route failures:            ${publicFailures}`);
  console.log(`Private -> real auth login:       ${authLogin}`);
  console.log(`Private -> legacy site lock:      ${siteLock}`);
  console.log(`Private OPEN unexpectedly:        ${open}`);
  console.log(`Private other response:           ${other}`);
  console.log("");

  const pass =
    publicFailures === 0 &&
    authLogin === privateRoutes.length &&
    siteLock === 0 &&
    open === 0 &&
    other === 0 &&
    apiResult.status === 401 &&
    perimeterNoToken.status === 401;

  if (pass) {
    console.log("PASS - public VENTIQ is open, all 16 private destinations go directly to real login, and private APIs require the authenticated app perimeter.");
    process.exit(0);
  }

  console.error("FAIL - W1F5B boundary did not match the expected login-first architecture.");
  process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
