// scripts/convert_legacy_patients_to_v2.ts
// CLI to convert templates/legacy_patients.csv into templates/patients_import_ready_v2.csv matching the v2 patients import header.

import fs from "fs";
import path from "path";

type ParsedCsv = {
  headers: string[];
  rows: string[][];
};

const LEGACY_PATH = path.join(process.cwd(), "templates", "legacy_patients.csv");
const OUTPUT_PATH = path.join(
  process.cwd(),
  "templates",
  "patients_import_ready_v2.csv"
);

const OUTPUT_HEADER = [
  "full_name",
  "national_id",
  "phone",
  "payment_method",
  "sale_total",
  "card_sale_total",
  "card_fee_rate",
  "sale_date",
  "kin_phone",
  "address",
  "sgk_flag",
  "sgk_prescription_received",
  "sgk_recorded_to_system"
];

const REQUIRED_LEGACY_COLUMNS = [
  "full_name",
  "national_id",
  "phone",
  "kin_phone",
  "address",
  "reference_name",
  "sale_total",
  "sale_date",
  "sgk_flag",
  "sgk_prescription_received",
  "sgk_recorded_to_system",
  "card_fee_rate"
];

function normalizeHeaderKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "");
}

function detectDelimiter(headerLine: string): string {
  const commaCount = (headerLine.match(/,/g) ?? []).length;
  const semiCount = (headerLine.match(/;/g) ?? []).length;
  return semiCount > commaCount ? ";" : ",";
}

function parseLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }

  result.push(current);
  return result;
}

function parseCsv(text: string): ParsedCsv {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    throw new Error("Legacy CSV is empty.");
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseLine(lines[0], delimiter);

  const rows: string[][] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i], delimiter);
    if (cols.every((c) => c.trim() === "")) continue;
    rows.push(cols);
  }

  return { headers, rows };
}

function serializeCsvRow(cols: string[], delimiter: string): string {
  return cols
    .map((col) => {
      const needsQuote =
        col.includes(delimiter) || col.includes('"') || col.includes("\n");
      if (!needsQuote) return col;
      const escaped = col.replace(/"/g, '""');
      return `"${escaped}"`;
    })
    .join(delimiter);
}

function ensureLegacyColumns(headerRow: string[]): Record<string, number> {
  const indexMap: Record<string, number> = {};

  headerRow.forEach((h, idx) => {
    indexMap[normalizeHeaderKey(h)] = idx;
  });

  for (const col of REQUIRED_LEGACY_COLUMNS) {
    const key = normalizeHeaderKey(col);
    if (indexMap[key] === undefined) {
      throw new Error(
        `Missing required legacy column "${col}" in templates/legacy_patients.csv`
      );
    }
  }

  return indexMap;
}

function getValue(
  row: string[],
  indexMap: Record<string, number>,
  key: string
): string {
  const idx = indexMap[normalizeHeaderKey(key)];
  if (idx === undefined) return "";
  return (row[idx] ?? "").trim();
}

function main() {
  const csvText = fs.readFileSync(LEGACY_PATH, "utf8");
  const { headers, rows } = parseCsv(csvText);
  const indexMap = ensureLegacyColumns(headers);

  const outputLines: string[] = [];
  outputLines.push(OUTPUT_HEADER.join(","));

  let processed = 0;
  let rowsWithEmptyCritical = 0;

  for (const row of rows) {
    const fullName = getValue(row, indexMap, "full_name");
    const nationalId = getValue(row, indexMap, "national_id");
    const phone = getValue(row, indexMap, "phone");
    const saleTotal = getValue(row, indexMap, "sale_total");
    const paymentMethod = "Nakit";

    const outputRow = [
      fullName,
      nationalId,
      phone,
      paymentMethod,
      saleTotal,
      "",
      getValue(row, indexMap, "card_fee_rate"),
      getValue(row, indexMap, "sale_date"),
      getValue(row, indexMap, "kin_phone"),
      getValue(row, indexMap, "address"),
      getValue(row, indexMap, "sgk_flag"),
      getValue(row, indexMap, "sgk_prescription_received"),
      getValue(row, indexMap, "sgk_recorded_to_system")
    ];

    const criticalEmpty =
      !fullName || !nationalId || !phone || !saleTotal || !paymentMethod;
    if (criticalEmpty) rowsWithEmptyCritical++;

    outputLines.push(serializeCsvRow(outputRow, ","));
    processed++;
  }

  fs.writeFileSync(OUTPUT_PATH, outputLines.join("\n"), "utf8");

  console.log("Conversion completed.");
  console.log(`Input rows processed: ${processed}`);
  console.log(`Rows with empty critical fields: ${rowsWithEmptyCritical}`);
}

main();
