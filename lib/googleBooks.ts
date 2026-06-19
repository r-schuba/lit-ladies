const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_BOOKS_API_KEY;
const BASE_URL = 'https://www.googleapis.com/books/v1/volumes';

export type GoogleBook = {
  id: string;
  title: string;
  author: string;
  authorFirstName: string;
  genre: string | null;
  pageCount: number | null;
  averageRating: number | null; // 1-5 scale from Google
  ratingsCount: number | null;
  coverUrl: string | null;
  description: string | null;
  publishedDate: string | null;
  publisher: string | null;
};

// Ordered by specificity — first match wins
const GENRE_KEYWORDS: [string[], string][] = [
  [['psychological thriller', 'psychological suspense'], 'Psychological Thriller'],
  [['legal thriller', 'courtroom thriller'], 'Legal Thriller'],
  [['political thriller'], 'Political Thriller'],
  [['medical thriller'], 'Medical Thriller'],
  [['spy', 'espionage'], 'Spy Thriller'],
  [['thriller', 'suspense'], 'Thriller'],
  [['cozy mystery', 'cozy crime'], 'Cozy Mystery'],
  [['detective', 'whodunit', 'whodunnit', 'murder mystery'], 'Mystery'],
  [['mystery', 'crime fiction', 'crime novel'], 'Mystery'],
  [['historical fiction', 'historical novel', 'set in the', 'set during'], 'Historical Fiction'],
  [['literary fiction', 'literary novel'], 'Literary Fiction'],
  [['coming-of-age', 'coming of age', 'adolescen', 'growing up'], 'Coming of Age'],
  [['dystopian', 'dystopia', 'post-apocalyptic', 'post apocalyptic'], 'Dystopian'],
  [['magical realism', 'magic realism'], 'Magical Realism'],
  [['fantasy', 'dragons', 'wizards', 'sorcerer', 'magic kingdom'], 'Fantasy'],
  [['science fiction', 'sci-fi', 'futuristic', 'outer space', 'alien', 'interstellar'], 'Science Fiction'],
  [['horror', 'supernatural terror', 'haunted', 'ghost story'], 'Horror'],
  [['romance', 'love story', 'falling in love', 'romantic'], 'Romance'],
  [['memoir', 'my life', 'my story', 'growing up as', 'autobiography'], 'Memoir'],
  [['biography', 'the life of', 'life and times'], 'Biography'],
  [['short stories', 'short story collection', 'collection of stories'], 'Short Stories'],
  [['essays', 'essay collection'], 'Essays'],
  [['self-help', 'self help', 'personal growth', 'how to improve', 'habits'], 'Self-Help'],
  [['young adult', 'ya novel', 'teen fiction'], 'Young Adult'],
  [['graphic novel', 'illustrated novel', 'comic'], 'Graphic Novel'],
  [['satire', 'satirical'], 'Satire'],
  [['humor', 'humorous', 'comedic'], 'Humor'],
  [['classic', 'masterpiece of literature', 'great american novel'], 'Classic'],
  [['war novel', 'war fiction', 'world war', 'battlefield'], 'War Fiction'],
  [['family saga', 'family drama', 'multigenerational'], 'Family Saga'],
  [['immigration', 'immigrant experience', 'diaspora'], 'Immigrant Fiction'],
  [['southern gothic', 'southern fiction'], 'Southern Gothic'],
  [['literary'], 'Literary Fiction'],
  [['historical'], 'Historical Fiction'],
  [['mystery'], 'Mystery'],
  [['thriller'], 'Thriller'],
  [['fantasy'], 'Fantasy'],
  [['horror'], 'Horror'],
  [['romance'], 'Romance'],
];

function pickBestGenre(categories: string[], title = '', description = ''): string | null {
  const corpus = [title, description, ...categories].join(' ').toLowerCase();

  for (const [keywords, label] of GENRE_KEYWORDS) {
    if (keywords.some((kw) => corpus.includes(kw))) return label;
  }

  // Last resort: pull the most specific non-generic segment from category paths
  const segments = categories
    .flatMap((c) => c.split('/').map((s) => s.trim().toLowerCase()))
    .filter((s) => s && !['general', 'fiction', 'nonfiction', 'books', 'literature'].includes(s));

  if (segments.length > 0) {
    const s = segments[0];
    return s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  }

  return null;
}

