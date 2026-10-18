export const SKILLS = [
  'homesteading', 'exploration', 'computers', 'teaching', 'chronicling', 'crafting',
] as const;
export const DAILIES = ['sport', 'cooking', 'cleaning', 'reading'] as const;
export const GAME_CATEGORY = 'Game of Life';
export const START_DATE = '2026-10-19';
export const DAY_COUNT = 100;
const DAY_MS = 86_400_000;
const START_TIME = Date.parse(`${START_DATE}T00:00:00Z`);

export type Skill = typeof SKILLS[number];
export type Daily = typeof DAILIES[number];
export type SkillXP = Record<Skill, number>;

interface GamePost {
  id: string;
  data: {
    category: string;
    published: Date;
    draft?: boolean;
    skill?: Skill[];
    exp?: number;
    daily?: Daily[];
  };
}

export interface GameDay {
  date: string;
  postId?: string;
  exp: SkillXP;
  cumulative: SkillXP;
  daily: Daily[];
}

function emptyXP(): SkillXP {
  return {
    homesteading: 0, exploration: 0, computers: 0,
    teaching: 0, chronicling: 0, crafting: 0,
  };
}

export function getLevel(totalXP: number) {
  if (!Number.isFinite(totalXP) || totalXP < 0) {
    throw new Error('Skill XP must be a finite, non-negative number.');
  }
  let level = 0;
  let spent = 0;
  let required = 120;
  while (totalXP >= spent + required) {
    spent += required;
    level += 1;
    required = 120 * (level + 1) ** 1.5;
  }
  return { level, totalXP, earned: totalXP - spent, required };
}

export function compileGame<T extends GamePost>(entries: T[]) {
  const posts = entries
    .filter(({ data }) => data.category === GAME_CATEGORY && !data.draft)
    .sort((a, b) => b.data.published.valueOf() - a.data.published.valueOf() || a.id.localeCompare(b.id));
  const byDate = new Map<string, T>();
  for (const post of posts) {
    const date = post.data.published.toISOString().slice(0, 10);
    const previous = byDate.get(date);
    if (previous) {
      throw new Error(`Only one Game of Life post is allowed per UTC day: "${previous.id}" and "${post.id}" both use ${date}.`);
    }
    byDate.set(date, post);
  }

  const totals = emptyXP();
  const days: GameDay[] = Array.from({ length: DAY_COUNT }, (_, index) => {
    const date = new Date(START_TIME + index * DAY_MS).toISOString().slice(0, 10);
    const post = byDate.get(date);
    const exp = emptyXP();
    if (post) {
      for (const skill of post.data.skill ?? []) {
        const amount = post.data.exp;
        if (amount === undefined || !Number.isFinite(amount) || amount < 0) {
          throw new Error(`"${post.id}" must supply finite, non-negative exp for its skills.`);
        }
        exp[skill] = amount;
        totals[skill] += amount;
        if (!Number.isFinite(totals[skill])) {
          throw new Error(`Total XP for ${skill} exceeds the supported numeric range.`);
        }
      }
    }
    return {
      date, postId: post?.id, exp, cumulative: { ...totals },
      daily: post?.data.daily ?? [],
    };
  });

  return {
    posts,
    days,
    totals,
    loggedDays: days.filter((day) => day.postId !== undefined).length,
  };
}
