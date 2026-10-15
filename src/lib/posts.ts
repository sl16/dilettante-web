import { getCollection } from 'astro:content';

export async function getPosts() {
  const posts = await getCollection('blog', ({ data }) => !data.draft);
  return posts.sort((a, b) =>
    b.data.published.valueOf() - a.data.published.valueOf() || a.id.localeCompare(b.id)
  );
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  }).format(date);
}