function extractBook(item: any): GoogleBook {
  const info = item.volumeInfo ?? {};
  const authors: string[] = info.authors ?? [];
  const author = authors[0] ?? 'Unknown';
  const authorFirstName = author.split(' ')[0];

  const thumbnail =
    info.imageLinks?.thumbnail ??
    info.imageLinks?.smallThumbnail ??
    null;
  // Use https to avoid mixed-content warnings
  const coverUrl = thumbnail ? thumbnail.replace('http://', 'https://') : null;

  const categories: string[] = info.categories ?? [];
  const description: string = info.description ?? '';
  const genre = pickBestGenre(categories, info.title ?? '', description);

  return {
    id: item.id,
    title: info.title ?? 'Unknown Title',
    author,
    authorFirstName,
    genre,
    pageCount: info.pageCount ?? null,
    averageRating: info.averageRating ?? null,
    ratingsCount: info.ratingsCount ?? null,
    coverUrl,
    description: info.description ?? null,
    publishedDate: info.publishedDate ?? null,
    publisher: info.publisher ?? null,
  };
}

async function fetchBooks(q: string, maxResults: number): Promise<GoogleBook[]> {
  const params = new URLSearchParams({
    q,
    maxResults: String(maxResults),
    printType: 'books',
    orderBy: 'relevance',
    ...(API_KEY ? { key: API_KEY } : {}),
  });
  const res = await fetch(`${BASE_URL}?${params}`);
  if (!res.ok) throw new Error(`Google Books API error: ${res.status}`);
  const data = await res.json();
  return (data.items ?? []).map(extractBook);
}

export async function searchBooks(
  query: string,
  maxResults = 20
): Promise<GoogleBook[]> {
  // intitle: gives precise title matches; orderBy relevance surfaces popular editions first
  return fetchBooks(`intitle:${query}`, maxResults);
}

export async function getBookById(googleBooksId: string): Promise<GoogleBook | null> {
  const params = new URLSearchParams(API_KEY ? { key: API_KEY } : {});
  const res = await fetch(`${BASE_URL}/${googleBooksId}?${params}`);
  if (!res.ok) return null;
  const item = await res.json();
  return extractBook(item);
}

// Tries ISBN first, then title + author. Used for bulk import matching.
export async function findBestMatch(
  title: string,
  author: string,
  isbn?: string
): Promise<GoogleBook | null> {
  if (isbn) {
    const byIsbn = await fetchBooks(`isbn:${isbn}`, 1);
    if (byIsbn.length > 0) return byIsbn[0];
  }
  const lastName = author.split(' ').pop() ?? author;
  const results = await fetchBooks(
    `intitle:"${title.substring(0, 40)}" inauthor:"${lastName}"`,
    3
  );
  if (!results.length) return null;
  const titleLower = title.toLowerCase();
  return results.find(r => r.title.toLowerCase() === titleLower) ?? results[0];
}

export async function searchBooksFiltered(options: {
  genres?: string[];
  minRating?: number;
  minPages?: number;
  maxPages?: number;
  maxResults?: number;
}): Promise<GoogleBook[]> {
  const { genres, minRating, minPages, maxPages, maxResults = 40 } = options;

  let allBooks: GoogleBook[];
  if (!genres || genres.length === 0) {
    allBooks = await fetchBooks('subject:fiction', maxResults);
  } else {
    const results = await Promise.all(
      genres.map((g) => fetchBooks(`subject:${g}`, maxResults))
    );
    const seen = new Set<string>();
    allBooks = [];
    for (const batch of results) {
      for (const book of batch) {
        if (!seen.has(book.id)) {
          seen.add(book.id);
          allBooks.push(book);
        }
      }
    }
  }

  return allBooks.filter((b) => {
    if (minRating !== undefined && (b.averageRating ?? 0) < minRating) return false;
    if (minPages !== undefined && (b.pageCount ?? 0) < minPages) return false;
    if (maxPages !== undefined && (b.pageCount ?? Infinity) > maxPages) return false;
    return true;
  });
}
