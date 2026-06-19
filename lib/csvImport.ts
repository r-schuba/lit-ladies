export type ParsedBook = {
  title: string;
  author: string;
  isbn?: string;
  pageCount?: number;
};

export type CSVFormat = 'goodreads' | 'storygraph' | 'unknown';

// RFC 4180 CSV parser — handles quoted fields with embedded commas and newlines
function parseCSVToRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const s = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"' && s[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { field += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { row.push(field); field = ''; }
      else if (ch === '\n') {
        row.push(field); field = '';
        if (row.some(f => f.trim())) rows.push(row);
        row = [];
      } else {
        field += ch;
      }
    }
  }
  row.push(field);
  if (row.some(f => f.trim())) rows.push(row);
  return rows;
}

function toRecords(text: string): Record<string, string>[] {
  const rows = parseCSVToRows(text);
  if (rows.length < 2) return [];
  const headers = rows[0].map(h => h.trim());
  return rows.slice(1).map(vals => {
    const rec: Record<string, string> = {};
    headers.forEach((h, i) => { rec[h] = (vals[i] ?? '').trim(); });
    return rec;
  });
}

// Goodreads wraps ISBNs as ="9781234567890" — strip that
function cleanISBN(raw?: string): string | undefined {
  if (!raw) return undefined;
  const cleaned = raw.replace(/[="]/g, '').trim();
  return cleaned.length >= 10 ? cleaned : undefined;
}

export function parseCSVImport(text: string): { books: ParsedBook[]; format: CSVFormat } {
  const records = toRecords(text);
  if (!records.length) return { books: [], format: 'unknown' };

  const keys = Object.keys(records[0]);

  // Goodreads: "Exclusive Shelf" column, to-read items have value "to-read"
  if (keys.includes('Exclusive Shelf')) {
    return {
      format: 'goodreads',
      books: records
        .filter(r => r['Exclusive Shelf'] === 'to-read')
        .map(r => ({
          title: r['Title'] ?? '',
          author: r['Author'] ?? '',
          isbn: cleanISBN(r['ISBN13'] || r['ISBN']),
          pageCount: parseInt(r['Number of Pages']) || undefined,
        }))
        .filter(b => b.title && b.author),
    };
  }

  // StoryGraph: "Read Status" column, to-read items have value "to-read"
  if (keys.includes('Read Status')) {
    return {
      format: 'storygraph',
      books: records
        .filter(r => r['Read Status'] === 'to-read')
        .map(r => ({
          title: r['Title'] ?? '',
          author: r['Authors'] ?? '',
          isbn: cleanISBN(r['ISBN/UID']),
          pageCount: parseInt(r['Number of pages']) || undefined,
        }))
        .filter(b => b.title && b.author),
    };
  }

  return { books: [], format: 'unknown' };
}
