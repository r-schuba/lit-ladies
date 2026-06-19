export const GENRES = [
  'Fiction',
  'Literary Fiction',
  'Historical Fiction',
  'Mystery',
  'Thriller',
  'Science Fiction',
  'Fantasy',
  'Romance',
  'Horror',
  'Biography',
  'Memoir',
  'Self-Help',
  'Nonfiction',
  'Short Stories',
  'Graphic Novel',
] as const;

export type Genre = (typeof GENRES)[number];

export type LengthBucket = 'Short' | 'Medium' | 'Long' | 'Epic';

export const LENGTH_BUCKETS: Record<LengthBucket, { label: string; min: number; max: number }> = {
  Short: { label: 'Short (< 200 pages)', min: 0, max: 199 },
  Medium: { label: 'Medium (200–400 pages)', min: 200, max: 400 },
  Long: { label: 'Long (400–600 pages)', min: 401, max: 600 },
  Epic: { label: 'Epic (600+ pages)', min: 601, max: 9999 },
};

export function getLengthBucket(pageCount: number | null): LengthBucket {
  if (!pageCount) return 'Medium';
  if (pageCount < 200) return 'Short';
  if (pageCount <= 400) return 'Medium';
  if (pageCount <= 600) return 'Long';
  return 'Epic';
}
