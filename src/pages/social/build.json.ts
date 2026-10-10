import { buildTodaySocialContent } from '../../lib/social-card';

// Deliberately static: the request-time today.json is not proof that the
// deployed PNG/MP4 were regenerated. The reel builder fills in reelDate.
export async function GET() {
  return new Response(JSON.stringify({
    imageDate: buildTodaySocialContent().date.iso,
    reelDate: null,
  }), { headers: { 'Content-Type': 'application/json' } });
}
