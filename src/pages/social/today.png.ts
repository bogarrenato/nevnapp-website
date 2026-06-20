import sharp from 'sharp';

import { buildTodaySocialContent, createTodaySocialCardSvg } from '../../lib/social-card';

export async function GET() {
  const content = buildTodaySocialContent();
  const svg = createTodaySocialCardSvg(content);
  const png = await sharp(Buffer.from(svg)).png().toBuffer();

  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=900',
    },
  });
}
