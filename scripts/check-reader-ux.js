#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(process.env.READER_UX_ROOT || path.join(__dirname, '..'));
const errors = [];
const figures = [
  {
    source: 'docs/chapters/chapter-02/index.md',
    anchor: 'figure-ch02-detection-evidence-triage',
    asset: 'ch02-detection-evidence-triage.svg',
    indexHref: '../../chapters/chapter-02/#figure-ch02-detection-evidence-triage'
  },
  {
    source: 'docs/chapters/chapter-05/index.md',
    anchor: 'figure-ch05-severity-roles-timeline',
    asset: 'ch05-severity-roles-timeline.svg',
    indexHref: '../../chapters/chapter-05/#figure-ch05-severity-roles-timeline'
  },
  {
    source: 'docs/chapters/chapter-06/index.md',
    anchor: 'figure-ch06-communication-escalation',
    asset: 'ch06-communication-escalation.svg',
    indexHref: '../../chapters/chapter-06/#figure-ch06-communication-escalation'
  },
  {
    source: 'docs/chapters/chapter-08/index.md',
    anchor: 'figure-ch08-recovery-postmortem-loop',
    asset: 'ch08-recovery-postmortem-loop.svg',
    indexHref: '../../chapters/chapter-08/#figure-ch08-recovery-postmortem-loop'
  }
];
const expectedModules = {
  quickStart: true,
  readingGuide: true,
  checklistPack: true,
  troubleshootingFlow: true,
  conceptMap: false,
  figureIndex: true,
  legalNotice: false,
  glossary: false
};

function read(file) {
  try {
    return fs.readFileSync(path.join(ROOT, file), 'utf8');
  } catch (error) {
    errors.push(file + ': cannot read (' + error.message + ')');
    return '';
  }
}

function expect(condition, message) {
  if (!condition) errors.push(message);
}

function count(text, needle) {
  return text.split(needle).length - 1;
}

function openingTagAttribute(markup, tagName, attributeName) {
  const openingTag = markup.match(new RegExp('<' + tagName + '\\b[^>]*>', 'i'));
  if (!openingTag) return null;
  const attribute = openingTag[0].match(
    new RegExp("(?:^|\\s)" + attributeName + "\\s*=\\s*([\"'])(.*?)\\1", 'i')
  );
  return attribute ? attribute[2] : null;
}

function walkMarkdown(dir) {
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) return [];
  const result = [];
  const entries = fs.readdirSync(full, { withFileTypes: true }).sort(function (a, b) {
    return a.name.localeCompare(b.name);
  });
  for (const entry of entries) {
    const relative = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) result.push.apply(result, walkMarkdown(relative));
    else if (entry.isFile() && entry.name.endsWith('.md')) result.push(relative);
  }
  return result;
}

let config = {};
const configText = read('book-config.json');
if (configText) {
  try {
    config = JSON.parse(configText);
  } catch (error) {
    errors.push('book-config.json: invalid JSON (' + error.message + ')');
  }
}
expect(config.ux && config.ux.profile === 'B', 'book-config.json: ux.profile must be B');
for (const key of Object.keys(expectedModules)) {
  expect(config.ux && config.ux.modules && config.ux.modules[key] === expectedModules[key],
    'book-config.json: ux.modules.' + key + ' must be ' + expectedModules[key]);
}
const appendices = config.structure && Array.isArray(config.structure.appendices) ? config.structure.appendices : [];
expect(appendices.filter(function (item) {
  return item.id === 'figure-index' && item.title === '図表索引' && item.path === '/appendices/figure-index/';
}).length === 1, 'book-config.json: structure.appendices must contain one figure-index route');

const nav = read('docs/_data/navigation.yml');
const top = read('docs/index.md');
const index = read('docs/appendices/figure-index/index.md');
const css = read('docs/assets/css/mobile-responsive.css');
const layout = read('docs/_layouts/book.html');
const sidebar = read('docs/_includes/sidebar-nav.html');
const pageNavigation = read('docs/_includes/page-navigation.html');
expect(count(nav, 'path: "/appendices/figure-index/"') === 1,
  'navigation: figure-index route must appear exactly once');
expect(count(nav, 'path: "/appendices/references/"') === 1,
  'navigation: references route must appear exactly once');
