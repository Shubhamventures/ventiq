/*
  VENTIQ W1F4 — PUBLIC CARD ACCESS AUDIT
  Run while `npm run dev` is active:
    node .\scripts\W1F4-public-card-access-audit.js

  This deliberately sends NO site-lock cookie and NO Supabase session.
  It shows what a fresh public visitor gets when opening the live product routes
  linked from the homepage.
*/

const APP_URL = (process.env.VENTIQ_APP_URL || "http://localhost:3000").replace(/\/+$/, "");

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

const privateCardRoutes = [
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

async function inspectRoute(path) {
  const response = await fetch(`${APP_URL}${path}`, {
    method: "GET",
    redirect: "manual",
    headers: {
      Accept: "text/html,application/xhtml+xml",
    },
  });

  const location = response.headers.get("location") || "";
  let classification = "OTHER";

  if (response.status >= 200 && response.status < 300) {
    classification = "OPEN";
  } else if (response.status >= 300 && response.status < 400) {
    if (location.includes("/auth/login")) classification = "AUTH LOGIN";
    else if (location.includes("/site-lock")) classification = "SITE LOCK";
    else classification = "REDIRECT";
  }

  return {
    path,
    status: response.status,
    location,
    classification,
  };
}

function printResult(result) {
  const location = result.location ? ` -> ${result.location}` : "";
  console.log(`${result.classification.padEnd(10)} ${String(result.status).padEnd(4)} ${result.path}${location}`);
}

async function main() {
  console.log("");
  console.log("# VENTIQ W1F4 PUBLIC CARD ACCESS AUDIT");
  console.log(`Base URL: ${APP_URL}`);
  console.log("Visitor state: no site-lock cookie, no VENTIQ login session");
  console.log("");

  console.log("## Public routes");
  for (const route of publicRoutes) {
    printResult(await inspectRoute(route));
  }

  console.log("");
  console.log("## Homepage live-product destinations");
  const privateResults = [];
  for (const route of privateCardRoutes) {
    const result = await inspectRoute(route);
    privateResults.push(result);
    printResult(result);
  }

  console.log("");
  const openPrivate = privateResults.filter((r) => r.classification === "OPEN");
  const authLogin = privateResults.filter((r) => r.classification === "AUTH LOGIN");
  const siteLock = privateResults.filter((r) => r.classification === "SITE LOCK");
  const other = privateResults.filter((r) => !["OPEN", "AUTH LOGIN", "SITE LOCK"].includes(r.classification));

  console.log("## Summary");
  console.log(`Protected card routes tested: ${privateResults.length}`);
  console.log(`OPEN unexpectedly:             ${openPrivate.length}`);
  console.log(`Redirect to real auth login:   ${authLogin.length}`);
  console.log(`Redirect to temporary site lock:${siteLock.length}`);
  console.log(`Other response:                ${other.length}`);

  if (openPrivate.length > 0) {
    console.log("");
    console.log("FAIL - one or more live-product destinations are open to a fresh anonymous visitor.");
    process.exitCode = 1;
    return;
  }

  if (authLogin.length === privateResults.length) {
    console.log("");
    console.log("PASS - every homepage live-product destination routes a fresh visitor to the real VENTIQ login.");
    return;
  }

  if (siteLock.length === privateResults.length) {
    console.log("");
    console.log("PASS - every homepage live-product destination is perimeter-locked, but CURRENTLY routes to /site-lock rather than /auth/login.");
    return;
  }

  console.log("");
  console.log("REVIEW - protected destinations do not yet have one consistent anonymous-entry behaviour.");
}

main().catch((error) => {
  console.error("");
  console.error("AUDIT FAILED");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
