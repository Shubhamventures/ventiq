import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const DEFAULT_SCENARIO = path.join(ROOT, 'quality', 'fixtures', 'client-001', 'pdf-intelligence', 'p2b-pdf-intelligence-scenario.json');

function argValue(name, fallback = '') {
  const idx = process.argv.indexOf(name);
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : fallback;
}
function pdfEscape(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/[\r\n]+/g, ' ');
}
function contentForPage(items) {
  const out = ['q'];
  for (const item of items) {
    if (item.type === 'line') {
      out.push(`${item.x1} ${item.y1} m ${item.x2} ${item.y2} l S`);
      continue;
    }
    out.push('BT');
    out.push(`${item.bold ? '/F2' : '/F1'} ${item.size ?? 10} Tf`);
    out.push(`${item.x ?? 54} ${item.y} Td`);
    out.push(`(${pdfEscape(item.text)}) Tj`);
    out.push('ET');
  }
  out.push('Q');
  return out.join('\n');
}
function buildPdf(pages) {
  const objects = new Map();
  objects.set(1, '<< /Type /Catalog /Pages 2 0 R >>');
  const pageIds = [];
  let nextId = 5;
  for (const page of pages) {
    const pageId = nextId++;
    const contentId = nextId++;
    pageIds.push(pageId);
    const content = contentForPage(page);
    objects.set(contentId, `<< /Length ${Buffer.byteLength(content, 'ascii')} >>\nstream\n${content}\nendstream`);
    objects.set(pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`);
  }
  objects.set(2, `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`);
  objects.set(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  objects.set(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');

  const maxId = Math.max(...objects.keys());
  let body = '%PDF-1.4\n%VENTIQ-P2B\n';
  const offsets = new Array(maxId + 1).fill(0);
  for (let id = 1; id <= maxId; id++) {
    offsets[id] = Buffer.byteLength(body, 'ascii');
    body += `${id} 0 obj\n${objects.get(id)}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(body, 'ascii');
  body += `xref\n0 ${maxId + 1}\n`;
  body += '0000000000 65535 f \n';
  for (let id = 1; id <= maxId; id++) {
    body += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  }
  body += `trailer\n<< /Size ${maxId + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(body, 'ascii');
}
function header(title, subtitle) {
  return [
    { text: 'VENTIQ CLIENT 001 - SYNTHETIC PILOT EVIDENCE', x: 54, y: 748, size: 9, bold: true },
    { text: title, x: 54, y: 714, size: 18, bold: true },
    { text: subtitle, x: 54, y: 692, size: 10 },
    { type: 'line', x1: 54, y1: 680, x2: 558, y2: 680 },
  ];
}
function pair(items, label, value, y, opts = {}) {
  items.push({ text: label, x: opts.x ?? 54, y, size: opts.labelSize ?? 9, bold: true });
  items.push({ text: String(value), x: opts.valueX ?? 72, y: y - 16, size: opts.valueSize ?? 10 });
  return y - (opts.step ?? 42);
}
function soaPages(s) {
  const p1 = [...header('STATEMENT OF ACCOUNT', 'Investor Capital Account Statement / SOA')];
  let y = 650;
  y = pair(p1, 'Fund Name', s.fund_name, y);
  y = pair(p1, 'Investor Code', s.investor.investor_code, y);
  y = pair(p1, 'Investor Name', s.investor.investor_name, y);
  y = pair(p1, 'Email', s.investor.email, y);
  y = pair(p1, 'PAN / Tax ID', s.investor.tax_id, y);
  y = pair(p1, 'Folio Number', s.investor.folio_number, y);
  y = pair(p1, 'Reporting Period', s.soa.reporting_period, y);
  y = pair(p1, 'Reporting Date', s.soa.reporting_date, y);
  p1.push({ text: 'CAPITAL POSITION', x: 54, y: y - 2, size: 12, bold: true });
  y -= 30;
  y = pair(p1, 'Commitment Amount', `INR ${s.soa.commitment_amount}`, y, { step: 38 });
  y = pair(p1, 'Capital Called Till Date', `INR ${s.soa.capital_called_to_date}`, y, { step: 38 });
  y = pair(p1, 'Uncalled Capital', `INR ${s.soa.uncalled_capital}`, y, { step: 38 });
  y = pair(p1, 'Distributions Till Date', `INR ${s.soa.distributions_to_date}`, y, { step: 38 });
  y = pair(p1, 'Current NAV', `INR ${s.soa.current_nav}`, y, { step: 38 });
  p1.push({ text: 'This statement is synthetic regression evidence and has no legal or financial effect.', x: 54, y: 70, size: 8 });

  const p2 = [...header('STATEMENT OF ACCOUNT - TRANSACTIONS', 'Deterministic transaction extraction fixture')];
  p2.push({ text: `Fund Name: ${s.fund_name}`, x: 54, y: 654, size: 9 });
  p2.push({ text: `Investor Code: ${s.investor.investor_code}`, x: 54, y: 636, size: 9 });
  p2.push({ text: `Reporting Period: ${s.soa.reporting_period}`, x: 54, y: 618, size: 9 });
  p2.push({ text: 'TRANSACTION ROWS', x: 54, y: 580, size: 12, bold: true });
  let ty = 550;
  for (const tx of s.soa.transactions) {
    const rows = [tx.date, tx.nature, tx.reference, `INR ${tx.amount}`, tx.direction];
    for (const row of rows) {
      p2.push({ text: row, x: 72, y: ty, size: 10 });
      ty -= 17;
    }
    ty -= 14;
  }
  p2.push({ text: 'Each transaction is intentionally rendered as five extraction lines: date, nature, reference, amount, direction.', x: 54, y: 94, size: 8 });
  return [p1, p2];
}
function capitalCallPages(s) {
  const p1 = [...header('CAPITAL CALL NOTICE / DRAWDOWN NOTICE', 'Capital Contribution Notice')];
  let y = 650;
  y = pair(p1, 'Fund Name', s.fund_name, y);
  y = pair(p1, 'Investor Code', s.investor.investor_code, y);
  y = pair(p1, 'Investor Name', s.investor.investor_name, y);
  y = pair(p1, 'PAN / Tax ID', s.investor.tax_id, y);
  y = pair(p1, 'Folio Number', s.investor.folio_number, y);
  y = pair(p1, 'Notice Number', s.capital_call.notice_number, y);
  y = pair(p1, 'Notice Date', s.capital_call.notice_date, y);
  y = pair(p1, 'Due Date', s.capital_call.due_date, y);
  p1.push({ text: 'CAPITAL CALL SUMMARY', x: 54, y: y - 2, size: 12, bold: true });
  y -= 30;
  y = pair(p1, 'Commitment Amount', `INR ${s.capital_call.commitment_amount}`, y, { step: 38 });
  y = pair(p1, 'Capital Called Before This Notice', `INR ${s.capital_call.capital_called_before_notice}`, y, { step: 38 });
  y = pair(p1, 'Current Capital Call', `INR ${s.capital_call.current_capital_call}`, y, { step: 38 });
  p1.push({ text: 'This notice is synthetic regression evidence and has no legal or financial effect.', x: 54, y: 70, size: 8 });

  const p2 = [...header('CAPITAL CALL NOTICE - CONTINUED', 'Cumulative call and remaining commitment evidence')];
  p2.push({ text: `Fund Name: ${s.fund_name}`, x: 54, y: 654, size: 9 });
  p2.push({ text: `Investor Code: ${s.investor.investor_code}`, x: 54, y: 636, size: 9 });
  p2.push({ text: `Reporting Period: ${s.capital_call.reporting_period}`, x: 54, y: 618, size: 9 });
  let y2 = 574;
  y2 = pair(p2, 'Cumulative Capital Called', `INR ${s.capital_call.cumulative_capital_called}`, y2);
  y2 = pair(p2, 'Remaining Uncalled Commitment', `INR ${s.capital_call.remaining_uncalled_commitment}`, y2);
  y2 = pair(p2, 'Payment Due Date', s.capital_call.due_date, y2);
  y2 = pair(p2, 'Current Call', `INR ${s.capital_call.current_capital_call}`, y2);
  p2.push({ text: 'Please remit the current capital call on or before the payment due date.', x: 54, y: y2 - 4, size: 10, bold: true });
  p2.push({ text: 'Purpose: portfolio investment funding and management fee reserve.', x: 54, y: y2 - 30, size: 9 });
  p2.push({ text: 'Synthetic payment instructions - do not remit funds.', x: 54, y: 70, size: 8 });
  return [p1, p2];
}

const scenarioPath = argValue('--scenario', DEFAULT_SCENARIO);
const outDir = argValue('--out-dir', path.dirname(scenarioPath));
const scenario = JSON.parse(fs.readFileSync(scenarioPath, 'utf8'));
scenario.fund_name = argValue('--fund-name', scenario.fund_name);
scenario.investor.investor_code = argValue('--investor-code', scenario.investor.investor_code);
scenario.investor.investor_name = argValue('--investor-name', scenario.investor.investor_name);
scenario.investor.email = argValue('--investor-email', scenario.investor.email);
scenario.investor.tax_id = argValue('--investor-tax-id', scenario.investor.tax_id);
scenario.investor.folio_number = argValue('--folio-number', scenario.investor.folio_number);

fs.mkdirSync(outDir, { recursive: true });
const files = [
  { name: scenario.files.soa, bytes: buildPdf(soaPages(scenario)) },
  { name: scenario.files.capital_call, bytes: buildPdf(capitalCallPages(scenario)) },
];
for (const file of files) fs.writeFileSync(path.join(outDir, file.name), file.bytes);

console.log(`PASS - generated ${files.length} P2B PDF fixtures`);
for (const file of files) {
  const sha256 = crypto.createHash('sha256').update(file.bytes).digest('hex');
  console.log(`PASS - ${file.name} bytes=${file.bytes.length} sha256=${sha256}`);
}