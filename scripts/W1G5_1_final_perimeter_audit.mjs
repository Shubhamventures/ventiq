import fs from "node:fs";
import path from "node:path";

const BASE_URL = (process.env.VENTIQ_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
const ROOT = process.cwd();

const PUBLIC_PAGES = new Set([
  "/",
  "/auth/login",
  "/auth/set-password",
  "/auth/unauthorized",
  "/auth/welcome",
  "/demo",
  "/faq",
  "/privacy",
  "/product-overview",
  "/security",
  "/terms",
]);

const PUBLIC_APIS = new Set([
  "/api/auth/perimeter",
  "/api/founder/leads",
]);

const EXCLUDED_APP_SEGMENTS = new Set([
  "_not-found",
]);

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

function toRoute(file, kind) {
  const appDir = path.join(ROOT, "app");
  const rel = path.relative(appDir, file).replaceAll("\\", "/");
  const parts = rel.split("/");

  if (kind === "page") parts.pop();
  if (kind === "api") {
    parts.pop();
    if (parts[0] !== "api") return null;
  }

  const routeParts = parts.filter((part) => {
    if (!part) return false;
    if (part.startsWith("(") && part.endsWith(")")) return false;
    if (part.startsWith("@")) return false;
    return true;
  });

  if (routeParts.some((p) => EXCLUDED_APP_SEGMENTS.has(p))) return null;

  return "/" + routeParts.join("/");
}

function discover() {
  const all = walk(path.join(ROOT, "app"));
  const pageFiles = all.filter((f) => /[\\/]page\.(tsx|ts|jsx|js)$/.test(f));
  const apiFiles = all.filter((f) => /[\\/]route\.(tsx|ts|jsx|js)$/.test(f) && f.includes(`${path.sep}api${path.sep}`));

  const pages = [...new Set(pageFiles.map((f) => toRoute(f, "page")).filter(Boolean))].sort();
  const apis = [...new Set(apiFiles.map((f) => toRoute(f, "api")).filter(Boolean))].sort();

  return { pages, apis };
}

async function request(route, accept = "text/html") {
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

function pass(ok, label, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"} - ${label}${detail ? ` — ${detail}` : ""}`);
  return ok;
}

function sourceHas(file, pattern) {
  if (!fs.existsSync(file)) return false;
  return fs.readFileSync(file, "utf8").includes(pattern);
}

async function main() {
  console.log("");
  console.log("# VENTIQ W1G5.1 FINAL PUBLIC / PRIVATE PERIMETER AUDIT");
  console.log("");
  console.log(`Base URL: ${BASE_URL}`);

  const { pages, apis } = discover();
  console.log(`Discovered pages: ${pages.length}`);
  console.log(`Discovered APIs:  ${apis.length}`);
  console.log("");

  let failures = 0;

  console.log("## Public pages");
  console.log("");
  for (const route of [...PUBLIC_PAGES].sort()) {
    const result = await request(route);
    if (!pass(result.status === 200, `${route} is public`, `HTTP ${result.status}`)) failures++;
  }

  console.log("");
  console.log("## All other pages are login protected");
  console.log("");
  for (const route of pages.filter((r) => !PUBLIC_PAGES.has(r))) {
    const result = await request(route);
    const login = result.status >= 300 && result.status < 400 && result.location.includes("/auth/login?next=");
    if (!pass(login, `${route} -> real login`, `HTTP ${result.status}`)) failures++;
    if (!pass(result.xRobots.toLowerCase().includes("noindex"), `${route} carries noindex`)) failures++;
    if (!pass(result.cacheControl.toLowerCase().includes("no-store"), `${route} carries no-store`)) failures++;
  }

  console.log("");
  console.log("## Private APIs");
  console.log("");
  for (const route of apis.filter((r) => !PUBLIC_APIS.has(r))) {
    const result = await request(route, "application/json");
    if (!pass(result.status === 401, `${route} rejects anonymous access`, `HTTP ${result.status}`)) failures++;
  }

  console.log("");
  console.log("## Public authentication bridge");
  console.log("");
  const bridge = await fetch(`${BASE_URL}/api/auth/perimeter`, {
    method: "POST",
    redirect: "manual",
    headers: { Accept: "application/json" },
  });
  if (!pass(bridge.status === 401, "/api/auth/perimeter rejects missing bearer", `HTTP ${bridge.status}`)) failures++;

  console.log("");
  console.log("## Global site-lock removal");
  console.log("");

  const siteLockPageDir = path.join(ROOT, "app", "site-lock");
  const siteLockApiDir = path.join(ROOT, "app", "api", "site-lock");
  if (!pass(!fs.existsSync(siteLockPageDir), "app/site-lock source removed")) failures++;
  if (!pass(!fs.existsSync(siteLockApiDir), "app/api/site-lock source removed")) failures++;

  const envPath = path.join(ROOT, ".env.local");
  const envText = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
  if (!pass(/^\s*VENTIQ_APP_ACCESS_SECRET\s*=\s*\S+/m.test(envText), "VENTIQ_APP_ACCESS_SECRET remains configured")) failures++;
  if (!pass(!/^\s*(SITE_LOCK_TOKEN|VENTIQ_SITE_LOCK_TOKEN)\s*=/m.test(envText), "legacy site-lock environment token removed")) failures++;

  const proxy = path.join(ROOT, "proxy.ts");
  const authPerimeter = path.join(ROOT, "app", "api", "auth", "perimeter", "route.ts");
  const privateGate = path.join(ROOT, "components", "auth", "PrivateRouteGate.tsx");

  for (const [label, file] of [
    ["proxy.ts", proxy],
    ["auth perimeter", authPerimeter],
    ["PrivateRouteGate", privateGate],
  ]) {
    for (const pattern of ["SITE_LOCK_TOKEN", "VENTIQ_SITE_LOCK_TOKEN", "ventiq_site_access", "/api/site-lock/login"]) {
      if (!pass(!sourceHas(file, pattern), `${label} has no legacy reference: ${pattern}`)) failures++;
    }
  }

  console.log("");
  console.log("## Old URLs remain safely closed");
  console.log("");
  const oldPage = await request("/site-lock");
  const oldPageSafe =
    oldPage.status === 307 &&
    oldPage.location.includes("/auth/login?next=");
  if (!pass(oldPageSafe, "old /site-lock URL routes to real login", `HTTP ${oldPage.status}`)) failures++;

  const oldApi = await request("/api/site-lock/login", "application/json");
  if (!pass(oldApi.status === 401, "old /api/site-lock/login URL is denied by perimeter", `HTTP ${oldApi.status}`)) failures++;

  console.log("");
  console.log("## Summary");
  console.log("");
  console.log(`Pages discovered: ${pages.length}`);
  console.log(`APIs discovered:  ${apis.length}`);
  console.log(`Failures:          ${failures}`);
  console.log("");

  if (failures === 0) {
    console.log("PASS - W1G5.1 FINAL PERIMETER PASSED. Global site lock is removed; public VENTIQ remains open; all non-public pages require real login; private APIs reject anonymous access.");
    process.exit(0);
  }

  console.error("FAIL - W1G5.1 final perimeter has outstanding issues.");
  process.exit(1);
}

main().catch((error) => {
  console.error("");
  console.error("AUDIT FAILED");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