const referencesPosition = nav.indexOf('path: "/appendices/references/"');
const figureIndexPosition = nav.indexOf('path: "/appendices/figure-index/"');
expect(referencesPosition !== -1 && figureIndexPosition !== -1 && referencesPosition < figureIndexPosition,
  'navigation: figure index must follow the existing appendices');
expect(count(top, '](appendices/figure-index/)') === 2,
  'docs/index.md: figure-index link must appear exactly twice');
expect(index.includes('title: "図表索引"') && index.includes('order: 930') &&
  index.includes('permalink: /appendices/figure-index/'), 'figure index: expected front matter and canonical route');
expect(count(index, '<li>') === figures.length,
  'figure index: expected exactly ' + figures.length + ' entries');
let previousIndexPosition = -1;
for (const figure of figures) {
  const position = index.indexOf('href="' + figure.indexHref + '"');
  expect(position > previousIndexPosition,
    'figure index: entries must appear once in chapter order; invalid position for ' + figure.anchor);
  previousIndexPosition = position;
}
expect(!index.includes('/incident-response-basics-book/'),
  'figure index: hard-coded GitHub Pages baseurl is forbidden');
expect(css.includes('.book-figure img') && css.includes('.figure-index-list') &&
  css.includes('.figure-text-alternative'), 'CSS: figure, index and text alternative rules are required');
