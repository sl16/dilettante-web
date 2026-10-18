import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

const execute = promisify(execFile);
const root = path.resolve('.');

test('a real build derives levels, chart points, heatmap, and journal from frontmatter', { timeout: 120_000 }, async () => {
  const fixture = await mkdtemp(path.join(tmpdir(), 'dilettante-game-test-'));
  try {
    await Promise.all([
      cp(path.join(root, 'src'), path.join(fixture, 'src'), {
        recursive: true,
        filter: (source) => source !== path.join(root, 'src/content'),
      }),
      ...['astro.config.mjs', 'package.json', 'tsconfig.json', 'public'].map((file) =>
        cp(path.join(root, file), path.join(fixture, file), { recursive: true })),
      symlink(path.join(root, 'node_modules'), path.join(fixture, 'node_modules'), 'dir'),
    ]);
    const content = path.join(fixture, 'src/content/blog');
    await mkdir(content, { recursive: true });
    const entries = [
      { id: 'before', published: '2026-10-18', skill: ['computers'], exp: 900 },
      { id: 'first', published: '2026-10-19', skill: ['computers', 'crafting'], exp: 120, daily: ['cooking', 'reading'] },
      { id: 'draft', published: '2026-10-20', skill: ['computers'], exp: 900, draft: true },
      { id: 'third', published: '2026-10-21', skill: ['computers'], exp: 400, daily: ['sport', 'cooking', 'cleaning', 'reading'] },
      { id: 'last', published: '2027-01-26', daily: ['cleaning'] },
      { id: 'after', published: '2027-01-27', skill: ['computers'], exp: 900 },
      { id: 'ordinary', published: '2026-10-22', category: 'Notes' },
    ];
    await Promise.all(entries.map(({ id, ...data }) => {
      const metadata = { title: id, description: 'Integration test', category: 'Game of Life', ...data };
      const frontmatter = Object.entries(metadata).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join('\n');
      return writeFile(path.join(content, `${id}.md`), `---\n${frontmatter}\n---\n\nA test entry.\n`);
    }));

    const build = () => execute('npm', ['run', 'build'], {
      cwd: fixture,
      env: { ...process.env, BASE_PATH: '/challenge-test', ASTRO_TELEMETRY_DISABLED: '1' },
      timeout: 45_000,
      maxBuffer: 2 * 1024 * 1024,
    }).catch((error) => {
      throw new Error(`Fixture build failed:\n${error.stdout}\n${error.stderr}`, { cause: error });
    });
    await build();
    const html = await readFile(path.join(fixture, 'dist/game-of-life/index.html'), 'utf8');
    assert.match(html, /data-skill="computers" data-level="2" data-xp="520"/);
    assert.match(html, /data-skill="crafting" data-level="1" data-xp="120"/);
    assert.match(html, /data-skill="homesteading" data-level="0" data-xp="0"/);
    assert.match(html, /<strong[^>]*>3<\/strong> \/ 100 days logged/);
    assert.doesNotMatch(html, /<script\b/);
    const bars = [...html.matchAll(/<meter\b[^>]*id="level-([^"]+)"[^>]*max="([^"]+)"[^>]*value="([^"]+)"/g)];
    assert.equal(bars.length, 6);
    assert.ok(bars.every((match) => match[2] === '3'));
    assert.equal(Number(bars.find((match) => match[1] === 'computers')[3]), 2 + (520 - 120 - 120 * 2 ** 1.5) / (120 * 3 ** 1.5));
    assert.equal(Number(bars.find((match) => match[1] === 'crafting')[3]), 1);
    assert.equal(Number(bars.find((match) => match[1] === 'homesteading')[3]), 0);

    const points = html.match(/<polyline\b[^>]*data-skill="computers"[^>]*points="([^"]+)"/)?.[1]
      .trim().split(/\s+/).map((pair) => pair.split(',').map(Number));
    assert.equal(points?.length, 100);
    assert.equal(points[0][0], 76);
    assert.equal(points[0][1], 252 - 120 / 520 * 224);
    assert.equal(points[1][1], points[0][1]);
    assert.equal(points[2][1], 28);
    assert.deepEqual(points[99], [952, 28]);

    const cells = [...html.matchAll(/<li\b[^>]*data-date="([^"]+)"[^>]*data-daily-count="(\d)"[^>]*>(.*?)<\/li>/gs)];
    assert.equal(cells.length, 100);
    assert.equal(cells[0][2], '2');
    assert.match(cells[0][3], /href="\/challenge-test\/blog\/first\/"/);
    assert.equal(cells[1][2], '0');
    assert.doesNotMatch(cells[1][3], /<a\b/);
    assert.equal(cells[2][2], '4');
    assert.equal(cells[99][2], '1');
    assert.match(cells[99][3], /href="\/challenge-test\/blog\/last\/"/);
    const links = [...html.matchAll(/<a href="([^"]+)" class="card-link"/g)].map((match) => match[1]);
    assert.deepEqual(links, ['after', 'last', 'third', 'first', 'before'].map((id) => `/challenge-test/blog/${id}/`));

    await writeFile(path.join(content, 'fourth.md'), '---\ntitle: Fourth\ndescription: A new entry\npublished: 2026-10-22\ncategory: Game of Life\nskill: [computers]\nexp: 30\ndaily: [sport]\n---\n');
    await build();
    const updated = await readFile(path.join(fixture, 'dist/game-of-life/index.html'), 'utf8');
    assert.match(updated, /data-skill="computers" data-level="2" data-xp="550"/);
    assert.match(updated, /<strong[^>]*>4<\/strong> \/ 100 days logged/);
    assert.match(updated, /data-date="2026-10-22" data-daily-count="1"/);
    assert.match(updated, /href="\/challenge-test\/blog\/fourth\/" class="card-link"/);

    await writeFile(path.join(content, 'duplicate.md'), '---\ntitle: Duplicate\ndescription: Duplicate date\npublished: 2026-10-19\ncategory: Game of Life\ndaily: [sport]\n---\n');
    await assert.rejects(build(), /Only one Game of Life post is allowed per UTC day/);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});
