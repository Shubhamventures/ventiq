import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const APP_DIR = path.join(ROOT, "app");
const BASE_URL = (process.env.VENTIQ_APP_URL || "http://localhost:3000").replace(/\/+$/, "");

const PUBLIC_PAGES = new Set([
  "/",
  "/demo",
  "/product-overview",
  "/security",
  "/faq",
  "/privacy",
  "/terms",
  "/auth/login",
  "/auth/set-password",
  "/auth/welcome",
  "/auth/unauthorized",
]);

const PUBLIC_APIS = new Set([
  "/api/auth/perimeter",
  "/api/founder/leads",
]);

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function normalizeSegments(relativeDir) {
  const raw = relativeDir.split(path.sep).filter(Boolean);
  const visible = raw.filter((segment) => !(segment.startsWith("(") && segment.endsWith(")")));
  return visible;
}

function routeFromFile(file, isApi) {
  const relative = path.relative(APP_DIR, file);
  const dir = path.dirname(relative);
  const segments = normalizeSegments(dir === "." ? "" : dir);
  const route = "/" + segments.join("/");
  if (route === "/") return "/";
  return route.replace(/\/+$/g, "");
}

function isDynamic(route) {
  return route.includes("[") || route.includes("]");
}

function unique(values) {
  return [...new Set(values)].sort();
}

async function manual(route, accept = "text/html") {
  const response = await fetch(`${BASE_URL}${route}`, {
    redirect: "manual",
    headers: { Accept: accept },
  });
  return {
    status: response.status,
    location: response.headers.get("location") || "",
    xRobots: response.headers.get("x-robots-tag") || "",
    cacheControl: response.headers.get("cache-control") || "",
  };
}

