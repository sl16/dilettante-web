import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const dist = path.resolve('dist');
const [owner, repository] = (process.env.GITHUB_REPOSITORY ?? 'sl16/dilettante-web').split('/');
const base = (process.env.BASE_PATH ?? (
  repository.toLowerCase() === `${owner.toLowerCase()}.github.io` ? '' : `/${repository}`
)).replace(/\/$/, '');

async function htmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? htmlFiles(fullPath) : entry.name.endsWith('.html') ? [fullPath] : [];
  }));
  return files.flat();
}

test('all generated internal links and assets exist under the deployment base', async () => {
  const files = await htmlFiles(dist);
  assert.ok(files.length >= 7, 'Expected home, blog, posts, Game of Life, and 404 pages');
  for (const file of files) {
    const html = await readFile(file, 'utf8');
    assert.match(html, /<html lang="en">/);
    assert.match(html, /<h1[\s>]/);
    for (const [, value] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      if (!value.startsWith('/') || value.startsWith('//')) continue;
      const pathname = value.split(/[?#]/)[0];
      assert.ok(pathname.startsWith(`${base}/`), `${file}: ${value} escapes base ${base}`);
      const relative = decodeURIComponent(pathname.slice(base.length + 1));
      const target = path.join(dist, relative);
      const info = await stat(target);
      if (info.isDirectory()) await stat(path.join(target, 'index.html'));
    }
  }
});

test('ordinary pages ship no JavaScript; widget pages include their isolated script', async () => {
  for (const route of ['index.html', 'blog/index.html', 'game-of-life/index.html']) {
    assert.doesNotMatch(await readFile(path.join(dist, route), 'utf8'), /<script\b/);
  }
  for (const route of ['blog/small-tools-small-joys/index.html']) {
    const html = await readFile(path.join(dist, route), 'utf8');
    assert.match(html, /<writing-desk\b/);
    assert.match(html, /<script\b[^>]*type="module"/);
  }
});

test('blog lists all sample posts newest first and canonical URLs include the base', async () => {
  const html = await readFile(path.join(dist, 'blog/index.html'), 'utf8');
  const titles = ['The case for being a beginner', 'A smaller, quieter web', 'Small tools, small joys'];
  const positions = titles.map((title) => html.indexOf(title));
  assert.ok(positions.every((position) => position >= 0));
  assert.ok(positions[0] < positions[1] && positions[1] < positions[2]);
  const canonical = html.match(/rel="canonical" href="([^"]+)"/)?.[1];
  assert.ok(canonical, 'Blog must have a canonical URL');
  const url = new URL(canonical);
  assert.equal(url.pathname, `${base}/blog/`);
});

test('homepage contains only the requested hero and the three newest blog cards', async () => {
  const html = await readFile(path.join(dist, 'index.html'), 'utf8');
  assert.match(html, /<h1[^>]*>dilettante<\/h1>/);
  assert.match(html, /href="https:\/\/dictionary.cambridge.org\/dictionary\/english\/dilettante">a person whose interest in an art or in an area of knowledge is not very deep or serious<\/a>/);
  assert.ok(html.includes("Yup. That's me. Welcome."));
  assert.doesNotMatch(html, /<footer\b|<svg\b|Journal|playground|A few things on my mind/);
  assert.equal([...html.matchAll(/<section\b/g)].length, 2);
  assert.equal([...html.matchAll(/<article\b/g)].length, 3);
  const blog = await readFile(path.join(dist, 'blog/index.html'), 'utf8');
  const postLinks = (content) => [...content.matchAll(/<a href="([^"]+)" class="card-link"/g)].map((match) => match[1]);
  assert.deepEqual(postLinks(html), postLinks(blog).slice(0, 3));
});

test('navigation has only Blog and Game of Life, with no old pages', async () => {
  const html = await readFile(path.join(dist, 'index.html'), 'utf8');
  const nav = html.match(/<nav\b[^>]*>(.*?)<\/nav>/s)?.[1];
  assert.ok(nav);
  assert.deepEqual([...nav.matchAll(/href="([^"]+)"/g)].map((match) => match[1]), [
    `${base}/blog/`, `${base}/game-of-life/`,
  ]);
  for (const route of ['about', 'tools']) {
    await assert.rejects(stat(path.join(dist, route)), { code: 'ENOENT' });
  }
  const game = await readFile(path.join(dist, 'game-of-life/index.html'), 'utf8');
  const main = game.match(/<main\b[^>]*>(.*?)<\/main>/s)?.[1];
  assert.ok(main);
  assert.equal(main.replace(/<[^>]*>/g, '').trim(), 'Game of Life');
});
