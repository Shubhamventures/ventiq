import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const fixtureDir = path.join(ROOT, 'quality', 'fixtures', 'client-001', 'pdf-intelligence');
const scenarioPath = path.join(fixtureDir, 'p2b-pdf-intelligence-scenario.json');
const routePath = path.join(ROOT, 'app', 'api', 'migration', 'pdf-intelligence', 'route.ts');

function fail(message) {
  console.error(`FAIL - ${message}`);
  process.exit(1);
}
function assert(condition, message) {
  if (!condition) fail(message);
  console.log(`PASS - ${message}`);
}
function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}
function unescapePdfString(value) {
  let out = '';
  for (let i = 0; i < value.length; i += 1) {
    if (value[i] !== '\\') { out += value[i]; continue; }
    i += 1;
    const ch = value[i] ?? '';
    if (ch === 'n') out += '\n';
    else if (ch === 'r') out += '\r';
    else if (ch === 't') out += '\t';
    else out += ch;
  }
  return out;
}
function extractFixtureText(buffer) {
  const raw = buffer.toString('latin1');
  const lines = [];
  for (const match of raw.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)) {
    lines.push(unescapePdfString(match[1]));
  }
  return lines;
}
function includesSequence(lines, sequence) {
  for (let start = 0; start <= lines.length - sequence.length; start += 1) {
    let ok = true;
    for (let i = 0; i < sequence.length; i += 1) {
      if (lines[start + i] !== sequence[i]) { ok = false; break; }
    }
    if (ok) return true;
  }
  return false;
}
function verifyPdf(name, expectedHash, requiredSequences) {
  const full = path.join(fixtureDir, name);
  assert(fs.existsSync(full), `${name} exists`);
  const buffer = fs.readFileSync(full);
  assert(buffer.subarray(0, 8).toString('ascii') === '%PDF-1.4', `${name} has valid PDF header`);
  assert(buffer.toString('latin1').includes('/Count 2'), `${name} contains exactly two fixture pages`);
  assert(sha256(buffer) === expectedHash, `${name} SHA256 matches scenario`);
  const lines = extractFixtureText(buffer);
  assert(lines.length >= 20, `${name} exposes embedded text objects`);
  for (const sequence of requiredSequences) {
    assert(includesSequence(lines, sequence), `${name} contains extraction sequence: ${sequence.join(' -> ')}`);
  }
  return lines;
}

assert(fs.existsSync(scenarioPath), 'P2B scenario JSON exists');
assert(fs.existsSync(routePath), 'current PDF Intelligence route exists');
const scenario = JSON.parse(fs.readFileSync(scenarioPath, 'utf8'));
const route = fs.readFileSync(routePath, 'utf8');

assert(scenario.version === 'P2B-2', 'scenario version is P2B-2');
assert(String(scenario.fund_name).includes('SYNTHETIC'), 'scenario fund is explicitly synthetic');
assert(String(scenario.investor.email).endsWith('.test'), 'scenario investor email is non-deliverable .test');

const routeMarkers = [
  'SOA / Account Statement',
  'Capital Call Notice',
  'Commitment Amount',
  'Capital Called Till Date',
  'Uncalled Capital',
  'Distributions Till Date',
  'Current NAV',
  'Notice Number',
  'Notice Date',
  'Due Date',
  'Capital Called Before This Notice',
  'Current Capital Call',
  'Cumulative Capital Called',
  'Remaining Uncalled Commitment',
  'deterministic_label_match',
  'deterministic_row_match',
  'canonicalWrite: false',
];
for (const marker of routeMarkers) assert(route.includes(marker), `current route retains extraction marker: ${marker}`);

const soa = verifyPdf(scenario.files.soa, scenario.expected_sha256.soa, [
  ['STATEMENT OF ACCOUNT'],
  ['Fund Name', scenario.fund_name],
  ['Investor Code', scenario.investor.investor_code],
  ['Reporting Date', scenario.soa.reporting_date],
  ['Commitment Amount', `INR ${scenario.soa.commitment_amount}`],
  ['Capital Called Till Date', `INR ${scenario.soa.capital_called_to_date}`],
  ['Uncalled Capital', `INR ${scenario.soa.uncalled_capital}`],
  ['Distributions Till Date', `INR ${scenario.soa.distributions_to_date}`],
  ['Current NAV', `INR ${scenario.soa.current_nav}`],
  ...scenario.soa.transactions.map((tx) => [tx.date, tx.nature, tx.reference, `INR ${tx.amount}`, tx.direction]),
]);
assert(soa.filter((line) => line === 'Capital Call').length === 2, 'SOA contains two deterministic capital-call transaction rows');
assert(soa.filter((line) => line === 'Distribution').length === 1, 'SOA contains one deterministic distribution transaction row');

verifyPdf(scenario.files.capital_call, scenario.expected_sha256.capital_call, [
  ['CAPITAL CALL NOTICE / DRAWDOWN NOTICE'],
  ['Fund Name', scenario.fund_name],
  ['Investor Code', scenario.investor.investor_code],
  ['Notice Number', scenario.capital_call.notice_number],
  ['Notice Date', scenario.capital_call.notice_date],
  ['Due Date', scenario.capital_call.due_date],
  ['Commitment Amount', `INR ${scenario.capital_call.commitment_amount}`],
  ['Capital Called Before This Notice', `INR ${scenario.capital_call.capital_called_before_notice}`],
  ['Current Capital Call', `INR ${scenario.capital_call.current_capital_call}`],
  ['Cumulative Capital Called', `INR ${scenario.capital_call.cumulative_capital_called}`],
  ['Remaining Uncalled Commitment', `INR ${scenario.capital_call.remaining_uncalled_commitment}`],
]);

const commitment = Number(scenario.capital_call.commitment_amount.replace(/,/g, ''));
const cumulative = Number(scenario.capital_call.cumulative_capital_called.replace(/,/g, ''));
const remaining = Number(scenario.capital_call.remaining_uncalled_commitment.replace(/,/g, ''));
assert(Math.abs(commitment - cumulative - remaining) < 0.01, 'capital-call commitment equation is internally consistent');

const soaCalled = Number(scenario.soa.capital_called_to_date.replace(/,/g, ''));
const txCalls = scenario.soa.transactions
  .filter((tx) => tx.nature === 'Capital Call')
  .reduce((sum, tx) => sum + Number(tx.amount.replace(/,/g, '')), 0);
assert(Math.abs(soaCalled - txCalls) < 0.01, 'SOA capital-call transaction total matches summary');

const soaDistributed = Number(scenario.soa.distributions_to_date.replace(/,/g, ''));
const txDist = scenario.soa.transactions
  .filter((tx) => tx.nature === 'Distribution')
  .reduce((sum, tx) => sum + Number(tx.amount.replace(/,/g, '')), 0);
assert(Math.abs(soaDistributed - txDist) < 0.01, 'SOA distribution transaction total matches summary');

console.log('');
console.log('PASS - P2B-2 realistic SOA + Capital Call PDF fixture corpus verified');
console.log('PASS - fixtures align to current deterministic field/transaction extraction contract');
console.log('PASS - fixtures remain candidate evidence only; canonicalWrite control remains false');