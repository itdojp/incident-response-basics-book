#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const errors = [];

function fail(message) {
  errors.push(message);
}

function repoPath(...segments) {
  return path.join(ROOT, ...segments);
}

function readText(relativePath) {
  try {
    return fs.readFileSync(repoPath(relativePath), 'utf8');
  } catch (error) {
    fail(`${relativePath}: failed to read (${error.message})`);
    return null;
  }
}

function readJson(relativePath) {
  const text = readText(relativePath);
  if (text === null) return {};
  try {
    return JSON.parse(text);
  } catch (error) {
    fail(`${relativePath}: invalid JSON (${error.message})`);
    return {};
  }
}

function normalizeScalar(value) {
  if (value === undefined || value === null) return undefined;
  let normalized = String(value).trim();
  if (normalized.includes(' #')) {
    normalized = normalized.split(' #', 1)[0].trim();
  }
  if (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    normalized = normalized.slice(1, -1);
  }
  return normalized;
}

function parseTopLevelYaml(relativePath) {
  const text = readText(relativePath);
  if (text === null) return {};
  const data = {};
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (match) {
      data[match[1]] = normalizeScalar(match[2]) || '';
    }
  }
  return data;
}

function parseFrontMatter(relativePath) {
  const text = readText(relativePath);
  if (text === null) return { data: {}, body: '' };
  if (!text.startsWith('---\n')) {
    fail(`${relativePath}: missing YAML front matter`);
    return { data: {}, body: text };
  }
  const end = text.indexOf('\n---', 4);
  if (end === -1) {
    fail(`${relativePath}: missing closing YAML front matter delimiter`);
    return { data: {}, body: text };
  }
  const raw = text.slice(4, end);
  const data = {};
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (match) {
      data[match[1]] = normalizeScalar(match[2]) || '';
    }
  }
  return { data, body: text.slice(end + '\n---'.length) };
}

function parseNavigation(relativePath) {
  const text = readText(relativePath);
  if (text === null) return {};
  const nav = {};
  let current = null;
  for (const line of text.split(/\r?\n/)) {
    const section = line.match(/^([A-Za-z0-9_-]+):\s*$/);
    if (section) {
      current = section[1];
      if (!nav[current]) nav[current] = [];
      continue;
    }
    const title = line.match(/^\s*-\s*title:\s*(.+?)\s*$/);
    if (current && title) {
      nav[current].push({ title: normalizeScalar(title[1]) || '', path: '' });
      continue;
    }
    const pathMatch = line.match(/^\s*path:\s*(.+?)\s*$/);
    if (current && pathMatch) {
      if (!nav[current].length) nav[current].push({ title: '', path: '' });
      nav[current][nav[current].length - 1].path = normalizeScalar(pathMatch[1]) || '';
    }
  }
  return nav;
}

function expectEqual(label, actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function requireString(source, value) {
  if (typeof value !== 'string' || !value.trim()) {
    fail(`${source}: expected non-empty string`);
    return '';
  }
  return value.trim();
}

function normalizeRepoUrl(value) {
  const raw = requireString('repository URL', value);
  return raw.replace(/\.git$/, '').replace(/\/$/, '');
}

function expectedFromBookConfig(bookConfig) {
  const repoUrl = normalizeRepoUrl(bookConfig.repository);
  const repoMatch = repoUrl.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)$/);
  if (!repoMatch) {
    fail('book-config.json repository: expected https://github.com/<owner>/<repo>');
  }
  const owner = repoMatch ? repoMatch[1] : '';
  const repoName = repoMatch ? repoMatch[2] : '';
  const siteUrl = owner ? `https://${owner}.github.io` : '';

  return {
    title: requireString('book-config.json title', bookConfig.title),
    description: requireString('book-config.json description', bookConfig.description),
    author: requireString('book-config.json author', bookConfig.author),
    version: requireString('book-config.json version', bookConfig.version),
    license: requireString('book-config.json license', bookConfig.license),
    repoUrl,
    repository: repoUrl,
    packageRepoUrl: `${repoUrl}.git`,
    repoSlug: owner && repoName ? `${owner}/${repoName}` : '',
    pagesUrl: siteUrl && repoName ? `${siteUrl}/${repoName}/` : '',
    siteUrl,
    baseurl: repoName ? `/${repoName}` : '',
    lang: 'ja'
  };
}

function expectedStructure(bookConfig) {
  const structure = bookConfig.structure || {};
  const chapters = Array.isArray(structure.chapters) ? structure.chapters : [];
  const appendices = Array.isArray(structure.appendices) ? structure.appendices : [];
  if (!Array.isArray(structure.chapters)) fail('book-config.json structure.chapters: expected array');
  if (!Array.isArray(structure.appendices)) fail('book-config.json structure.appendices: expected array');
  return {
    chapters: chapters.map((chapter, index) => ({
      id: requireString(`book-config.json structure.chapters[${index}].id`, chapter.id),
      title: requireString(`book-config.json structure.chapters[${index}].title`, chapter.title),
      path: `/chapters/${chapter.id}/`,
      relative: `chapters/${chapter.id}/`,
      file: `docs/chapters/${chapter.id}/index.md`,
      order: (index + 1) * 10
    })),
    appendices: appendices.map((appendix, index) => ({
      id: requireString(`book-config.json structure.appendices[${index}].id`, appendix.id),
      title: requireString(`book-config.json structure.appendices[${index}].title`, appendix.title),
      path: `/appendices/${appendix.id}/`,
      relative: `appendices/${appendix.id}/`,
      file: `docs/appendices/${appendix.id}/index.md`,
      order: 900 + index * 10
    }))
  };
}

