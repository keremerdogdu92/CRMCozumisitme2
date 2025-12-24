// scripts/audit-table-usage.mjs
// Summary: Scans the repo for Supabase table usage (from('table')), rpc('fn'),
// and raw SQL strings to produce a usage report JSON.
// Output: used_tables.report.json
// Notes:
// - This is best-effort static analysis; dynamic table names won't be detected.
// - Review RPC functions separately to map them to tables.

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["src", "api", "netlify", "scripts", "DB/schema"];

const EXCLUDE_DIRS = new Set(["node_modules", ".git", "dist", "build", ".vercel"]);

function walk(dir, out) {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDE_DIRS.has(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.isFile()) {
      const ext = path.extname(ent.name).toLowerCase();
      // scan common code/text formats
      if ([".ts", ".tsx", ".js", ".mjs", ".cjs", ".sql", ".md"].includes(ext)) out.push(p);
    }
  }
}

const files = [];
for (const d of SCAN_DIRS) walk(path.join(ROOT, d), files);

const rxFrom = /from\(\s*['"]([a-zA-Z0-9_\.]+)['"]\s*\)/g;
const rxRpc = /rpc\(\s*['"]([a-zA-Z0-9_]+)['"]\s*/g;

// very loose SQL table detection (best-effort)
const rxSql = /\b(from|into|update|delete\s+from)\s+(public\.)?([a-zA-Z0-9_]+)/gi;

function addHit(map, name, file, line, kind, snippet) {
  if (!map[name]) map[name] = { name, hits: [], kinds: new Set() };
  map[name].hits.push({ file, line, kind, snippet });
  map[name].kinds.add(kind);
}

const tables = {};
const rpcs = {};

for (const f of files) {
  const text = fs.readFileSync(f, "utf8");
  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];

    // from('table')
    rxFrom.lastIndex = 0;
    let m;
    while ((m = rxFrom.exec(ln))) {
      addHit(tables, m[1], f, i + 1, "supabase.from", ln.trim().slice(0, 240));
    }

    // rpc('fn')
    rxRpc.lastIndex = 0;
    while ((m = rxRpc.exec(ln))) {
      const fn = m[1];
      if (!rpcs[fn]) rpcs[fn] = { name: fn, hits: [] };
      rpcs[fn].hits.push({ file: f, line: i + 1, kind: "supabase.rpc", snippet: ln.trim().slice(0, 240) });
    }

    // raw SQL
    rxSql.lastIndex = 0;
    while ((m = rxSql.exec(ln))) {
      const t = m[3];
      // filter obvious false positives
      if (!t || t.length < 2) continue;
      // skip SQL keywords that match our pattern
      const bad = new Set(["select", "where", "join", "on", "and", "or", "group", "order", "limit", "values", "set"]);
      if (bad.has(t.toLowerCase())) continue;

      addHit(tables, t, f, i + 1, "raw.sql", ln.trim().slice(0, 240));
    }
  }
}

const tableList = Object.values(tables).map((x) => ({
  name: x.name,
  kinds: Array.from(x.kinds),
  hitCount: x.hits.length,
  sample: x.hits.slice(0, 8),
}));

tableList.sort((a, b) => b.hitCount - a.hitCount);

const rpcList = Object.values(rpcs).map((x) => ({
  name: x.name,
  hitCount: x.hits.length,
  sample: x.hits.slice(0, 8),
}));
rpcList.sort((a, b) => b.hitCount - a.hitCount);

const out = {
  generatedAt: new Date().toISOString(),
  scannedDirs: SCAN_DIRS,
  filesScanned: files.length,
  tables: tableList,
  rpcs: rpcList,
};

fs.writeFileSync(path.join(ROOT, "used_tables.report.json"), JSON.stringify(out, null, 2), "utf8");
console.log(`Wrote used_tables.report.json with ${tableList.length} tables, ${rpcList.length} rpcs.`);
