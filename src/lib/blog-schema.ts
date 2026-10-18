import { z } from 'astro/zod';
import { DAILIES, GAME_CATEGORY, SKILLS } from './game-of-life.ts';

export const blogSchema = z.object({
  title: z.string(),
  description: z.string(),
  published: z.coerce.date(),
  category: z.string().default('Notes'),
  draft: z.boolean().default(false),
  skill: z.array(z.enum(SKILLS)).min(1).refine(
    (values) => new Set(values).size === values.length,
    'List each skill only once.',
  ).optional(),
  exp: z.number().nonnegative().optional(),
  daily: z.array(z.enum(DAILIES)).min(1).refine(
    (values) => new Set(values).size === values.length,
    'List each daily only once.',
  ).optional(),
}).superRefine((data, context) => {
  if (data.category !== GAME_CATEGORY) return;
  if (data.skill === undefined && data.exp !== undefined) {
    context.addIssue({ code: 'custom', path: ['skill'], message: 'List the skills that receive this exp.' });
  }
  if (data.skill !== undefined && data.exp === undefined) {
    context.addIssue({ code: 'custom', path: ['exp'], message: 'Provide exp for the listed skills.' });
  }
  if (data.skill === undefined && data.daily === undefined) {
    context.addIssue({ code: 'custom', path: ['skill'], message: 'A Game of Life post needs skill + exp, daily, or both.' });
  }
});