function validatePackage(expected) {
  const pkg = readJson('package.json');
  expectEqual('package.json name', pkg.name, 'incident-response-basics-book');
  expectEqual('package.json version', pkg.version, expected.version);
  expectEqual('package.json description', pkg.description, expected.description);
  expectEqual('package.json license', pkg.license, expected.license);
  expectEqual('package.json repository.type', pkg.repository && pkg.repository.type, 'git');
  expectEqual('package.json repository.url', normalizeRepoUrl(pkg.repository && pkg.repository.url), expected.repository);
  expectEqual('package.json homepage', pkg.homepage, expected.pagesUrl);
  expectEqual('package.json bugs.url', pkg.bugs && pkg.bugs.url, `${expected.repository}/issues`);
  expectEqual('package.json scripts.check:metadata', pkg.scripts && pkg.scripts['check:metadata'], 'node scripts/check-metadata-consistency.js');
  if (!String((pkg.scripts && pkg.scripts.test) || '').includes('npm run check:metadata')) {
    fail('package.json scripts.test: expected to run npm run check:metadata');
  }
}

function validateJekyllConfig(relativePath, expected) {
  const cfg = parseTopLevelYaml(relativePath);
  expectEqual(`${relativePath} title`, cfg.title, expected.title);
  expectEqual(`${relativePath} description`, cfg.description, expected.description);
  expectEqual(`${relativePath} author`, cfg.author, expected.author);
  expectEqual(`${relativePath} lang`, cfg.lang, expected.lang);
  expectEqual(`${relativePath} version`, cfg.version, expected.version);
  expectEqual(`${relativePath} url`, cfg.url, expected.siteUrl);
  expectEqual(`${relativePath} baseurl`, cfg.baseurl, expected.baseurl);
  expectEqual(`${relativePath} repository`, normalizeRepoUrl(cfg.repository), expected.repository);
}

function validateIndex(expected, structure) {
  const { data, body } = parseFrontMatter('docs/index.md');
  expectEqual('docs/index.md front matter layout', data.layout, 'book');
  expectEqual('docs/index.md front matter title', data.title, expected.title);
  expectEqual('docs/index.md front matter description', data.description, expected.description);
  expectEqual('docs/index.md front matter author', data.author, expected.author);
  expectEqual('docs/index.md front matter version', data.version, expected.version);
  expectEqual('docs/index.md front matter permalink', data.permalink, '/');
  if (!body.includes(expected.description)) {
    fail('docs/index.md body: missing canonical description');
  }
  for (const item of [...structure.chapters, ...structure.appendices]) {
    if (!body.includes(`](${item.relative})`)) {
      fail(`docs/index.md ToC: missing link target ${item.relative}`);
    }
  }
}

function validateNavigation(structure) {
  const nav = parseNavigation('docs/_data/navigation.yml');
  for (const section of ['chapters', 'appendices']) {
    const expectedItems = structure[section].map(({ title, path: navPath }) => ({ title, path: navPath }));
    expectEqual(`docs/_data/navigation.yml ${section}`, nav[section] || [], expectedItems);
  }
  const allPaths = Object.values(nav).flat().map((item) => item.path).filter(Boolean);
  const duplicates = [...new Set(allPaths.filter((navPath, index) => allPaths.indexOf(navPath) !== index))].sort();
  if (duplicates.length > 0) {
    fail(`docs/_data/navigation.yml duplicate paths: ${JSON.stringify(duplicates)}`);
  }
}

function validatePages(structure) {
  for (const item of [...structure.chapters, ...structure.appendices]) {
    if (!fs.existsSync(repoPath(item.file))) {
      fail(`${item.path}: missing ${item.file}`);
      continue;
    }
    const { data } = parseFrontMatter(item.file);
    expectEqual(`${item.file} front matter title`, data.title, item.title);
    expectEqual(`${item.file} front matter layout`, data.layout, 'book');
    expectEqual(`${item.file} front matter order`, Number(data.order), item.order);
  }
}

function validateReadme(expected) {
  const readme = readText('README.md') || '';
  const compact = readme.replace(/\s+/g, '');
  const markers = [
    expected.title,
    expected.description,
    expected.pagesUrl,
    'npm run check:metadata',
    'npm test',
    expected.license.replace(/-/g, '').replace(/\s+/g, '')
  ];
  for (const marker of markers) {
    const normalizedMarker = marker === expected.license.replace(/-/g, '').replace(/\s+/g, '')
      ? marker
      : null;
    if (normalizedMarker) {
      if (!compact.replace(/-/g, '').includes(normalizedMarker)) {
        fail(`README.md: missing marker ${JSON.stringify(marker)}`);
      }
    } else if (!readme.includes(marker)) {
      fail(`README.md: missing marker ${JSON.stringify(marker)}`);
    }
  }
}

function main() {
  const bookConfig = readJson('book-config.json');
  const expected = expectedFromBookConfig(bookConfig);
  const structure = expectedStructure(bookConfig);
  validatePackage(expected);
  validateJekyllConfig('_config.yml', expected);
  validateJekyllConfig('docs/_config.yml', expected);
  validateIndex(expected, structure);
  validateNavigation(structure);
  validatePages(structure);
  validateReadme(expected);

  if (errors.length > 0) {
    console.error('Metadata consistency check failed:');
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log('Metadata consistency check passed.');
}

main();
