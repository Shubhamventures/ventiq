# Client 001 Data Request List

## 1. Intake rules

Client 001 should provide source data only through the agreed secure transfer route. Every source must have:

- source owner;
- fund;
- reporting period / as-of date;
- source-system or workbook name;
- file version/date;
- whether the source is considered authoritative by the client;
- known limitations or manual adjustments.

VENTIQ must not silently treat an uploaded file as canonical merely because it is newer.

## 2. Organisation and fund master

Required:

- legal organisation name;
- fund legal name and internal short name;
- strategy / asset class;
- fund currency;
- vintage / inception date;
- commitment or target size where applicable;
- reporting frequency;
- relevant legal entities / vehicles;
- primary operating contacts;
- bank/payment instructions only where required by the agreed workflow and handled through the approved secure process.

## 3. Investor master

For each investor/LP, request where applicable:

- investor legal name;
- investor reference / legacy ID;
- investor type;
- commitment amount;
- commitment date;
- closing / admission date;
- ownership or allocation percentage where relevant;
- contact persons;
- reporting email(s);
- tax / jurisdiction fields needed by the pilot;
- current status;
- opening undrawn commitment;
- any side-letter or access restrictions relevant to the pilot.

## 4. Historical investor transactions

Request transaction-level history for the agreed period:

- capital call / drawdown date;
- notice date;
- due date;
- amount called;
- amount received;
- receipt date;
- distribution date;
- distribution amount;
- recallable/non-recallable classification where used;
- fees or expenses attributed to the investor where relevant;
- adjustment / reversal records;
- transaction reference;
- source workbook or notice reference.

## 5. Fund financial history

Request the records necessary to reproduce agreed management and investor views:

- periodic NAV;
- contributed capital;
- distributions;
- fees/expenses if used by current VENTIQ calculations;
- investment cost;
- realised proceeds;
- unrealised value;
- valuation dates;
- any client-provided IRR/MOIC/TVPI/DPI benchmark values used for reconciliation;
- valuation workbooks or supporting schedules for agreed periods.

## 6. Portfolio data

For private credit / debt strategies, request where relevant:

- borrower / issuer;
- instrument;
- original principal;
- current principal;
- disbursement date;
- maturity;
- repayment schedule;
- coupon / interest terms;
- fees;
- covenants;
- security / charges;
- notices;
- actual receipts;
- expected repayment;
- internal risk/status notes.

For PE/VC strategies, request where relevant:

- company;
- investment date;
- security / round;
- invested cost;
- ownership;
- latest valuation;
- operating KPIs used by the client;
- current developments;
- expected exit timing/value;
- projected IRR/MOIC/TVPI where maintained by the client.

Only fields required for the selected Client 001 strategy should be mandatory.

## 7. Compliance data

Request only agreed pilot requirements, for example:

- compliance calendar;
- filing / obligation;
- due date;
- owner;
- status;
- evidence/document reference;
- approval requirement;
- historical completion record for the agreed period.

## 8. Documents and PDFs

Request agreed historical/current documents, including as applicable:

- investor SOAs;
- capital call notices;
- distribution notices;
- investor reports;
- valuation reports;
- portfolio documents;
- compliance evidence;
- approved Data Room documents;
- DDQ materials.

For PDFs, preserve the original file. Extracted data must remain traceable to the source document.

## 9. Structured file format

Preferred structured intake:

- `.xlsx` for client workbooks;
- `.csv` for flat extracts where appropriate.

For each workbook/file, identify:

- sheet/table name;
- row grain;
- unique business key if one exists;
- date formats;
- currency/units;
- formulas versus hard-coded values;
- blank/null convention;
- duplicate handling;
- client-known exceptions.

## 10. Data quality declaration

Before migration review, the client owner should confirm:

- requested sources have been supplied;
- known missing history is documented;
- duplicate or superseded files are identified;
- opening balances are understood;
- any manual override is declared;
- any source considered more authoritative than another is explicitly identified.

## 11. Intake register

Maintain one register with at least:

| Batch | Layer | Source | Period | Owner | Received | Validation | Exceptions | Maker | Checker | Final status |
|---|---|---|---|---|---|---|---|---|---|---|

The five governed activation layers are:

1. investor;
2. PDF;
3. portfolio;
4. fund;
5. compliance.
