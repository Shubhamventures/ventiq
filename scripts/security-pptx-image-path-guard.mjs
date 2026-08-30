import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const target = path.join(root, "app", "api", "lp-deck", "generate", "route.ts");

if (!fs.existsSync(target)) {
  console.error("FAIL - LP deck route not found.");
  process.exit(1);
}

const text = fs.readFileSync(target, "utf8");

const required = [
  /from\s+["']pptxgenjs["']/,
  /pptx\.write\s*\(/,
];

const forbidden = [
  { label: "PptxGenJS addImage()", re: /\.addImage\s*\(/ },
  { label: "PptxGenJS addMedia()", re: /\.addMedia\s*\(/ },
  { label: "imageSizingContain()", re: /imageSizingContain\s*\(/ },
  { label: "imageSizingCrop()", re: /imageSizingCrop\s*\(/ },
  { label: "imageSizingCover()", re: /imageSizingCover\s*\(/ },
  { label: "data:image payload", re: /data:image\//i },
];

for (const re of required) {
  if (!re.test(text)) {
    console.error(`FAIL - required LP deck generation marker missing: ${re}`);
    process.exit(1);
  }
}

for (const item of forbidden) {
  if (item.re.test(text)) {
    console.error(`FAIL - ${item.label} is now reachable in the LP deck route.`);
    process.exit(1);
  }
}

const bodyStart = text.indexOf("type DeckRequestBody");
if (bodyStart < 0) {
  console.error("FAIL - DeckRequestBody type not found.");
  process.exit(1);
}

const bodyEnd = text.indexOf("};", bodyStart);
if (bodyEnd < 0) {
  console.error("FAIL - DeckRequestBody type could not be isolated.");
  process.exit(1);
}

const body = text.slice(bodyStart, bodyEnd + 2);

if (/\b(image|media|file|url|path|datauri)\b/i.test(body)) {
  console.error(
    "FAIL - DeckRequestBody now exposes an image/media/file/url/path/datauri-like field."
  );
  process.exit(1);
}

const sourceRoots = ["app", "components", "lib"];
const importers = [];

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(p);
      continue;
    }

    if (!/\.(ts|tsx|js|mjs|cjs)$/.test(entry.name)) continue;
    const src = fs.readFileSync(p, "utf8");
    if (
      /from\s+["']pptxgenjs["']/.test(src) ||
      /require\(["']pptxgenjs["']\)/.test(src)
    ) {
      importers.push(path.relative(root, p).replaceAll("\\", "/"));
    }
  }
}

for (const rel of sourceRoots) {
  walk(path.join(root, rel));
}

const expectedImporter = "app/api/lp-deck/generate/route.ts";
if (importers.length !== 1 || importers[0] !== expectedImporter) {
  console.error(
    `FAIL - PptxGenJS importer surface changed. Found: ${importers.join(", ") || "none"}`
  );
  process.exit(1);
}

console.log("PASS - PptxGenJS remains limited to the LP deck route.");
console.log("PASS - no PptxGenJS image/media API is reachable.");
console.log("PASS - DeckRequestBody exposes no image/media/file/url/path/datauri field.");
