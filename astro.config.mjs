import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';

const [owner, repository] = (process.env.GITHUB_REPOSITORY ?? 'sl16/dilettante-web').split('/');

export default defineConfig({
  site: process.env.SITE_URL ?? `https://${owner}.github.io`,
  base: process.env.BASE_PATH ?? (
    repository.toLowerCase() === `${owner.toLowerCase()}.github.io` ? '/' : `/${repository}`
  ),
  output: 'static',
  trailingSlash: 'always',
  integrations: [mdx()],
  vite: { plugins: [tailwindcss()] },
});
