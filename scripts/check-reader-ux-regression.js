#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SCRATCH_ROOT = path.join(ROOT, 'node_modules', '.cache', 'reader-ux-regression');
fs.mkdirSync(SCRATCH_ROOT, { recursive: true });
const RUN_ROOT = fs.mkdtempSync(path.join(SCRATCH_ROOT, 'reader-ux-regression-run-'));

function disableFigureIndex(text) {
  const config = JSON.parse(text);
  config.ux.modules.figureIndex = false;
  return JSON.stringify(config, null, 2) + '\n';
}

function breakFigureIndexRoute(text) {
  const config = JSON.parse(text);
  const appendices = config.structure && Array.isArray(config.structure.appendices)
    ? config.structure.appendices : [];
  const figureIndex = appendices.find(function (item) { return item.id === 'figure-index'; });
  if (!figureIndex) return text;
  figureIndex.path = '/appendices/figures/';
  return JSON.stringify(config, null, 2) + '\n';
}

function removeReaderUXGate(text, gate) {
  const pkg = JSON.parse(text);
  pkg.scripts.test = String(pkg.scripts.test || '').split('&&').map(function (command) {
    return command.trim();
  }).filter(function (command) {
    return command !== gate;
  }).join(' && ');
  return JSON.stringify(pkg, null, 2) + '\n';
}

