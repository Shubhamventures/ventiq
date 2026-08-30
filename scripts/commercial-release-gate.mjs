import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import net from "node:net";

const ROOT = process.cwd();
const IS_WIN = process.platform === "win32";
const NODE = process.execPath;

let failures = 0;
let warnings = 0;
let perimeterProcess = null;

function section(title) {
  console.log("");
  console.log("============================================================");
  console.log(title);
  console.log("============================================================");
}

function pass(label, detail = "") {
  console.log(`PASS - ${label}${detail ? ` ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ${detail}` : ""}`);
}

function fail(label, detail = "") {
  failures += 1;
  console.error(`FAIL - ${label}${detail ? ` ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ${detail}` : ""}`);
}

function warn(label, detail = "") {
  warnings += 1;
  console.log(`WARN - ${label}${detail ? ` ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ${detail}` : ""}`);
}

function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function has(rel, needle) {
  return exists(rel) && read(rel).includes(needle);
}

function envFromDotEnv(name) {
  if (process.env[name]?.trim()) return process.env[name].trim();
  const envPath = path.join(ROOT, ".env.local");
  if (!fs.existsSync(envPath)) return "";
  const text = fs.readFileSync(envPath, "utf8");
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^\\s*${escaped}\\s*=\\s*(.*)$`, "m");
  const match = text.match(re);
  if (!match) return "";
  let value = match[1].trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return value.trim();
}

function commandLabel(command, args) {
  return `${command} ${args.join(" ")}`.trim();
}

function run(command, args, options = {}) {
  const printable = options.label || commandLabel(command, args);
  console.log(`RUN  - ${printable}`);

  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: options.quiet ? "pipe" : "inherit",
    encoding: "utf8",
    env: { ...process.env, ...(options.env || {}) },
    shell: false,
  });

  if (result.error) {
    fail(printable, result.error.message);
    return { ok: false, result };
  }

  if (result.status !== 0) {
    if (options.quiet) {
      const output = `${result.stdout || ""}\n${result.stderr || ""}`.trim();
      if (output) console.error(output.split(/\r?\n/).slice(-40).join("\n"));
    }
    fail(printable, `exit ${result.status}`);
    return { ok: false, result };
  }

  pass(printable);
  return { ok: true, result };
}

function parseJsonFile(rel) {
  return JSON.parse(read(rel));
}

async function findFreePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

async function waitForServer(baseUrl, child, timeoutMs = 90000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    if (child.exitCode !== null) return false;

    try {
      const response = await fetch(baseUrl, {
        redirect: "manual",
        headers: { Accept: "text/html" },
      });
      if (response.status > 0) return true;
    } catch {
      // Not ready yet.
    }

    await new Promise((resolve) => setTimeout(resolve, 750));
  }

  return false;
}

async function stopProcess(child) {
  if (!child || child.exitCode !== null) return;

  try {
    child.kill("SIGTERM");
  } catch {
    // best effort
  }

  await new Promise((resolve) => setTimeout(resolve, 1200));
  if (child.exitCode !== null) return;

  if (IS_WIN && child.pid) {
    spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      shell: false,
    });
  } else {
    try {
      child.kill("SIGKILL");
    } catch {
      // best effort
    }
  }
}

function checkSourceControls() {
  section("1. COMMERCIAL P0 SOURCE CONTROLS");

  const clientReadiness = "app/admin/client-readiness/page.tsx";

  if (!exists(clientReadiness)) {
    fail("Client Readiness source exists");
  } else {
    const text = read(clientReadiness);
    const forbidden = [
      "Showing sample data until a pilot client is created.",
      "Unable to load readiness data. Showing sample data.",
    ];
    const required = [
      "No sample data was substituted.",
      "No pilot client exists yet. Create Client 001 to begin governed readiness tracking.",
    ];

    for (const marker of forbidden) {
      if (text.includes(marker)) fail(`Client Readiness forbids fallback marker: ${marker}`);
      else pass(`Client Readiness forbids fallback marker: ${marker}`);
    }

    for (const marker of required) {
      if (text.includes(marker)) pass(`Client Readiness fail-closed marker present: ${marker}`);
      else fail(`Client Readiness fail-closed marker present: ${marker}`);
    }
  }

  const sentryChecks = [
    ["next.config.ts", "withSentryConfig", "Next.js wrapped with Sentry"],
    ["instrumentation.ts", "onRequestError = Sentry.captureRequestError", "server/edge request error capture"],
    ["instrumentation.ts", "sendDefaultPii: false", "server PII disabled"],
    ["instrumentation.ts", "delete event.request.data", "server request-body scrub"],
    ["instrumentation-client.ts", "sendDefaultPii: false", "browser PII disabled"],
    ["instrumentation-client.ts", "delete event.request.data", "browser request-body scrub"],
    ["app/global-error.tsx", "captureException", "global React exception capture"],
  ];

  for (const [rel, needle, label] of sentryChecks) {
    if (has(rel, needle)) pass(label);
    else fail(label, `${rel} missing expected marker`);
  }

  const publicDsn = envFromDotEnv("NEXT_PUBLIC_SENTRY_DSN");
  const serverDsn = envFromDotEnv("SENTRY_DSN");

  if (publicDsn.startsWith("https://")) pass("NEXT_PUBLIC_SENTRY_DSN configured (value hidden)");
  else fail("NEXT_PUBLIC_SENTRY_DSN configured");

  if (serverDsn.startsWith("https://")) pass("SENTRY_DSN configured (value hidden)");
  else fail("SENTRY_DSN configured");

  const guard = "scripts/security-pptx-image-path-guard.mjs";
  const exceptionDoc = "docs/security/client-001-pptx-image-size-exception.md";
  const opsRunbookVerifier = "scripts/verify-commercial-ops-runbook.mjs";

  if (exists(guard)) pass("PptxGenJS image-path guard exists");
  else fail("PptxGenJS image-path guard exists");

  if (exists(exceptionDoc)) pass("Client 001 PptxGenJS/image-size pilot exception exists");
  else fail("Client 001 PptxGenJS/image-size pilot exception exists");

  if (exists(opsRunbookVerifier)) {
    run(NODE, [path.join(ROOT, opsRunbookVerifier)], {
      label: "Client 001 incident/recovery runbook",
    });
  } else {
    fail("Client 001 incident/recovery runbook verifier exists");
  }

  if (exists(guard)) {
    run(NODE, [path.join(ROOT, guard)], {
      label: "PptxGenJS image-path guard",
    });
  }
}

function checkDependencies() {
  section("2. DEPENDENCY BASELINE + PRODUCTION AUDIT");

  const checks = [
    ["next", "16.3.3"],
    ["pdfjs-dist", "6.2.108"],
    ["xlsx", "0.20.3"],
    ["dompurify", "3.4.13"],
    ["pptxgenjs", "4.0.1"],
  ];

  for (const [name, expected] of checks) {
    const rel = `node_modules/${name}/package.json`;

    if (!exists(rel)) {
      fail(`${name} installed`, "node_modules package missing");
      continue;
    }

    const actual = String(parseJsonFile(rel).version || "");
    if (actual === expected) pass(`${name} ${expected}`);
    else fail(`${name} ${expected}`, `installed ${actual || "unknown"}`);
  }

  const audit = spawnSync(
    IS_WIN ? "npm.cmd" : "npm",
    ["audit", "--package-lock-only", "--omit=dev", "--json"],
    {
      cwd: ROOT,
      stdio: "pipe",
      encoding: "utf8",
      shell: false,
    }
  );

  let parsed;
  try {
    parsed = JSON.parse(audit.stdout || "{}");
  } catch {
    fail("Production npm audit JSON parsed");
    const tail = `${audit.stdout || ""}\n${audit.stderr || ""}`.trim();
    if (tail) console.error(tail.split(/\r?\n/).slice(-30).join("\n"));
    return;
  }

  const meta = parsed?.metadata?.vulnerabilities || {};
  const critical = Number(meta.critical || 0);
  const high = Number(meta.high || 0);
  const moderate = Number(meta.moderate || 0);
  const low = Number(meta.low || 0);

  console.log(
    `INFO - production audit total=${Number(meta.total || 0)} critical=${critical} high=${high} moderate=${moderate} low=${low}`
  );

  if (critical > 0) fail("No production critical vulnerabilities", String(critical));
  else pass("No production critical vulnerabilities");

  if (moderate > 0) fail("No production moderate vulnerabilities", String(moderate));
  else pass("No production moderate vulnerabilities");

  if (low > 0) warn("Production low vulnerabilities remain", String(low));
  else pass("No production low vulnerabilities");

  const allowedHigh = new Set(["pptxgenjs", "image-size"]);
  const vulnerabilities = parsed?.vulnerabilities || {};
  const unexpectedHigh = [];
  const allowedPresent = [];

  for (const [name, detail] of Object.entries(vulnerabilities)) {
    const severity = String(detail?.severity || "").toLowerCase();
    if (severity !== "high") continue;

    if (allowedHigh.has(name)) allowedPresent.push(name);
    else unexpectedHigh.push(name);
  }

  if (unexpectedHigh.length > 0) {
    fail("No unexpected production HIGH vulnerabilities", unexpectedHigh.sort().join(", "));
  } else {
    pass("No unexpected production HIGH vulnerabilities");
  }

  if (allowedPresent.length > 0) {
    const guardExists = exists("scripts/security-pptx-image-path-guard.mjs");
    const exceptionExists = exists("docs/security/client-001-pptx-image-size-exception.md");

    if (guardExists && exceptionExists) {
      pass(
        "Known PptxGenJS/image-size HIGH chain is controlled for Client 001 pilot",
        allowedPresent.sort().join(", ")
      );
    } else {
      fail("Known HIGH exception controls present", "guard or exception document missing");
    }
  } else if (high === 0) {
    pass("No production HIGH vulnerabilities");
  } else if (high > 0 && unexpectedHigh.length === 0) {
    fail("Production HIGH findings fully classified", `${high} high finding(s)`);
  }
}

function checkRepoHygiene() {
  section("3. REPOSITORY HYGIENE");

  run("git", ["diff", "--check"], {
    label: "git diff --check",
  });

  const trackedEnv = spawnSync(
    "git",
    ["ls-files", ".env", ".env.local", ".env.production", ".env.development"],
    {
      cwd: ROOT,
      stdio: "pipe",
      encoding: "utf8",
      shell: false,
    }
  );

  if (trackedEnv.status !== 0) {
    fail("Tracked environment-file check", `exit ${trackedEnv.status}`);
  } else {
    const files = (trackedEnv.stdout || "").trim();

    if (files) {
      fail("No tracked environment files", files.replace(/\r?\n/g, ", "));
    } else {
      pass("No tracked environment files");
    }
  }
}

async function runQualityAndPerimeter() {
  section("4. LINT + PRODUCTION BUILD");

  const runNpmScript = (scriptName, label) => {
    if (IS_WIN) {
      return run(
        process.env.ComSpec || "cmd.exe",
        ["/d", "/s", "/c", `npm run ${scriptName}`],
        { label }
      );
    }

    return run("npm", ["run", scriptName], { label });
  };

  const runProductionLint = () => {
    const eslintBin = path.join(ROOT, "node_modules", "eslint", "bin", "eslint.js");
    const baselinePath = path.join(ROOT, "quality", "production-eslint-baseline.json");

    if (!fs.existsSync(eslintBin) || !fs.existsSync(baselinePath)) {
      fail("Production-source ESLint ratchet", "eslint binary or baseline missing");
      return { ok: false };
    }

    let baseline;
    try {
      baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
    } catch {
      fail("Production-source ESLint ratchet", "invalid baseline JSON");
      return { ok: false };
    }

    const targets = [
      "app",
      "components",
      "lib",
      "next.config.ts",
      "proxy.ts",
      "instrumentation.ts",
      "instrumentation-client.ts",
    ].filter((rel) => fs.existsSync(path.join(ROOT, rel)));

    console.log("RUN  - production-source ESLint ratchet");

    const result = spawnSync(
      NODE,
      [
        eslintBin,
        ...targets,
        "--format",
        "json",
        "--ignore-pattern",
        "**/*.before_*",
        "--ignore-pattern",
        "**/*.before.*",
      ],
      {
        cwd: ROOT,
        stdio: "pipe",
        encoding: "utf8",
        env: { ...process.env },
        shell: false,
        maxBuffer: 64 * 1024 * 1024,
      }
    );

    if (result.error) {
      fail("Production-source ESLint ratchet", result.error.message);
      return { ok: false };
    }

    let report;
    try {
      report = JSON.parse(result.stdout || "[]");
    } catch {
      fail("Production-source ESLint ratchet", "could not parse ESLint JSON");
      return { ok: false };
    }

    const current = {};
    let errors = 0;
    let warnings = 0;

    for (const fileResult of report) {
      errors += Number(fileResult.errorCount || 0);
      warnings += Number(fileResult.warningCount || 0);
      const rel = path.relative(ROOT, fileResult.filePath).replaceAll("\\", "/");

      for (const message of fileResult.messages || []) {
        if (Number(message.severity || 0) !== 2) continue;
        const rule = message.ruleId || "eslint";
        const key = `${rel}::${rule}`;
        current[key] = (current[key] || 0) + 1;
      }
    }

    const budgets = baseline.fileRuleCounts || {};
    const regressions = [];

    for (const [key, count] of Object.entries(current)) {
      const allowed = Number(budgets[key] || 0);
      if (count > allowed) regressions.push({ key, count, allowed });
    }

    if (regressions.length > 0) {
      fail("Production-source ESLint ratchet", `${regressions.length} new/increased budget(s)`);
      for (const item of regressions.slice(0, 12)) {
        console.error(`  ${item.key} current=${item.count} baseline=${item.allowed}`);
      }
      if (regressions.length > 12) {
        console.error(`  ... ${regressions.length - 12} more suppressed`);
      }
      return { ok: false };
    }

    pass(
      "Production-source ESLint ratchet",
      `baseline=${Number(baseline.totalErrors || 0)} current=${errors}; no regression`
    );

    if (errors > 0) {
      warn("Known production lint debt", `${errors} error(s), ${warnings} warning(s)`);
    }

    return { ok: true };
  };

  const lint = runProductionLint();

  if (!lint.ok) {
    console.log("INFO - continuing so the consolidated gate reports other major failures too.");
  }

  const build = IS_WIN
    ? run(
        process.env.ComSpec || "cmd.exe",
        ["/d", "/s", "/c", "npm run build"],
        { label: "npm run build", quiet: true }
      )
    : run("npm", ["run", "build"], { label: "npm run build", quiet: true });

  if (!build.ok) {
    console.log("INFO - production server/perimeter audit skipped because build failed.");
    return;
  }

  section("5. LIVE ANONYMOUS PERIMETER REGRESSION");

  if (IS_WIN) {
    const helper = path.join(ROOT, "scripts", "run-commercial-perimeter.ps1");

    if (!fs.existsSync(helper)) {
      fail("Windows commercial perimeter helper exists");
      return;
    }

    run(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", helper],
      { label: "W1G5.1 anonymous public/private perimeter regression" }
    );

    return;
  }

  const perimeterScript = path.join(ROOT, "scripts", "W1G5_1_final_perimeter_audit.mjs");
  const nextBin = path.join(ROOT, "node_modules", "next", "dist", "bin", "next");

  if (!fs.existsSync(perimeterScript)) {
    fail("W1G5.1 perimeter audit exists");
    return;
  }
  pass("W1G5.1 perimeter audit exists");

  if (!fs.existsSync(nextBin)) {
    fail("Next.js production server binary exists");
    return;
  }

  const port = await findFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  let serverStdout = "";
  let serverStderr = "";

  console.log(`RUN  - next start on ephemeral local port ${port}`);

  perimeterProcess = spawn(
    NODE,
    [nextBin, "start", "-H", "127.0.0.1", "-p", String(port)],
    {
      cwd: ROOT,
      env: { ...process.env, PORT: String(port) },
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    }
  );

  perimeterProcess.stdout?.on("data", (chunk) => {
    serverStdout += String(chunk);
    if (serverStdout.length > 20000) serverStdout = serverStdout.slice(-20000);
  });

  perimeterProcess.stderr?.on("data", (chunk) => {
    serverStderr += String(chunk);
    if (serverStderr.length > 20000) serverStderr = serverStderr.slice(-20000);
  });

  const ready = await waitForServer(baseUrl, perimeterProcess);

  if (!ready) {
    fail("Next.js production server became ready", `port ${port}`);
    const tail = `${serverStdout}\n${serverStderr}`.trim();
    if (tail) console.error(tail.split(/\r?\n/).slice(-40).join("\n"));
    await stopProcess(perimeterProcess);
    perimeterProcess = null;
    return;
  }

  pass("Next.js production server became ready", baseUrl);

  const perimeter = run(
    NODE,
    [perimeterScript],
    {
      label: "W1G5.1 anonymous public/private perimeter regression",
      env: { VENTIQ_APP_URL: baseUrl },
    }
  );

  await stopProcess(perimeterProcess);
  perimeterProcess = null;

  if (perimeter.ok) {
    pass("Production server stopped after perimeter regression");
  } else {
    console.log("INFO - production server stopped after failed perimeter regression.");
  }
}

async function main() {
  console.log("");
  console.log("VENTIQ COMMERCIAL RELEASE / REGRESSION GATE");
  console.log("Non-destructive local release gate for controlled Client 001 readiness.");
  console.log(`Generated run: ${new Date().toISOString()}`);
  console.log("");

  try {
    checkSourceControls();
    checkDependencies();
    checkRepoHygiene();
    await runQualityAndPerimeter();
  } finally {
    if (perimeterProcess) {
      await stopProcess(perimeterProcess);
      perimeterProcess = null;
    }
  }

  section("SUMMARY");
  console.log(`Failures: ${failures}`);
  console.log(`Warnings: ${warnings}`);

  if (failures === 0) {
    console.log("");
    console.log("PASS - VENTIQ COMMERCIAL RELEASE / REGRESSION GATE");
    console.log("This gate does not replace the later authenticated Client 001 E2E regression.");
    process.exit(0);
  }

  console.error("");
  console.error("FAIL - VENTIQ COMMERCIAL RELEASE / REGRESSION GATE");
  console.error("Resolve the failures above before treating the commercial release gate as closed.");
  process.exit(1);
}

process.on("SIGINT", async () => {
  if (perimeterProcess) await stopProcess(perimeterProcess);
  process.exit(130);
});

main().catch(async (error) => {
  if (perimeterProcess) await stopProcess(perimeterProcess);
  console.error("");
  console.error("COMMERCIAL RELEASE GATE CRASHED");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
