// Lists every piece of English text in the app (JSX text, placeholders,
// titles, error messages) so it can be translated for the whole-site
// translator (app/AutoTranslate.tsx, phrase books in lib/i18n/auto/).
//
// Usage: node scripts/extract-ui-text.js .   -> writes strings.json
// Then translate any new strings and add them to lib/i18n/auto/es.json
// (English text as the key, Spanish as the value). Anything missing just
// stays in English.
const ts = require('typescript');
const fs = require('fs'), path = require('path');
const root = process.argv[2];
const files = [];
(function walk(d){ for (const f of fs.readdirSync(d)) { const p = path.join(d,f); const st = fs.statSync(p);
  if (st.isDirectory()) { if (!['node_modules','.next','api'].includes(f)) walk(p); }
  else if (/\.(tsx|ts)$/.test(f) && !f.endsWith('.d.ts')) files.push(p); } })(path.join(root,'app'));
(function walk(d){ for (const f of fs.readdirSync(d)) { const p = path.join(d,f); const st = fs.statSync(p);
  if (st.isDirectory()) { if (!['i18n','supabase','fingerprint'].includes(f)) walk(p); }
  else if (/\.(ts|tsx)$/.test(f)) files.push(p); } })(path.join(root,'lib'));
const ATTRS = new Set(['placeholder','title','aria-label','alt','label']);
const out = new Map();
const norm = s => s.replace(/\s+/g,' ').trim();
const ok = s => /[A-Za-z]{2,}/.test(s) && !/^[a-z0-9_\-\/.:#?=&%]+$/.test(s) && !/^(https?:|\/)/.test(s) && s.length < 600;
function add(s, file){ s = norm(s); if (!ok(s)) return; if (!out.has(s)) out.set(s, new Set()); out.get(s).add(path.relative(root,file)); }
function inClassName(n){ for (let p=n.parent; p; p=p.parent){ if (ts.isJsxAttribute(p)) return /^(className|href|src|key|id|name|type|value|htmlFor|role|rel|target|method|action|accept|autoComplete|inputMode|pattern|style|d|viewBox|fill|stroke|strokeLinecap|strokeLinejoin|xmlns|encType|loading|sizes|referrerPolicy|allow|form|lang|dir)$/.test(p.name.getText()); if (ts.isJsxElement(p)||ts.isJsxSelfClosingElement(p)) return false; } return false; }
for (const file of files) {
  const src = ts.createSourceFile(file, fs.readFileSync(file,'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('x')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  const isLib = file.includes('/lib/');
  const isAction = file.includes('/app/actions/') || /\/(route|actions?)\.ts$/.test(file);
  (function visit(n){
    if (ts.isJsxText(n)) add(n.getText().replace(/&apos;/g,"'").replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&mdash;/g,'—').replace(/&rarr;/g,'→').replace(/&nbsp;/g,' '), file);
    else if (ts.isJsxAttribute(n) && ATTRS.has(n.name.getText()) && n.initializer && ts.isStringLiteral(n.initializer)) add(n.initializer.text, file);
    else if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n))) {
      const t = n.text;
      let inJsx=false; for (let p=n.parent; p; p=p.parent){ if (ts.isJsxExpression(p)||ts.isJsxAttribute(p)) { inJsx=true; break; } if (ts.isSourceFile(p)) break; }
      if (inJsx && !inClassName(n) && /[A-Z]|\s/.test(t) && !/^[a-z0-9:\-\/\[\]\.%_!]+( [a-z0-9:\-\/\[\]\.%_!]+)*$/.test(t.trim()) ) add(t, file);
      else if (!inJsx && /\s/.test(t.trim()) && /^[A-Z"“'(0-9$]/.test(t.trim())) {
        // sentence-like literals: error messages, labels, constants
        if (/[a-z]/.test(t) && !/[{}<>;]|=>|\bconst\b/.test(t)) add(t, file);
      }
    }
    else if (ts.isTemplateExpression(n)) {
      // keep the static pieces of `by ${x}`-style text shown in JSX
      let inJsx=false; for (let p=n.parent; p; p=p.parent){ if (ts.isJsxExpression(p)) { inJsx=!inClassName(n); break; } }
      if (inJsx) { add(n.head.text, file); for (const s of n.templateSpans) add(s.literal.text, file); }
    }
    ts.forEachChild(n, visit);
  })(src);
}
const arr = [...out.entries()].map(([s,f])=>({s, files:[...f]}));
fs.writeFileSync('strings.json', JSON.stringify(arr,null,1));
console.log(arr.length, arr.reduce((a,b)=>a+b.s.length,0));
