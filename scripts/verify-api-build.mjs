#!/usr/bin/env node
/**
 * Build-time verification for the Vercel serverless API.
 *
 * Vercel deploys api/ as UNbUNDLED native ESM: it compiles each api/*.ts to
 * .js without rewriting import specifiers, so a relative import that Node's
 * ESM loader cannot resolve (no explicit extension, directory import …)
 * crashes every invocation with ERR_MODULE_NOT_FOUND at load time. TypeScript,
 * Vite and the Vitest-style test loader are all lenient about that, so a
 * bundle-style or extensionless import can pass the whole local pipeline and
 * still crash production.
 *
 * This script reproduces the production deployment exactly, locally:
 *
 *   1. Compiles api/ to ESM .js with tsc (same settings Vercel applies).
 *   2. Walks the emitted tree and asserts every relative import specifier
 *      resolves to a file that was emitted (the exact runtime layout).
 *   3. Imports each entry point in plain Node ESM and asserts the default
 *      export exists. This is the same module-resolution path Vercel runs.
 *
 * Any failure exits non-zero, so it breaks the build. Wired into
 * `npm run build` (the Vercel buildCommand) and `npm run verify:api`.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const buildDir = path.join(root, '.api-build');
const tscBin = path.join(root, 'node_modules', '.bin', 'tsc');
const STATIC_FROM = /from\s*['"]([^'"]+)['"]/g;
const DYNAMIC_IMPORT = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const ENTRIES = ['order-confirmation.js', 'admin-new-order.js'];

const fail = (message) => {
  console.error(`\n✗ verify:api — ${message}`);
  process.exit(1);
};

function emitApi() {
  fs.rmSync(buildDir, { recursive: true, force: true });
  try {
    execFileSync(tscBin, ['-p', 'tsconfig.api.build.json'], { cwd: root, stdio: 'inherit' });
  } catch (error) {
    fail(`tsc emit failed: ${error.message}`);
  }
}

function walkJs(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkJs(full));
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

function collectRelativeImports(file) {
  const source = fs.readFileSync(file, 'utf8');
  const specs = new Set();
  for (const regex of [STATIC_FROM, DYNAMIC_IMPORT]) {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(source)) !== null) {
      if (match[1].startsWith('.')) specs.add(match[1]);
    }
  }
  return [...specs];
}

function checkImports(allFiles) {
  const problems = [];
  for (const file of allFiles) {
    for (const spec of collectRelativeImports(file)) {
      const target = path.resolve(path.dirname(file), spec);
      if (!fs.existsSync(target)) {
        problems.push(`${path.relative(root, file)} imports "${spec}" → not emitted (${path.relative(root, target)})`);
      } else if (!target.endsWith('.js')) {
        problems.push(`${path.relative(root, file)} imports "${spec}" → resolves to non-JS file ${path.relative(root, target)}`);
      }
    }
  }
  if (problems.length) {
    fail(`relative imports that do not resolve in the emitted tree:\n  - ${problems.join('\n  - ')}`);
  }
}

async function checkEntries() {
  for (const entry of ENTRIES) {
    const file = path.join(buildDir, entry);
    if (!fs.existsSync(file)) fail(`entry point missing from emitted tree: ${entry}`);
    try {
      const mod = await import(pathToFileURL(file).href);
      if (typeof mod.default !== 'function') {
        fail(`${entry}: default export is not a function (type=${typeof mod.default})`);
      }
    } catch (error) {
      fail(`${entry}: failed to import in plain Node ESM — ${error.message}\n    this is the exact path Vercel executes at runtime`);
    }
  }
}

console.log('verify:api — compiling api/ to ESM .js (Vercel runtime layout)…');
emitApi();
const allFiles = walkJs(buildDir);
if (allFiles.length === 0) fail('nothing was emitted — check tsconfig.api.build.json');

console.log(`verify:api — emitted ${allFiles.length} modules; checking relative imports…`);
checkImports(allFiles);

console.log('verify:api — loading entry points in plain Node ESM…');
await checkEntries();

fs.rmSync(buildDir, { recursive: true, force: true });
console.log(`verify:api — OK: ${allFiles.length} modules, all relative imports resolve, ${ENTRIES.length} entries load with a default export.`);
