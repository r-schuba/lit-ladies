// NOTE: Claude API calls should be made server-side in production.
// For this admin-only app, we call from the client using the public key.
// Alternatively, deploy a simple edge function in Supabase for production use.

const CLAUDE_PROXY_URL = 'https://cytwqonnxmqpisvkqxbg.supabase.co/functions/v1/bright-responder';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

const ANTHROPIC_HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
};

export type DiscussionGuide = {
  questions: string[];
  themes: string[];
  authorNote: string;
  quotesPrompt: string;
};

export async function generateDiscussionGuide(
  title: string,
  author: string,
  genre: string | null
): Promise<DiscussionGuide> {
  const prompt = `You are a thoughtful book club facilitator. Generate a discussion guide for "${title}" by ${author}${genre ? ` (${genre})` : ''}.

Return a JSON object with exactly this structure:
{
  "questions": [8-10 open-ended discussion questions],
  "themes": [4-6 key themes or motifs in the book],
  "authorNote": "2-3 sentences about the author's background and writing style",
  "quotesPrompt": "A prompt encouraging members to find and share their favorite quotes"
}

Return only valid JSON, no markdown code blocks.`;

  const res = await fetch(CLAUDE_PROXY_URL, {
    method: 'POST',
    headers: ANTHROPIC_HEADERS,
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error: ${res.status} — ${err}`);
  }

  const data = await res.json();
  const text: string = data.content?.[0]?.text ?? '{}';

  try {
    return JSON.parse(text) as DiscussionGuide;
  } catch {
    throw new Error('Failed to parse discussion guide from Claude response');
  }
}

export async function generateBookPersonality(
  memberName: string,
  ratingHistory: { title: string; score: number }[],
  favoriteBooks: string[]
): Promise<string> {
  const ratingsText = ratingHistory.length > 0
    ? ratingHistory.map((r) => `"${r.title}" (${r.score}/10)`).join(', ')
    : 'no ratings yet';
  const favoritesText = favoriteBooks.length > 0
    ? favoriteBooks.join(', ')
    : 'no favorites yet';

  const prompt = `You are a witty book club personality analyst. Based on ${memberName}'s reading history, write a fun 2-3 sentence book personality description in third person.

Ratings history: ${ratingsText}
Favorite books: ${favoritesText}

Write something like "${memberName} is the kind of reader who..." — warm, playful, and specific to the books/patterns above. Return only the personality text, no extra formatting.`;

  const res = await fetch(CLAUDE_PROXY_URL, {
    method: 'POST',
    headers: ANTHROPIC_HEADERS,
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error: ${res.status} — ${err}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text?.trim() ?? '';
}

export async function inferGenre(
  title: string,
  author: string,
  description: string | null
): Promise<string | null> {
  const prompt = `What is the most specific literary genre for "${title}" by ${author}?${description ? `\n\nDescription: ${description.slice(0, 400)}` : ''}

Reply with ONLY the genre label, nothing else. Use specific genres like: Literary Fiction, Historical Fiction, Psychological Thriller, Mystery, Coming of Age, Magical Realism, Dystopian, Science Fiction, Fantasy, Romance, Memoir, Biography, Short Stories, Essays, Self-Help, Horror, Satire, Family Saga, Southern Gothic, War Fiction, Spy Thriller, or similar. Do not say just "Fiction".`;

  const res = await fetch(CLAUDE_PROXY_URL, {
    method: 'POST',
    headers: ANTHROPIC_HEADERS,
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 20,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const data = await res.json();
  console.log('[inferGenre] status:', res.status, 'body:', JSON.stringify(data).slice(0, 200));
  if (!res.ok) return null;
  const genre = data.content?.[0]?.text?.trim() ?? null;
  return genre || null;
}