expect(/@media \(max-width: 640px\)\s*\{[\s\S]*?\.figure-index-list li,[\s\S]*?\.figure-text-alternative\s*\{[\s\S]*?padding:\s*0\.75rem;/.test(css),
  'mobile CSS: figure index and text alternative narrow rules are required');
expect(layout.includes('{% include sidebar-nav.html %}') && layout.includes('{% include page-navigation.html %}'),
  'book layout: sidebar and page navigation includes are required');
expect(sidebar.includes('navigation.appendices') && sidebar.includes('item.path | relative_url'),
  'sidebar: appendices must be rendered from navigation paths');
expect(pageNavigation.includes('introduction,chapters,additional,resources,appendices,afterword') &&
  pageNavigation.includes('class="nav-prev"') && pageNavigation.includes('class="nav-next"'),
  'page navigation: appendices must participate in prev/next rendering');

const markdownFiles = walkMarkdown('docs');
const markdown = markdownFiles.map(function (file) { return [file, read(file)]; });
const allMarkdown = markdown.map(function (pair) { return pair[1]; }).join('\n');
const actualAnchors = Array.from(allMarkdown.matchAll(/id="(figure-[a-z0-9-]+)"/g),
  function (match) { return match[1]; });
expect(actualAnchors.length === figures.length,
  'public source must contain exactly ' + figures.length + ' figure anchors');
expect(new Set(actualAnchors).size === actualAnchors.length,
  'public source contains duplicate figure anchors');

const refPattern = /\/assets\/images\/figures\/([a-z0-9-]+\.svg)/g;
const actualRefs = Array.from(allMarkdown.matchAll(refPattern), function (match) { return match[1]; });
expect(actualRefs.length === figures.length,
  'public source must contain exactly ' + figures.length + ' figure asset references');
expect(new Set(actualRefs).size === actualRefs.length,
  'public source contains duplicate figure asset references');
expect(count(allMarkdown, 'class="figure-text-alternative"') === figures.length,
  'public source must contain exactly ' + figures.length + ' text alternatives');

const globalLabelIds = [];
for (const figure of figures) {
  const source = read(figure.source);
  expect(!source.includes('/incident-response-basics-book/'),
    figure.source + ': hard-coded GitHub Pages baseurl is forbidden');
  expect(count(source, 'id="' + figure.anchor + '"') === 1,
    figure.source + ': missing stable anchor ' + figure.anchor);
  expect(count(source, '/assets/images/figures/' + figure.asset) === 1,
    figure.source + ': missing one asset reference ' + figure.asset);
  const blockPattern = new RegExp('<figure\\b[^>]*\\sid="' + figure.anchor + '"[^>]*>[\\s\\S]*?<\\/figure>\\s*<p class="figure-text-alternative">[^<]{30,}<\\/p>');
  const blockMatch = source.match(blockPattern);
  expect(Boolean(blockMatch),
    figure.source + ': figure, caption and immediate text alternative are required for ' + figure.anchor);
  if (blockMatch) {
    expect(/alt="[^"]{20,}"/.test(blockMatch[0]),
      figure.source + ': meaningful alt is required for ' + figure.anchor);
    expect(blockMatch[0].includes('<figcaption>'),
      figure.source + ': caption is required for ' + figure.anchor);
    expect(blockMatch[0].includes('loading="lazy"'),
      figure.source + ': lazy loading is required for ' + figure.anchor);
  }
  expect(count(index, 'href="' + figure.indexHref + '"') === 1,
    'figure index: missing one relative deep link for ' + figure.anchor);

  const svgPath = 'docs/assets/images/figures/' + figure.asset;
  const svg = read(svgPath);
  const role = openingTagAttribute(svg, 'svg', 'role');
  const labelled = openingTagAttribute(svg, 'svg', 'aria-labelledby');
  expect(role === 'img' && labelled !== null, svgPath + ': root svg role=img and aria-labelledby are required');
  if (labelled !== null) {
    const ids = labelled.trim().split(/\s+/);
    expect(ids.length === 2, svgPath + ': aria-labelledby must reference title and desc');
    expect(new Set(ids).size === ids.length, svgPath + ': title and desc ids must differ');
    expect(svg.includes('<title id="' + ids[0] + '">'), svgPath + ': labelled title is missing');
    expect(svg.includes('<desc id="' + ids[1] + '">'), svgPath + ': labelled desc is missing');
    globalLabelIds.push.apply(globalLabelIds, ids);
  }
  const svgWithoutNamespace = svg.replace('http://www.w3.org/2000/svg', '');
  const nonFragmentHref = /\s(?:href|xlink:href)\s*=\s*(["'])(?!#)[^"']*\1/i.test(svgWithoutNamespace);
  expect(!/<script\b|<foreignObject\b|<image\b|\son[a-z]+\s*=|(?:https?:)?\/\//i.test(svgWithoutNamespace) &&
    !nonFragmentHref,
    svgPath + ': scripts, external resources, event handlers and embedded images are forbidden');
}
expect(new Set(globalLabelIds).size === globalLabelIds.length,
  'SVG title and desc ids must be unique across the figure inventory');

const assetDir = path.join(ROOT, 'docs/assets/images/figures');
let actualAssets = [];
try {
  actualAssets = fs.readdirSync(assetDir).filter(function (name) {
    return name.endsWith('.svg');
  }).sort();
} catch (error) {
  errors.push('docs/assets/images/figures: cannot list (' + error.message + ')');
}
const expectedAssets = figures.map(function (figure) { return figure.asset; }).sort();
expect(JSON.stringify(actualAssets) === JSON.stringify(expectedAssets),
  'figure assets must match exact inventory; expected ' + JSON.stringify(expectedAssets) +
  ', got ' + JSON.stringify(actualAssets));
expect(JSON.stringify(actualRefs.slice().sort()) === JSON.stringify(expectedAssets),
  'figure references must match exact asset inventory');

let pkg = {};
const packageText = read('package.json');
if (packageText) {
  try {
    pkg = JSON.parse(packageText);
  } catch (error) {
    errors.push('package.json: invalid JSON (' + error.message + ')');
  }
}
expect(pkg.scripts && pkg.scripts['check:reader-ux'] === 'node scripts/check-reader-ux.js',
  'package.json: check:reader-ux script is missing');
expect(pkg.scripts && pkg.scripts['check:reader-ux-regression'] === 'node scripts/check-reader-ux-regression.js',
  'package.json: check:reader-ux-regression script is missing');
const testCommands = pkg.scripts ? String(pkg.scripts.test || '').split('&&').map(function (command) {
  return command.trim();
}) : [];
expect(testCommands.includes('npm run check:reader-ux') &&
  testCommands.includes('npm run check:reader-ux-regression'),
  'package.json: npm test must run both reader UX checks');

if (errors.length) {
  console.error('Reader UX check failed:');
  for (const error of errors) console.error('- ' + error);
  process.exit(1);
}
console.log('Reader UX check passed: ' + figures.length + ' incident-response figures, text alternatives, anchors and index entries.');
