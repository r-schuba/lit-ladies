const API_KEY = process.env.EXPO_PUBLIC_NYT_API_KEY;
const BASE_URL = 'https://api.nytimes.com/svc/books/v3';

export type NYTBook = {
  rank: number;
  title: string;
  author: string;
  description: string;
  publisher: string;
  isbn13: string;
  coverUrl: string;
  weeksOnList: number;
};

export type NYTListDef = {
  label: string;
  encoded: string;
};

export const NYT_LISTS: NYTListDef[] = [
  { label: 'Fiction', encoded: 'hardcover-fiction' },
  { label: 'Nonfiction', encoded: 'hardcover-nonfiction' },
  { label: 'Paperback', encoded: 'trade-fiction-paperback' },
  { label: 'Young Adult', encoded: 'young-adult-hardcover' },
  { label: 'Graphic', encoded: 'graphic-books-and-manga' },
];

export async function getNYTListBooks(listEncoded: string): Promise<NYTBook[]> {
  if (!API_KEY) throw new Error('EXPO_PUBLIC_NYT_API_KEY is not set');
  const res = await fetch(
    `${BASE_URL}/lists/current/${listEncoded}.json?api-key=${API_KEY}`
  );
  if (!res.ok) throw new Error(`NYT API error ${res.status}`);
  const data = await res.json();
  return (data.results?.books ?? []).map((b: any): NYTBook => ({
    rank: b.rank,
    title: b.title,
    author: b.author,
    description: b.description ?? '',
    publisher: b.publisher ?? '',
    isbn13: b.primary_isbn13 ?? '',
    coverUrl: b.book_image ?? '',
    weeksOnList: b.weeks_on_list ?? 0,
  }));
}
