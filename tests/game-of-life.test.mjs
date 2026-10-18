import assert from 'node:assert/strict';
import test from 'node:test';
import { blogSchema } from '../src/lib/blog-schema.ts';
import { compileGame, getLevel, SKILLS } from '../src/lib/game-of-life.ts';

function post(id, published, metadata = {}) {
  return {
    id,
    data: blogSchema.parse({
      title: id, description: 'Test activity', category: 'Game of Life',
      published, skill: ['computers'], exp: 60, ...metadata,
    }),
  };
}

test('level zero, exact thresholds, increasing costs, and XP carry-over', () => {
  assert.deepEqual(getLevel(0), { level: 0, totalXP: 0, earned: 0, required: 120 });
  assert.equal(getLevel(119.999).level, 0);
  assert.deepEqual(getLevel(120), { level: 1, totalXP: 120, earned: 0, required: 120 * 2 ** 1.5 });
  assert.equal(getLevel(150).earned, 30);
  let threshold = 0;
  for (let level = 1; level <= 20; level++) {
    threshold += 120 * level ** 1.5;
    assert.equal(getLevel(threshold - 0.001).level, level - 1);
    assert.equal(getLevel(threshold).level, level);
    assert.equal(getLevel(threshold).earned, 0);
    assert.equal(getLevel(threshold + 0.5).earned, 0.5);
    assert.equal(getLevel(threshold).required, 120 * (level + 1) ** 1.5);
  }
  for (const value of [-1, NaN, Infinity]) assert.throws(() => getLevel(value), /finite, non-negative/);
});

test('empty challenge includes exactly 100 UTC dates and six zero-XP skills', () => {
  const game = compileGame([]);
  assert.equal(game.days.length, 100);
  assert.equal(game.days[0].date, '2026-10-19');
  assert.equal(game.days[99].date, '2027-01-26');
  assert.equal(game.loggedDays, 0);
  assert.deepEqual(Object.keys(game.totals), SKILLS);
  assert.ok(Object.values(game.totals).every((xp) => xp === 0));
  assert.ok(game.days.every((day) => !day.postId && day.daily.length === 0));
});

test('each listed skill receives the full XP; gaps retain cumulative XP', () => {
  const game = compileGame([
    post('second', '2026-10-21', { exp: 80.5, daily: ['sport'] }),
    post('first', '2026-10-19', { skill: ['computers', 'crafting'], exp: 120, daily: ['cooking', 'reading'] }),
  ]);
  assert.equal(game.loggedDays, 2);
  assert.equal(game.totals.computers, 200.5);
  assert.equal(game.totals.crafting, 120);
  assert.equal(game.totals.exploration, 0);
  assert.equal(game.days[0].cumulative.computers, 120);
  assert.equal(game.days[1].exp.computers, 0);
  assert.equal(game.days[1].cumulative.computers, 120);
  assert.equal(game.days[2].cumulative.computers, 200.5);
  assert.equal(game.days[99].cumulative.computers, 200.5);
  assert.deepEqual(game.days[0].daily, ['cooking', 'reading']);
  assert.deepEqual(game.days[1].daily, []);
  assert.notEqual(game.days[0].cumulative, game.days[1].cumulative);
  assert.deepEqual(game.posts.map(({ id }) => id), ['second', 'first']);
});

test('only inclusive challenge dates count, but outside-window posts remain listed', () => {
  const game = compileGame([
    post('before', '2026-10-18', { exp: 500 }),
    post('first', '2026-10-19'),
    post('last', '2027-01-26', { daily: ['cleaning'] }),
    post('after', '2027-01-27', { exp: 500 }),
    post('draft', '2026-10-20', { draft: true, exp: 500 }),
    post('other-category', '2026-10-21', { category: 'Notes', exp: 500 }),
  ]);
  assert.equal(game.totals.computers, 120);
  assert.equal(game.loggedDays, 2);
  assert.deepEqual(game.days[99].daily, ['cleaning']);
  assert.deepEqual(game.posts.map(({ id }) => id), ['after', 'last', 'first', 'before']);
});

test('dates are grouped in UTC and duplicate daily posts fail explicitly', () => {
  const entry = post('utc-first', '2026-10-18T23:30:00-02:00');
  assert.equal(compileGame([entry]).days[0].postId, 'utc-first');
  assert.throws(
    () => compileGame([entry, post('duplicate', '2026-10-19T12:00:00Z')]),
    /"duplicate" and "utc-first" both use 2026-10-19/,
  );
  assert.equal(compileGame([entry, post('draft', '2026-10-19', { draft: true })]).loggedDays, 1);
});

test('existing posts, skill-only, daily-only, zero XP, and all activities are valid', () => {
  assert.equal(blogSchema.parse({ title: 'Note', description: 'Note', published: '2026-10-19' }).category, 'Notes');
  assert.equal(post('skills', '2026-10-19', { exp: 0 }).data.exp, 0);
  const daily = post('daily', '2026-10-19', {
    skill: undefined, exp: undefined, daily: ['sport', 'cooking', 'cleaning', 'reading'],
  });
  const game = compileGame([daily]);
  assert.equal(game.days[0].daily.length, 4);
  assert.equal(game.totals.computers, 0);
  assert.equal(game.loggedDays, 1);
  assert.equal(post('all-skills', '2026-10-19', { skill: [...SKILLS] }).data.skill.length, 6);
});

test('invalid metadata fails instead of silently discarding activities', () => {
  for (const metadata of [
    { skill: ['unknown'] }, { skill: 'computers' }, { skill: [] },
    { skill: ['computers', 'computers'] }, { exp: -1 }, { exp: '60' },
    { exp: Infinity }, { exp: NaN }, { exp: undefined },
    { skill: undefined }, { daily: ['sleeping'] }, { daily: 'sport' },
    { daily: [] }, { daily: ['sport', 'sport'] },
    { skill: undefined, exp: undefined },
    { published: 'not-a-date' },
  ]) {
    assert.throws(() => post('invalid', '2026-10-19', metadata));
  }
});
