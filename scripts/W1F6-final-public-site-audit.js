const BASE_URL = (process.env.VENTIQ_APP_URL || "http://localhost:3000").replace(/\/+$/, "");

const publicRoutes = [
  "/",
  "/demo",
  "/product-overview",
  "/security",
  "/faq",
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

async function manual(path, accept = "text/html") {
  const response = await fetch(`${BASE_URL}${path}`, {
    redirect: "manual",
    headers: { Accept: accept },
  });

  return {
    status: response.status,
    location: response.headers.get("location") || "",
    xRobots: response.headers.get("x-robots-tag") || "",
    cacheControl: response.headers.get("cache-control") || "",
    text: await response.text(),
  };
}

function report(ok, label, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"} - ${label}${detail ? ` — ${detail}` : ""}`);
  return ok;
}

async function main() {
  console.log("");
  console.log("# VENTIQ W1F6 FINAL PUBLIC WEBSITE AUDIT");
  console.log("");
  console.log(`Base URL: ${BASE_URL}`);
  console.log("");

  let failed = 0;

  for (const route of publicRoutes) {
    const result = await manual(route);
    if (!report(result.status === 200, `public route ${route}`, `HTTP ${result.status}`)) failed++;
  }

  for (const route of privateRoutes) {
    const result = await manual(route);
    const expected = result.status === 307 && result.location.includes("/auth/login?next=");
    if (!report(expected, `private route ${route} redirects to real login`, `HTTP ${result.status} ${result.location}`)) failed++;

    const noindex = result.xRobots.toLowerCase().includes("noindex");
    if (!report(noindex, `private route ${route} carries noindex`)) failed++;
  }

  const homepage = await manual("/");
  const homepageChecks = [
    ["homepage title", homepage.text.includes("AI Stakeholder Dashboards for Private Capital")],
    ["homepage structured data", homepage.text.includes("application/ld+json")],
    ["homepage mobile navigation control", homepage.text.includes("ventiq-mobile-menu")],
    ["homepage does not advertise zero-price schema offer", !homepage.text.includes('"price":"0"')],
  ];

  for (const [label, ok] of homepageChecks) {
    if (!report(Boolean(ok), String(label))) failed++;
  }

  const sitemap = await manual("/sitemap.xml", "application/xml");
  for (const route of ["/demo", "/product-overview", "/security", "/faq", "/privacy", "/terms"]) {
    if (!report(sitemap.text.includes(`https://useventiq.com${route}`), `sitemap contains ${route}`)) failed++;
  }
  if (!report(!sitemap.text.includes("managing-partner-ai"), "sitemap excludes private workspaces")) failed++;

  const robots = await manual("/robots.txt", "text/plain");
  if (!report(!/Disallow:\s*\/demo\b/i.test(robots.text), "robots does not block public Guided Demo")) failed++;
  if (!report(/Disallow:\s*\/managing-partner-ai/i.test(robots.text), "robots blocks private Managing Partner workspace")) failed++;
  if (!report(/Disallow:\s*\/investor-portal/i.test(robots.text), "robots blocks private Investor Portal")) failed++;

  const privateApi = await manual("/api/fund-context", "application/json");
  if (!report(privateApi.status === 401, "anonymous private API rejected", `HTTP ${privateApi.status}`)) failed++;

  const bridge = await fetch(`${BASE_URL}/api/auth/perimeter`, {
    method: "POST",
    redirect: "manual",
    headers: { Accept: "application/json" },
  });
  if (!report(bridge.status === 401, "perimeter bridge rejects missing bearer", `HTTP ${bridge.status}`)) failed++;

  console.log("");
  console.log(`Final failures: ${failed}`);

  if (failed === 0) {
    console.log("");
    console.log("PASS - W1F6 PUBLIC WEBSITE RELEASE GATE PASSED");
    process.exit(0);
  }

  console.error("");
  console.error("FAIL - W1F6 public website release gate has outstanding checks.");
  process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
