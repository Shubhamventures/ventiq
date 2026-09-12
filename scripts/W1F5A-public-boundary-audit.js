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
  if (location?.includes("/site-lock")) return "SITE LOCK";
  if (location?.includes("/auth/login")) return "AUTH LOGIN";
  return "OTHER";
}

async function check(path) {
  const response = await fetch(`${BASE_URL}${path}`, {
    redirect: "manual",
    headers: { Accept: "text/html" },
  });

  const location = response.headers.get("location") || "";
  return {
    path,
    status: response.status,
    location,
    classification: classify(response.status, location),
  };
}

async function main() {
  console.log("");
  console.log("# VENTIQ W1F5A PUBLIC BOUNDARY AUDIT");
  console.log("");
  console.log(`Base URL: ${BASE_URL}`);
  console.log("Visitor state: no site-lock cookie, no VENTIQ login session");
  console.log("");

  console.log("## Public routes");
  console.log("");
  let publicFailures = 0;

  for (const path of publicRoutes) {
    const result = await check(path);
    console.log(
      `${result.classification.padEnd(10)} ${String(result.status).padEnd(4)} ${path}${
        result.location ? ` -> ${result.location}` : ""
      }`
    );
    if (result.classification !== "OPEN") publicFailures += 1;
  }

  console.log("");
  console.log("## Private live-product destinations");
  console.log("");

  let privateOpen = 0;
  let siteLock = 0;
  let authLogin = 0;

  for (const path of privateRoutes) {
    const result = await check(path);
    console.log(
      `${result.classification.padEnd(10)} ${String(result.status).padEnd(4)} ${path}${
        result.location ? ` -> ${result.location}` : ""
      }`
    );

    if (result.classification === "OPEN") privateOpen += 1;
    if (result.classification === "SITE LOCK") siteLock += 1;
    if (result.classification === "AUTH LOGIN") authLogin += 1;
  }

  console.log("");
  console.log("## Expected W1F5A state");
  console.log("");
  console.log(`Public-route failures:          ${publicFailures}`);
  console.log(`Private routes OPEN:            ${privateOpen}`);
  console.log(`Private routes at site lock:    ${siteLock}`);
  console.log(`Private routes at real login:   ${authLogin}`);
  console.log("");

  if (publicFailures === 0 && privateOpen === 0 && siteLock === privateRoutes.length) {
    console.log("PASS - public demo is reachable and the temporary beta perimeter still protects every private route.");
    process.exit(0);
  }

  console.error("FAIL - W1F5A public/private boundary is not in the expected transitional state.");
  process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
