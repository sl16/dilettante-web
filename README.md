# dilettante

A minimalist personal website and blog. The homepage contains a short dictionary-definition hero and the three newest posts. The Blog lists all published posts newest first; Game of Life is an empty page reserved for future work. Built with Astro, Tailwind CSS v4, and MDX. Static HTML by default; JavaScript only where a widget needs it. No external fonts, analytics, or UI framework.

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
npm test         # Check built routes, links, assets, and zero-JS pages
npm run preview # Serve the production build locally
```

Build before running the tests. Commit the lockfile so local and CI installs match.

Tests check generated routes, links, canonical URLs, JavaScript isolation, and post listing order using the built posts' publication dates. They do not assert exact prose or sample post titles, so routine writing edits do not require test changes.

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

`src/pages/game-of-life.astro` intentionally contains only its title for now.

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
