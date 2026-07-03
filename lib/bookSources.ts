import * as Linking from 'expo-linking';

export type SourceCategory = 'library' | 'buy-local' | 'buy-online' | 'audiobook';

export type BookSource = {
  id: string;
  name: string;
  subtitle: string;
  category: SourceCategory;
  icon: string;
  iconIsBrand?: boolean;
  iconColor: string;
  bgColor: string;
  getUrl: (title: string, author: string) => string;
};

const enc = (s: string) => encodeURIComponent(s);
const q = (title: string, author: string) => enc(`${title} ${author}`);

// Strip marketing labels like "(A GMA Book Club Pick)", "[Reese's Book Club]", or ": A Novel"
function cleanTitle(title: string): string {
  return title
    .replace(/\s*[\(\[].*?[\)\]]\s*$/, '')           // trailing (parenthetical) or [bracket]
    .replace(/\s*:\s*(a |an )(novel|book club|gma|reese|oprah|read|pick|story|memoir|thriller|mystery).*/i, '') // ": A Novel", ": A GMA Book Club Pick", etc.
    .trim();
}

export const BOOK_SOURCES: BookSource[] = [
  // ── Libraries ──────────────────────────────────────────────────────────────
  {
    id: 'aadl',
    name: 'AADL',
    subtitle: 'Physical copies',
    category: 'library',
    icon: 'university',
    iconColor: '#1e40af',
    bgColor: '#eff6ff',
    getUrl: (title) =>
      `https://aadl.org/search/catalog/${enc(cleanTitle(title))}`,
  },
  {
    id: 'libby',
    name: 'Libby - MCLS',
    subtitle: 'eBooks & audiobooks',
    category: 'library',
    icon: 'tablet-alt',
    iconColor: '#0e7490',
    bgColor: '#ecfeff',
    getUrl: (title) =>
      `https://libbyapp.com/search/mlc/search/query-${enc(cleanTitle(title))}/page-1`,
  },
  // ── Local Bookstores ───────────────────────────────────────────────────────
  {
    id: 'literati',
    name: 'Literati',
    subtitle: 'Ann Arbor indie',
    category: 'buy-local',
    icon: 'store',
    iconColor: '#6d28d9',
    bgColor: '#f5f3ff',
    getUrl: (title) =>
      `https://literatibookstore.com/search?q=${enc(cleanTitle(title))}`,
  },
  {
    id: 'schuler',
    name: "Schuler Books",
    subtitle: 'Michigan indie',
    category: 'buy-local',
    icon: 'store',
    iconColor: '#0369a1',
    bgColor: '#f0f9ff',
    getUrl: (title) =>
      `https://schulerbooks.com/search?q=${enc(cleanTitle(title))}`,
  },
  // ── Buy Online ─────────────────────────────────────────────────────────────
  {
    id: 'amazon',
    name: 'Amazon',
    subtitle: 'New & used',
    category: 'buy-online',
    icon: 'shopping-cart',
    iconColor: '#92400e',
    bgColor: '#fffbeb',
    getUrl: (title, author) =>
      `https://www.amazon.com/s?k=${enc(`${cleanTitle(title)} ${author}`)}&i=stripbooks`,
  },
  // ── Audiobooks ─────────────────────────────────────────────────────────────
  {
    id: 'audible',
    name: 'Audible',
    subtitle: 'Amazon audiobooks',
    category: 'audiobook',
    icon: 'headphones',
    iconColor: '#b45309',
    bgColor: '#fef3c7',
    getUrl: (title, author) =>
      `https://www.audible.com/search?keywords=${enc(`${cleanTitle(title)} ${author}`)}`,
  },
  {
    id: 'spotify',
    name: 'Spotify',
    subtitle: 'Audiobooks',
    category: 'audiobook',
    icon: 'spotify',
    iconIsBrand: true,
    iconColor: '#15803d',
    bgColor: '#f0fdf4',
    getUrl: (title, author) =>
      `https://open.spotify.com/search/${enc(`${cleanTitle(title)} ${author}`)}`,
  },
];

export const SOURCE_CATEGORIES: {
  key: SourceCategory;
  label: string;
  emoji: string;
}[] = [
  { key: 'library', label: 'Libraries', emoji: '🏛️' },
  { key: 'buy-local', label: 'Local Bookstores', emoji: '🏪' },
  { key: 'buy-online', label: 'Online', emoji: '🛒' },
  { key: 'audiobook', label: 'Audiobooks', emoji: '🎧' },
];

export function openSource(source: BookSource, title: string, author: string) {
  Linking.openURL(source.getUrl(title, author));
}