function pass(label, detail = "") {
  console.log(`PASS - ${label}${detail ? ` — ${detail}` : ""}`);
}
function fail(label, detail = "") {
  console.error(`FAIL - ${label}${detail ? ` — ${detail}` : ""}`);
  return 1;
}
function info(label, detail = "") {
  console.log(`INFO - ${label}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  if (!fs.existsSync(APP_DIR)) {
    console.error("FAIL - Run this audit from the VENTIQ project root (app/ not found).\n");
    process.exit(1);
  }

  const files = walk(APP_DIR);
  const pageFiles = files.filter((file) => /[\\/]page\.(tsx|ts|jsx|js)$/.test(file));
  const apiFiles = files.filter((file) => /[\\/]api[\\/].*[\\/]route\.(tsx|ts|jsx|js)$/.test(file));

  const pageRoutes = unique(pageFiles.map((file) => routeFromFile(file, false)));
  const apiRoutes = unique(apiFiles.map((file) => routeFromFile(file, true)));

  const staticPages = pageRoutes.filter((route) => !isDynamic(route));
  const dynamicPages = pageRoutes.filter(isDynamic);
  const staticApis = apiRoutes.filter((route) => !isDynamic(route));
  const dynamicApis = apiRoutes.filter(isDynamic);

  console.log("\n# VENTIQ W1G5 PUBLIC / PRIVATE PERIMETER FINAL AUDIT\n");
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Discovered pages: ${pageRoutes.length} (${dynamicPages.length} dynamic)`);
  console.log(`Discovered APIs:  ${apiRoutes.length} (${dynamicApis.length} dynamic)\n`);

  let failures = 0;

  console.log("## Public pages\n");
  for (const route of staticPages.filter((route) => PUBLIC_PAGES.has(route))) {
    const result = await manual(route);
    if (result.status >= 200 && result.status < 300) {
      pass(`${route} is public`, `HTTP ${result.status}`);
    } else {
      failures += fail(`${route} should be public`, `HTTP ${result.status} ${result.location}`);
    }
  }

  console.log("\n## Private pages (anonymous direct URL)\n");
  for (const route of staticPages.filter((route) => !PUBLIC_PAGES.has(route))) {
    const result = await manual(route);
    const toLogin =
      result.status >= 300 &&
      result.status < 400 &&
      result.location.includes("/auth/login?next=");
    const noindex = result.xRobots.toLowerCase().includes("noindex");
    const noStore = result.cacheControl.toLowerCase().includes("no-store");

    if (toLogin) pass(`${route} -> real login`, `HTTP ${result.status}`);
    else failures += fail(`${route} must redirect to real login`, `HTTP ${result.status} ${result.location}`);

    if (noindex) pass(`${route} carries noindex`);
    else failures += fail(`${route} missing X-Robots-Tag noindex`);

    if (noStore) pass(`${route} carries no-store`);
    else failures += fail(`${route} missing private no-store cache policy`);
  }

  console.log("\n## Private APIs (anonymous)\n");
  for (const route of staticApis.filter((route) => !PUBLIC_APIS.has(route))) {
    const result = await manual(route, "application/json");
    if (result.status === 401) pass(`${route} rejects anonymous access`, "HTTP 401");
    else failures += fail(`${route} should reject anonymously at perimeter`, `HTTP ${result.status} ${result.location}`);
  }

  console.log("\n## Public auth bridge\n");
  const perimeter = await fetch(`${BASE_URL}/api/auth/perimeter`, {
    method: "POST",
    redirect: "manual",
    headers: { Accept: "application/json" },
  });
  if (perimeter.status === 401) pass("/api/auth/perimeter rejects missing bearer", "HTTP 401");
  else failures += fail("/api/auth/perimeter missing-bearer behavior", `HTTP ${perimeter.status}`);

  console.log("\n## Legacy site-lock must no longer grant access\n");
  const siteLock = await manual("/site-lock");
  const siteLockToLogin = siteLock.status >= 300 && siteLock.status < 400 && siteLock.location.includes("/auth/login?next=");
  if (siteLockToLogin) pass("/site-lock is no longer public and routes to real login", `HTTP ${siteLock.status}`);
  else failures += fail("/site-lock should no longer be a public gate", `HTTP ${siteLock.status} ${siteLock.location}`);

  const legacyApi = await manual("/api/site-lock/login", "application/json");
  if (legacyApi.status === 401) pass("/api/site-lock/login is blocked by the authenticated perimeter", "HTTP 401");
  else failures += fail("legacy site-lock API should be blocked", `HTTP ${legacyApi.status} ${legacyApi.location}`);

  console.log("\n## Environment / source perimeter checks\n");
  const envPath = path.join(ROOT, ".env.local");
  const envText = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
  const hasDedicatedSecret = /^VENTIQ_APP_ACCESS_SECRET\s*=\s*.+$/m.test(envText) || Boolean(process.env.VENTIQ_APP_ACCESS_SECRET);
  if (hasDedicatedSecret) pass("VENTIQ_APP_ACCESS_SECRET is configured");
  else failures += fail("VENTIQ_APP_ACCESS_SECRET is missing");

  const runtimeFiles = [
    path.join(ROOT, "proxy.ts"),
    path.join(ROOT, "app", "api", "auth", "perimeter", "route.ts"),
  ].filter(fs.existsSync);
  for (const file of runtimeFiles) {
    const text = fs.readFileSync(file, "utf8");
    const label = path.relative(ROOT, file);
    if (!text.includes("SITE_LOCK_TOKEN") && !text.includes("ventiq_site_access")) {
      pass(`${label} has no legacy site-lock auth fallback`);
    } else {
      failures += fail(`${label} still references legacy site-lock authorization`);
    }
  }

  const residual = files
    .filter((file) => /\.(ts|tsx|js|jsx)$/.test(file))
    .filter((file) => {
      const text = fs.readFileSync(file, "utf8");
      return text.includes("SITE_LOCK_TOKEN") || text.includes("ventiq_site_access") || text.includes("/api/site-lock/login");
    })
    .map((file) => path.relative(ROOT, file));

  if (residual.length) {
    info("Legacy site-lock source remains for final cleanup", residual.join(", "));
  } else {
    info("No residual site-lock source detected under app/");
  }

  if (dynamicPages.length) info("Dynamic pages require parameter-specific manual review", dynamicPages.join(", "));
  if (dynamicApis.length) info("Dynamic APIs require parameter-specific manual review", dynamicApis.join(", "));

  console.log("\n## Summary\n");
  console.log(`Static public/private pages tested: ${staticPages.length}`);
  console.log(`Static APIs discovered:             ${staticApis.length}`);
  console.log(`Dynamic routes flagged:             ${dynamicPages.length + dynamicApis.length}`);
  console.log(`Failures:                           ${failures}`);

  if (failures === 0) {
    console.log("\nPASS - W1G5 PERIMETER AUDIT PASSED. Public VENTIQ is open; private pages go directly to real login; private APIs reject anonymous access; legacy site-lock no longer grants application access.");
    process.exit(0);
  }

  console.error("\nFAIL - W1G5 perimeter has outstanding issues. Do not delete the legacy site-lock files yet.");
  process.exit(1);
}

main().catch((error) => {
  console.error("\nAUDIT FAILED");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
