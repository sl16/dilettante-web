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

function postLinks(html) {
  return [...html.matchAll(/<a href="([^"]+)" class="card-link"/g)].map((match) => match[1]);
}

async function builtPosts() {
  const blogDirectory = path.join(dist, 'blog');
  const files = (await htmlFiles(blogDirectory)).filter((file) => file !== path.join(blogDirectory, 'index.html'));
  const posts = await Promise.all(files.map(async (file) => {
    const html = await readFile(file, 'utf8');
    const header = html.match(/<main\b[^>]*>.*?<header\b[^>]*>(.*?)<\/header>/s)?.[1];
    const datetime = header?.match(/<time\b[^>]*datetime="([^"]+)"/)?.[1];
    assert.ok(datetime, `${file}: post must have a publication date`);
    const published = Date.parse(datetime);
    assert.ok(Number.isFinite(published), `${file}: invalid publication date`);
    const id = path.relative(blogDirectory, file).split(path.sep).join('/').replace(/\/index\.html$/, '');
    return { id, href: `${base}/blog/${id}/`, published, html };
  }));
  return posts.sort((a, b) => b.published - a.published || a.id.localeCompare(b.id));
}

test('all generated internal links and assets exist under the deployment base', async () => {
  const files = await htmlFiles(dist);
  for (const route of ['index.html', 'blog/index.html', 'game-of-life/index.html', '404.html']) {
    await stat(path.join(dist, route));
  }
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

test('pages ship no JavaScript', async () => {
  for (const route of ['index.html', 'blog/index.html', 'game-of-life/index.html']) {
    assert.doesNotMatch(await readFile(path.join(dist, route), 'utf8'), /<script\b/);
  }
  for (const post of await builtPosts()) {
    assert.doesNotMatch(post.html, /<script\b/);
  }
});

test('blog lists all built posts newest first and canonical URLs include the base', async () => {
  const html = await readFile(path.join(dist, 'blog/index.html'), 'utf8');
  const posts = await builtPosts();
  assert.deepEqual(postLinks(html), posts.map((post) => post.href));
  const canonical = html.match(/rel="canonical" href="([^"]+)"/)?.[1];
  assert.ok(canonical, 'Blog must have a canonical URL');
  const url = new URL(canonical);
  assert.equal(url.pathname, `${base}/blog/`);
});

test('homepage contains a hero and up to three newest blog cards', async () => {
  const html = await readFile(path.join(dist, 'index.html'), 'utf8');
  const hero = html.match(/<section\b[^>]*class="home-hero"[^>]*>(.*?)<\/section>/s)?.[1];
  assert.ok(hero, 'Homepage must have a hero section');
  assert.match(hero, /<h1\b[^>]*>[^<]+<\/h1>/);
  assert.equal([...html.matchAll(/<section\b/g)].length, 2);
  const posts = (await builtPosts()).slice(0, 3);
  assert.equal([...html.matchAll(/<article\b/g)].length, posts.length);
  assert.deepEqual(postLinks(html), posts.map((post) => post.href));
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
  assert.match(main, /^\s*<section\b[^>]*>\s*<h1\b[^>]*>[^<]+<\/h1>\s*<\/section>\s*$/);
});
