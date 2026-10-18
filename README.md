# dilettante

A minimalist personal website and blog. The homepage contains a short dictionary-definition hero and the three newest posts. The Blog lists all published posts newest first; Game of Life tracks a 100-day challenge through those posts. Built with Astro, Tailwind CSS v4, and MDX. Static HTML by default; JavaScript only where a widget needs it. No external fonts, analytics, or UI framework.

## Run locally

Use Node.js **22.22+** (Node 24 recommended) and npm.

```sh
npm ci
npm run dev
```

Open the local URL printed by Astro (by default `http://localhost:4321/dilettante-web/`). The base path also applies during development.

```sh
npm run check    # Astro and TypeScript diagnostics
npm run build    # Static output in dist/
npm test         # Check challenge logic, frontmatter, and built pages
npm run preview # Serve the production build locally
```

Build before running the tests. Commit the lockfile so local and CI installs match.

Tests check challenge calculations and frontmatter validation as well as generated routes, links, canonical URLs, JavaScript isolation, dashboard structure, and post listing order. They do not assert exact blog prose or sample post titles, so routine writing edits do not require test changes. Run only the challenge unit tests with `node --test tests/game-of-life.test.mjs` (no build needed).

## Structure

```text
src/
  components/          Header, navigation, post cards
    widgets/           Self-contained interactive components
  content/blog/        Markdown and MDX entries
  content.config.ts    Validated content collection schema
  layouts/             Shared document shell
  lib/                 Base-path links and post queries
  pages/               Home, blog, post routes, Game of Life, 404
  styles/global.css    Tailwind theme and shared styles
public/                Files copied directly into the build
```

Change the site name and description in `src/config.ts`. The three included posts are example content.

## Write a post

Add a `.md` or `.mdx` file under `src/content/blog/`:

```yaml
---
title: "Your next idea"
description: "A short summary for cards and search engines."
published: 2026-10-15
category: Notes
draft: false
---
```

Write the body below the frontmatter. The filename becomes the URL; nested folders also work. Posts are sorted newest first. `draft: true` excludes a post from both listings and generated routes, including local development. Dates are displayed in UTC. Build again to publish edits.

## Game of Life

Add one post per UTC calendar day with `category: Game of Life`. It can record skills, dailies, or both:

```yaml
---
title: "Day one: making a start"
description: "A little coding, a little crafting, and everyday practice."
published: 2026-10-19
category: Game of Life
skill:
  - computers
  - crafting
exp: 60
daily:
  - cooking
  - reading
---
```

- `skill` is a list containing any of `homesteading`, `exploration`, `computers`, `teaching`, `chronicling`, and `crafting`. Use a list even for a single skill, e.g. `skill: [computers]`.
- `exp` is a finite, non-negative number; fractions are allowed. It is roughly the number of minutes practiced. **Every listed skill receives the full amount**: the example gives both computers and crafting 60 XP.
- `daily` is a list containing any of `sport`, `cooking`, `cleaning`, and `reading`, each at most once. Dailies do not award additional XP.
- For a skill-only entry, omit `daily`. For a daily-only entry, omit both `skill` and `exp`. Omit unused lists rather than supplying empty lists.
- Unknown activities, duplicate list items, missing XP for skills, and Game of Life posts without activities fail validation. Multiple non-draft Game of Life posts on the same UTC date fail the build, with both post IDs in the error. Drafts still need valid frontmatter.

The challenge covers **19 October 2026 through 26 January 2027 inclusive** (100 days). A post's `published` date determines its challenge day in UTC; dates without times are recommended. Only non-draft Game of Life posts inside that window contribute to the dashboard. All non-draft Game of Life posts, including dates outside the window, appear in the journal newest first. Future-dated, non-draft entries inside the window count at build time too.

Each of the six skills starts at **level 0, 0 XP**. Moving from level `L` to `L + 1` costs `120 × (L + 1)^1.5` XP. Level 1 costs 120 XP; level 2 costs approximately 339.41 **additional** XP. XP carries over, can cross multiple levels at once, and calculations retain numeric precision rather than rounding thresholds.

The dashboard shows all six skills in one horizontal bar chart. Bar lengths share a common scale and represent completed levels plus the fraction of XP earned toward the next level; each row also shows its level, next-level progress, and total XP. Below it are a cumulative XP line per skill across all 100 days, then one heatmap cell per day. Heatmap intensity reflects the number of distinct dailies completed (0–4); logged cells link to that day's post. Missing days award no XP, preserve cumulative totals, and have zero dailies. An expandable table exposes daily totals and activities without relying on chart colors.

Everything is generated during `npm run build`, with no dashboard JavaScript, API, or database. Add a post and rebuild (or push to trigger deployment) to update it.

## Internal links

Use `withBase()` from `src/lib/paths.ts` for internal links and public assets in Astro components. In MDX, import that helper when linking to internal routes rather than hard-coding `/blog/`. Prefer relative Markdown images or base-aware public asset URLs.

## Deploy to GitHub Pages

1. Push this project and its lockfile to the repository's `main` branch. If using another branch, update `.github/workflows/deploy.yml`.
2. In **Settings → Pages → Build and deployment**, select **GitHub Actions**.
3. Push to `main`, or run **Deploy to GitHub Pages** from the Actions tab.

The workflow installs dependencies, type-checks, builds, tests internal links, and uploads/deploys `dist/` using the official Pages actions. Deployment has only the required Pages and OIDC permissions.

`astro.config.mjs` defaults to `https://sl16.github.io/dilettante-web/`. In GitHub Actions it detects the repository automatically, and the Pages configuration action supplies the actual origin and base path. User/organization repositories named `<owner>.github.io` use `/` instead. All internal navigation and asset paths respect Astro's configured base.

For a custom domain, configure the domain in **Settings → Pages**, set up DNS as GitHub instructs, and optionally add `public/CNAME` containing the hostname. The workflow reads the configured Pages origin/base, so canonical URLs and links follow the domain.

For local builds targeting another host or a domain root, set overrides:

```sh
SITE_URL=https://example.com BASE_PATH=/ npm run build
BASE_PATH=/ npm test
```

`SITE_URL` is the origin (including `https://`); `BASE_PATH` is `/` for the root or a leading-slash project path such as `/dilettante-web`. Use the same base when building and testing. Preview uses your local config, so pass the same overrides to `npm run preview` if you changed them for the build. Never commit secrets in these settings: this is a public static site.
