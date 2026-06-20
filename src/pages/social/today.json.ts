import { buildTodaySocialContent } from '../../lib/social-card';

export async function GET() {
  const content = buildTodaySocialContent();

  return new Response(JSON.stringify(content, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=900',
    },
  });
}
