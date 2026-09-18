#!/usr/bin/env node
// Path-consistency guard: vercel.json rewrites <-> vite PUBLIC_ALIASES + no physical refs.
// Usage: node scripts/check-paths.js (exit 0 consistent, 1 drifted). No dependencies.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const fails = [];
const passes = [];

function pubOf(src) {
  return src.replace(/\/:path\*$/, '/');
}
function physOf(dst) {
  return dst.replace(/\/:path\*$/, '/').replace(/^\//, '');
}

function loadVercel() {
  const raw = fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8');
  const json = JSON.parse(raw);
  const map = new Map();
  for (const r of json.rewrites || []) {
    if (!r || typeof r.source !== 'string' || typeof r.destination !== 'string') continue;
    if (!r.source.endsWith('/:path*')) continue;
    if (!/^\/(apps|packages|assets)\//.test(r.destination)) continue;
    map.set(pubOf(r.source), physOf(r.destination));
  }
  return map;
}

function loadAliases() {
  const text = fs.readFileSync(path.join(ROOT, 'vite.config.js'), 'utf8');
  const block = text.match(/PUBLIC_ALIASES\s*=\s*\{([\s\S]*?)\}/);
  if (!block) {
    fails.push('FAIL vite PUBLIC_ALIASES block not found (vite.config.js:1)');
    return new Map();
  }
  const map = new Map();
  const re = /['"]([^'"]+)['"]\s*:\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(block[1])) !== null) map.set(m[1], m[2]);
  return map;
}

function checkMaps(vercel, aliases) {
  const vKeys = [...vercel.keys()].sort();
  const aKeys = [...aliases.keys()].sort();
  for (const k of vKeys) {
    if (!aliases.has(k)) fails.push(`FAIL alias missing in vite PUBLIC_ALIASES: ${k} (vercel -> /${vercel.get(k)})`);
    else if (aliases.get(k) !== vercel.get(k))
      fails.push(`FAIL alias target drift: ${k} vercel=/${vercel.get(k)} vite=${aliases.get(k)}`);
    else passes.push(`PASS alias ${k} <-> ${vercel.get(k)}`);
  }
  for (const k of aKeys) {
    if (!vercel.has(k)) fails.push(`FAIL rewrite missing in vercel.json: ${k} (vite -> ${aliases.get(k)})`);
  }
}

const SCAN_ROOTS = ['apps', 'pages', 'packages/js'];
const EXTS = new Set(['.html', '.js', '.css', '.vue']);
const PHYS_RE = /["'(]\/(apps|packages)\//g;
const STALE_RE = /(?<![\w/])data\/database\.json/g;

function walk(dir, out) {
  let ents = [];
  try {
    ents = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  ents.sort((a, b) => a.name.localeCompare(b.name));
  for (const e of ents) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (['node_modules', 'dist', '.git'].includes(e.name)) continue;
      walk(p, out);
    } else if (e.isFile() && EXTS.has(path.extname(e.name))) out.push(p);
  }
  return out;
}

function grepSources() {
  const files = [];
  for (const r of SCAN_ROOTS) walk(path.join(ROOT, r), files);
  files.sort();
  for (const f of files) {
    const rel = path.relative(ROOT, f).replace(/\\/g, '/');
    let lines = [];
    try {
      lines = fs.readFileSync(f, 'utf8').split('\n');
    } catch {
      continue;
    }
    lines.forEach((line, i) => {
      if (PHYS_RE.test(line)) fails.push(`FAIL physical path ref ${rel}:${i + 1}: ${line.trim().slice(0, 120)}`);
      PHYS_RE.lastIndex = 0;
      if (STALE_RE.test(line)) fails.push(`FAIL stale db ref ${rel}:${i + 1}: use /archive/data/database.json`);
      STALE_RE.lastIndex = 0;
    });
  }
}

(function main() {
  let vercel, aliases;
  try {
    vercel = loadVercel();
  } catch (e) {
    fails.push(`FAIL vercel.json unreadable: ${e.message}`);
    vercel = new Map();
  }
  try {
    aliases = loadAliases();
  } catch (e) {
    fails.push(`FAIL vite.config.js unreadable: ${e.message}`);
    aliases = new Map();
  }
  checkMaps(vercel, aliases);
  grepSources();
  for (const p of passes) console.log(p);
  for (const f of fails) console.log(f);
  if (fails.length === 0) console.log(`PASS path consistency OK (${passes.length} aliases, source refs clean)`);
  else console.log(`FAIL ${fails.length} problem(s) found`);
  process.exit(fails.length === 0 ? 0 : 1);
})();