const cases = [
  ['disabled module flag', 'book-config.json', disableFigureIndex],
  ['broken config route', 'book-config.json', breakFigureIndexRoute],
  ['missing positive reader UX gate', 'package.json', function (text) { return removeReaderUXGate(text, 'npm run check:reader-ux'); }],
  ['missing reader UX regression gate', 'package.json', function (text) { return removeReaderUXGate(text, 'npm run check:reader-ux-regression'); }],
  ['missing route source', 'docs/appendices/figure-index/index.md', function () { return null; }],
  ['missing navigation route', 'docs/_data/navigation.yml', function (text) { return text.replace(/^\s*-\s*title:\s*["']図表索引["']\s*\r?\n\s*path:\s*["']\/appendices\/figure-index\/["']\s*\r?\n/m, ''); }],
  ['missing references navigation route', 'docs/_data/navigation.yml', function (text) { return text.replace(/^\s*-\s*title:\s*["']参考文献["']\s*\r?\n\s*path:\s*["']\/appendices\/references\/["']\s*\r?\n/m, ''); }],
  ['missing top route', 'docs/index.md', function (text) { return text.replace(/^-\s*対応の全体像を図から確認する場合は\[図表索引\]\(appendices\/figure-index\/\)を使う\s*\r?\n/m, ''); }],
  ['missing figure reference', 'docs/chapters/chapter-05/index.md', function (text) { return text.replace('/assets/images/figures/ch05-severity-roles-timeline.svg', '/assets/images/ch05-severity-roles-timeline.svg'); }],
  ['missing stable anchor', 'docs/chapters/chapter-05/index.md', function (text) { return text.replace('id="figure-ch05-severity-roles-timeline"', 'id="severity-roles-timeline"'); }],
  ['missing text alternative', 'docs/chapters/chapter-05/index.md', function (text) { return text.replace('class="figure-text-alternative"', 'class="alternative"'); }],
  ['missing index entry', 'docs/appendices/figure-index/index.md', function (text) { return text.replace('href="../../chapters/chapter-05/#figure-ch05-severity-roles-timeline"', 'href="../../chapters/chapter-05/"'); }],
  ['out-of-order index entries', 'docs/appendices/figure-index/index.md', function (text) {
    return text
      .replace('../../chapters/chapter-02/#figure-ch02-detection-evidence-triage', '__FIGURE_INDEX_SWAP__')
      .replace('../../chapters/chapter-05/#figure-ch05-severity-roles-timeline', '../../chapters/chapter-02/#figure-ch02-detection-evidence-triage')
      .replace('__FIGURE_INDEX_SWAP__', '../../chapters/chapter-05/#figure-ch05-severity-roles-timeline');
  }],
  ['missing figure asset', 'docs/assets/images/figures/ch05-severity-roles-timeline.svg', function () { return null; }],
  ['extra figure asset', 'docs/assets/images/figures/extra.svg', function () { return '<svg xmlns="http://www.w3.org/2000/svg"></svg>'; }],
  ['missing SVG accessibility', 'docs/assets/images/figures/ch05-severity-roles-timeline.svg', function (text) { return text.replace('role="img"', 'role="presentation"'); }],
  ['misnamed root SVG label attribute', 'docs/assets/images/figures/ch05-severity-roles-timeline.svg', function (text) { return text.replace('aria-labelledby=', 'data-aria-labelledby='); }],
  ['protocol-relative SVG resource', 'docs/assets/images/figures/ch05-severity-roles-timeline.svg', function (text) { return text.replace('</svg>', '<a href="//example.invalid/figure"><text>external</text></a></svg>'); }],
  ['relative SVG resource', 'docs/assets/images/figures/ch05-severity-roles-timeline.svg', function (text) { return text.replace('</svg>', '<use href="other.svg#shape"/></svg>'); }],
  ['external SVG resource', 'docs/assets/images/figures/ch05-severity-roles-timeline.svg', function (text) { return text.replace('</svg>', '<image href="https://example.invalid/figure.png"/></svg>'); }],
  ['broken mobile rule', 'docs/assets/css/mobile-responsive.css', function (text) { return text.replace(/\.figure-index-list\s+li,\s*\r?\n\s*\.figure-text-alternative\s*\{/, '.figure-index-list li,\n  .broken-alternative {'); }],
  ['broken sidebar renderer', 'docs/_includes/sidebar-nav.html', function (text) { return text.replaceAll('navigation.appendices', 'navigation.resources_only'); }],
  ['broken prev-next renderer', 'docs/_includes/page-navigation.html', function (text) { return text.replace('additional,resources,appendices,afterword', 'additional,resources,afterword'); }]
];

function createFixture() {
  const fixture = fs.mkdtempSync(path.join(RUN_ROOT, 'case-'));
  fs.copyFileSync(path.join(ROOT, 'book-config.json'), path.join(fixture, 'book-config.json'));
  fs.copyFileSync(path.join(ROOT, 'package.json'), path.join(fixture, 'package.json'));
  fs.cpSync(path.join(ROOT, 'docs'), path.join(fixture, 'docs'), { recursive: true });
  return fixture;
}

let passed = 0;
for (const testCase of cases) {
  const name = testCase[0];
  const relative = testCase[1];
  const mutate = testCase[2];
  const fixture = createFixture();
  try {
    const target = path.join(fixture, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const targetExisted = fs.existsSync(target);
    const original = targetExisted ? fs.readFileSync(target, 'utf8') : '';
    const changed = mutate(original);
    if ((changed === null && !targetExisted) || (changed !== null && changed === original)) {
      console.error('Negative regression fixture was not mutated: ' + name);
      process.exitCode = 1;
      break;
    }
    if (changed === null) fs.rmSync(target);
    else fs.writeFileSync(target, changed);

    const result = childProcess.spawnSync(process.execPath, [path.join(ROOT, 'scripts/check-reader-ux.js')], {
      cwd: ROOT,
      env: Object.assign({}, process.env, { READER_UX_ROOT: fixture }),
      encoding: 'utf8'
    });
    if (result.error || result.signal || result.status === null) {
      console.error('Negative regression harness failed for ' + name + ': ' +
        (result.error ? result.error.message : 'child terminated without an exit status'));
      process.exitCode = 1;
      break;
    }
    if (result.status !== 1) {
      console.error(result.status === 0
        ? 'Negative regression failed to reject: ' + name
        : 'Negative regression returned unexpected status ' + result.status + ': ' + name);
      process.exitCode = 1;
      break;
    }
    if (!String(result.stderr || '').includes('Reader UX check failed:')) {
      console.error('Negative regression did not produce a controlled checker failure: ' + name);
      process.exitCode = 1;
      break;
    }
    passed += 1;
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
}

fs.rmSync(RUN_ROOT, { recursive: true, force: true });
for (const directory of [SCRATCH_ROOT, path.dirname(SCRATCH_ROOT)]) {
  try {
    fs.rmdirSync(directory);
  } catch (error) {
    if (error.code !== 'ENOENT' && error.code !== 'ENOTEMPTY') throw error;
  }
}

if (process.exitCode) process.exit(process.exitCode);
console.log('Reader UX negative regression passed: ' + passed + '/' + cases.length + '.');
