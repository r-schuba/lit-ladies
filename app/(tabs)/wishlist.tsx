import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { supabase, WishlistItem } from '../../lib/supabase';
import { searchBooks, getBookById, findBestMatch, GoogleBook } from '../../lib/googleBooks';
import { getAuthorGender } from '../../lib/genderize';
import { parseCSVImport, ParsedBook, CSVFormat } from '../../lib/csvImport';
import { getNYTListBooks, NYTBook, NYT_LISTS } from '../../lib/nytBooks';
import { BookCard } from '../../components/BookCard';
import { BookPreviewModal, PreviewableBook } from '../../components/BookPreviewModal';
import { SearchBar } from '../../components/SearchBar';
import { EmptyState } from '../../components/EmptyState';
import { ScreenHeader } from '../../components/ScreenHeader';

// ---------------------------------------------------------------------------
// Shared helper — upserts book + adds to wishlist
// ---------------------------------------------------------------------------

async function saveBookToWishlist(params: {
  title: string;
  author: string;
  authorFirstName: string;
  genre?: string | null;
  pageCount?: number | null;
  coverUrl?: string | null;
  googleBooksId?: string | null;
}): Promise<void> {
  const gender = await getAuthorGender(params.authorFirstName);
  let bookId: string;

  if (params.googleBooksId) {
    const { data } = await supabase
      .from('books')
      .upsert(
        {
          title: params.title,
          author: params.author,
          author_gender: gender,
          genre: params.genre ?? null,
          page_count: params.pageCount ?? null,
          cover_url: params.coverUrl ?? null,
          google_books_id: params.googleBooksId,
        },
        { onConflict: 'google_books_id' }
      )
      .select('id')
      .single();
    if (!data) throw new Error('Failed to save book');
    bookId = data.id;
  } else {
    // No Google Books ID — dedupe by title
    const { data: existing } = await supabase
      .from('books')
      .select('id')
      .ilike('title', params.title)
      .limit(1)
      .maybeSingle();

    if (existing) {
      bookId = existing.id;
    } else {
      const { data } = await supabase
        .from('books')
        .insert({
          title: params.title,
          author: params.author,
          author_gender: gender,
          genre: params.genre ?? null,
          page_count: params.pageCount ?? null,
          cover_url: params.coverUrl ?? null,
        })
        .select('id')
        .single();
      if (!data) throw new Error('Failed to insert book');
      bookId = data.id;
    }
  }

  await supabase
    .from('wishlist')
    .upsert({ book_id: bookId }, { onConflict: 'book_id' });
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function WishlistScreen() {
  const router = useRouter();
  const { add } = useLocalSearchParams<{ add?: string }>();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [picking, setPicking] = useState<string | null>(null);
  const [inPoll, setInPoll] = useState<Set<string>>(new Set());
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [previewBook, setPreviewBook] = useState<PreviewableBook | null>(null);
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadWishlist();
      if (add === '1') {
        setShowAddModal(true);
        router.setParams({ add: undefined });
      }
    }, [add])
  );

  async function openPreview(item: WishlistItem) {
    if (!item.book) return;
    setPreviewLoadingId(item.book_id);
    try {
      if (item.book.google_books_id) {
        const gb = await getBookById(item.book.google_books_id);
        if (gb) { setPreviewBook(gb); return; }
      }
      setPreviewBook({
        title: item.book.title,
        author: item.book.author,
        coverUrl: item.book.cover_url,
        genre: item.book.genre,
        pageCount: item.book.page_count,
      });
    } catch {
      setPreviewBook({
        title: item.book.title,
        author: item.book.author,
        coverUrl: item.book.cover_url,
        genre: item.book.genre,
        pageCount: item.book.page_count,
      });
    } finally {
      setPreviewLoadingId(null);
    }
  }

  async function loadWishlist() {
    setLoading(true);
    const [wishlistRes, votesRes] = await Promise.all([
      supabase.from('wishlist').select('*, book:books(*)').order('created_at', { ascending: false }),
      supabase.from('votes').select('book_id').eq('member_name', '__nominee__'),
    ]);
    setItems((wishlistRes.data ?? []) as WishlistItem[]);
    setInPoll(new Set((votesRes.data ?? []).map((v: { book_id: string }) => v.book_id)));
    setLoading(false);
  }

  async function moveToVote(item: WishlistItem) {
    await supabase
      .from('votes')
      .upsert({ book_id: item.book_id, member_name: '__nominee__' }, { onConflict: 'book_id,member_name' });
    setInPoll((prev) => new Set([...prev, item.book_id]));
  }

  async function pickBook(item: WishlistItem) {
    setPicking(item.book_id);
    try {
      const { data: existing } = await supabase
        .from('book_log')
        .select('id')
        .eq('book_id', item.book_id)
        .maybeSingle();

      if (existing) {
        router.push(`/book/${item.book_id}`);
        return;
      }

      const { data: logData, error } = await supabase
        .from('book_log')
        .insert({ book_id: item.book_id })
        .select()
        .single();

      if (error || !logData) throw error ?? new Error('Failed to create log entry');

      await supabase.from('wishlist').delete().eq('id', item.id);

      loadWishlist();
      router.push(`/book/${item.book_id}`);
    } catch (e) {
      Alert.alert('Error', String(e));
    } finally {
      setPicking(null);
    }
  }

  async function removeFromWishlist(item: WishlistItem) {
    if (confirmRemove === item.id) {
      await supabase.from('wishlist').delete().eq('id', item.id);
      setConfirmRemove(null);
      loadWishlist();
    } else {
      setConfirmRemove(item.id);
    }
  }

  return (
    <View className="flex-1 bg-cream-100">
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <ScreenHeader
          title="Wishlist"
          subtitle={`${items.length} books saved`}
          right={
            <View className="flex-row gap-2">
              <Pressable
                onPress={() => setShowImportModal(true)}
                className="bg-cream-200 rounded-xl px-3 py-2"
              >
                <Text className="text-brand-600 font-semibold text-sm">Import</Text>
              </Pressable>
              <Pressable
                onPress={() => setShowAddModal(true)}
                className="bg-brand-500 rounded-xl px-4 py-2"
              >
                <Text className="text-white font-semibold text-sm">+ Add</Text>
              </Pressable>
            </View>
          }
        />

        {loading ? (
          <ActivityIndicator color="#db2777" className="mt-8" />
        ) : items.length === 0 ? (
          <EmptyState
            icon="heart"
            title="Your wishlist is empty"
            subtitle="Add books you want to read next!"
          />
        ) : (
          items.map((item) => (
            <BookCard
              key={item.id}
              title={item.book?.title ?? ''}
              author={item.book?.author ?? ''}
              coverUrl={item.book?.cover_url}
              genre={item.book?.genre}
              pageCount={item.book?.page_count}
              onPress={() => openPreview(item)}
              rightElement={
                <View className="gap-2">
                  {previewLoadingId === item.book_id && (
                    <ActivityIndicator size="small" color="#C4614A" />
                  )}
                  <Pressable
                    onPress={() => pickBook(item)}
                    disabled={picking === item.book_id}
                    className="bg-brand-500 rounded-lg px-2 py-1"
                  >
                    {picking === item.book_id
                      ? <ActivityIndicator color="white" size="small" />
                      : <View className="flex-row items-center gap-1">
                          <FontAwesome5 name="book-open" size={10} color="white" solid />
                          <Text className="text-white text-xs font-medium">Pick</Text>
                        </View>
                    }
                  </Pressable>
                  <Pressable
                    onPress={() => !inPoll.has(item.book_id) && moveToVote(item)}
                    className={`rounded-lg px-2 py-1 ${inPoll.has(item.book_id) ? 'bg-green-50' : 'bg-brand-50'}`}
                  >
                    <View className="flex-row items-center gap-1">
                      {inPoll.has(item.book_id) && <FontAwesome5 name="check" size={9} color="#16a34a" solid />}
                      <Text className={`text-xs font-medium ${inPoll.has(item.book_id) ? 'text-green-600' : 'text-brand-600'}`}>
                        {inPoll.has(item.book_id) ? 'In Poll' : 'Add to Poll'}
                      </Text>
                    </View>
                  </Pressable>
                  <Pressable
                    onPress={() => removeFromWishlist(item)}
                    className={`rounded-lg px-2 py-1 ${confirmRemove === item.id ? 'bg-red-50' : 'bg-gray-50'}`}
                  >
                    <Text className={`text-xs ${confirmRemove === item.id ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                      {confirmRemove === item.id ? 'Confirm?' : 'Remove'}
                    </Text>
                  </Pressable>
                </View>
              }
            />
          ))
        )}
      </ScrollView>

      <BookPreviewModal book={previewBook} onClose={() => setPreviewBook(null)} />

      {showAddModal && (
        <AddWishlistModal
          onClose={() => setShowAddModal(false)}
          onSaved={() => {
            setShowAddModal(false);
            loadWishlist();
          }}
        />
      )}

      {showImportModal && (
        <ImportModal
          onClose={() => setShowImportModal(false)}
          onSaved={loadWishlist}
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Add modal (manual Google Books search — unchanged)
// ---------------------------------------------------------------------------

function AddWishlistModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GoogleBook[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [previewBook, setPreviewBook] = useState<GoogleBook | null>(null);

  async function handleSearch() {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const books = await searchBooks(query, 10);
      setResults(books.filter((b, i, arr) => arr.findIndex((x) => x.id === b.id) === i));
    } catch (e) {
      Alert.alert('Search failed', String(e));
    } finally {
      setSearching(false);
    }
  }

  async function addBook(book: GoogleBook) {
    setSaving(book.id);
    try {
      const gender = await getAuthorGender(book.authorFirstName);
      const { data: bookData } = await supabase
        .from('books')
        .upsert(
          {
            title: book.title,
            author: book.author,
            author_gender: gender,
            genre: book.genre,
            page_count: book.pageCount,
            cover_url: book.coverUrl,
            google_books_id: book.id,
          },
          { onConflict: 'google_books_id' }
        )
        .select()
        .single();

      if (!bookData) {
        Alert.alert('Error', 'Could not save book');
        return;
      }

      await supabase
        .from('wishlist')
        .upsert({ book_id: bookData.id }, { onConflict: 'book_id' });

      onSaved();
      Alert.alert('Added!', `"${book.title}" added to wishlist.`);
    } catch (e) {
      Alert.alert('Error', String(e));
    } finally {
      setSaving(null);
    }
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <View className="flex-1 bg-cream-50">
        <View className="flex-row items-center justify-between px-5 pt-6 pb-4 border-b border-gray-100">
          <Text className="text-lg font-bold text-gray-900">Add to Wishlist</Text>
          <Pressable onPress={onClose}>
            <Text className="text-brand-500 font-medium">Done</Text>
          </Pressable>
        </View>

        <ScrollView className="flex-1 px-5 pt-4">
          <SearchBar
            value={query}
            onChangeText={setQuery}
            onSubmit={handleSearch}
            loading={searching}
            placeholder="Search by title or author..."
          />
          {results.map((book) => (
            <BookCard
              key={book.id}
              title={book.title}
              author={book.author}
              coverUrl={book.coverUrl}
              genre={book.genre}
              pageCount={book.pageCount}
              onPress={() => setPreviewBook(book)}
              rightElement={
                saving === book.id ? (
                  <ActivityIndicator color="#db2777" size="small" />
                ) : (
                  <Pressable
                    onPress={(e) => { e.stopPropagation(); addBook(book); }}
                    className="bg-brand-500 rounded-lg px-2 py-1.5"
                  >
                    <Text className="text-white text-xs font-medium">Add</Text>
                  </Pressable>
                )
              }
            />
          ))}
          <BookPreviewModal
            book={previewBook}
            onClose={() => setPreviewBook(null)}
            onAdd={previewBook ? () => addBook(previewBook) : undefined}
          />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Import modal — CSV and NYT tabs
// ---------------------------------------------------------------------------

function ImportModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [activeTab, setActiveTab] = useState<'csv' | 'nyt'>('csv');

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <View className="flex-1 bg-cream-50">
        <View className="flex-row items-center justify-between px-5 pt-6 pb-4 border-b border-gray-100">
          <Text className="text-lg font-bold text-gray-900">Import Books</Text>
          <Pressable onPress={onClose}>
            <Text className="text-brand-500 font-medium">Done</Text>
          </Pressable>
        </View>

        <View className="flex-row border-b border-gray-100 px-5">
          <Pressable
            onPress={() => setActiveTab('csv')}
            className={`py-3 mr-6 border-b-2 ${activeTab === 'csv' ? 'border-brand-500' : 'border-transparent'}`}
          >
            <Text className={`text-sm font-medium ${activeTab === 'csv' ? 'text-brand-600' : 'text-gray-400'}`}>
              From File
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab('nyt')}
            className={`py-3 border-b-2 ${activeTab === 'nyt' ? 'border-brand-500' : 'border-transparent'}`}
          >
            <Text className={`text-sm font-medium ${activeTab === 'nyt' ? 'text-brand-600' : 'text-gray-400'}`}>
              NYT Best Sellers
            </Text>
          </Pressable>
        </View>

        {activeTab === 'csv' ? (
          <CSVImportTab onSaved={onSaved} />
        ) : (
          <NYTListsTab onSaved={onSaved} />
        )}
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// CSV import tab
// ---------------------------------------------------------------------------

type CSVPhase = 'pick' | 'preview' | 'importing' | 'done';
type SelectableBook = ParsedBook & { id: string; selected: boolean };

function CSVImportTab({ onSaved }: { onSaved: () => void }) {
  const [phase, setPhase] = useState<CSVPhase>('pick');
  const [books, setBooks] = useState<SelectableBook[]>([]);
  const [format, setFormat] = useState<CSVFormat>('unknown');
  const [progress, setProgress] = useState(0);
  const [importTotal, setImportTotal] = useState(0);
  const [result, setResult] = useState<{ added: number; skipped: number } | null>(null);

  async function pickFile() {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      if (res.canceled) return;

      const uri = res.assets[0].uri;
      const content = await FileSystem.readAsStringAsync(uri);
      const { books: parsed, format: fmt } = parseCSVImport(content);

      if (parsed.length === 0) {
        Alert.alert(
          'No books found',
          fmt === 'unknown'
            ? 'Could not recognize this file. Please use a Goodreads or StoryGraph CSV export.'
            : 'No "to-read" books were found in this file.'
        );
        return;
      }

      setBooks(parsed.map((b, i) => ({ ...b, id: String(i), selected: true })));
      setFormat(fmt);
      setPhase('preview');
    } catch (e) {
      Alert.alert('Error reading file', String(e));
    }
  }

  async function startImport() {
    const toImport = books.filter(b => b.selected);
    if (!toImport.length) return;

    setImportTotal(toImport.length);
    setProgress(0);
    setPhase('importing');

    let added = 0;
    let skipped = 0;

    for (let i = 0; i < toImport.length; i++) {
      setProgress(i + 1);
      try {
        const book = toImport[i];
        const match = await findBestMatch(book.title, book.author, book.isbn);

        if (match) {
          await saveBookToWishlist({
            title: match.title,
            author: match.author,
            authorFirstName: match.authorFirstName,
            genre: match.genre,
            pageCount: match.pageCount,
            coverUrl: match.coverUrl,
            googleBooksId: match.id,
          });
        } else {
          await saveBookToWishlist({
            title: book.title,
            author: book.author,
            authorFirstName: book.author.split(' ')[0],
            pageCount: book.pageCount,
          });
        }
        added++;
      } catch {
        skipped++;
      }
    }

    setResult({ added, skipped });
    setPhase('done');
    onSaved();
  }

  const selectedCount = books.filter(b => b.selected).length;

  if (phase === 'pick') {
    return (
      <ScrollView className="flex-1 px-5 pt-5">
        <View className="bg-cream-100 rounded-2xl p-4 mb-5">
          <Text className="text-sm font-semibold text-gray-800 mb-3">How to export your reading list:</Text>
          <Text className="text-xs font-semibold text-brand-600 mb-1">Goodreads</Text>
          <Text className="text-xs text-gray-600 mb-4">
            goodreads.com → My Books → Import and Export → Export Library
          </Text>
          <Text className="text-xs font-semibold text-brand-600 mb-1">StoryGraph</Text>
          <Text className="text-xs text-gray-600">
            app.thestorygraph.com → Profile → Import/Export → Export your data
          </Text>
        </View>

        <Pressable
          onPress={pickFile}
          className="bg-brand-500 rounded-xl py-4 items-center gap-2"
        >
          <FontAwesome5 name="file-upload" size={18} color="white" />
          <Text className="text-white font-semibold">Choose CSV File</Text>
        </Pressable>
      </ScrollView>
    );
  }

  if (phase === 'preview') {
    return (
      <View className="flex-1">
        <View className="px-5 py-3 border-b border-gray-100">
          <Text className="text-sm font-semibold text-gray-800">
            Found {books.length} to-read books from {format === 'goodreads' ? 'Goodreads' : 'StoryGraph'}
          </Text>
          <View className="flex-row justify-between mt-2">
            <Pressable onPress={() => setBooks(bs => bs.map(b => ({ ...b, selected: true })))}>
              <Text className="text-xs text-brand-500 font-medium">Select all</Text>
            </Pressable>
            <Pressable onPress={() => setBooks(bs => bs.map(b => ({ ...b, selected: false })))}>
              <Text className="text-xs text-gray-400 font-medium">Deselect all</Text>
            </Pressable>
          </View>
        </View>

        <ScrollView className="flex-1 px-5">
          {books.map(book => (
            <Pressable
              key={book.id}
              onPress={() => setBooks(bs => bs.map(b => b.id === book.id ? { ...b, selected: !b.selected } : b))}
              className="flex-row items-center py-3 border-b border-gray-50"
            >
              <View className={`w-5 h-5 rounded border-2 mr-3 items-center justify-center ${
                book.selected ? 'bg-brand-500 border-brand-500' : 'border-gray-300'
              }`}>
                {book.selected && <FontAwesome5 name="check" size={9} color="white" solid />}
              </View>
              <View className="flex-1">
                <Text className="text-sm font-medium text-gray-800" numberOfLines={1}>{book.title}</Text>
                <Text className="text-xs text-gray-500">{book.author}</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>

        <View className="px-5 py-4 border-t border-gray-100">
          <Pressable
            onPress={startImport}
            disabled={selectedCount === 0}
            className={`rounded-xl py-3.5 items-center ${selectedCount === 0 ? 'bg-gray-200' : 'bg-brand-500'}`}
          >
            <Text className={`font-semibold ${selectedCount === 0 ? 'text-gray-400' : 'text-white'}`}>
              Import {selectedCount} book{selectedCount !== 1 ? 's' : ''}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (phase === 'importing') {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <ActivityIndicator color="#db2777" size="large" />
        <Text className="text-gray-800 font-semibold mt-4 text-center">
          Adding book {progress} of {importTotal}...
        </Text>
        <Text className="text-gray-500 text-sm mt-2 text-center">
          Looking up cover art and details for each book
        </Text>
      </View>
    );
  }

  if (phase === 'done' && result) {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-5xl mb-4">🎉</Text>
        <Text className="text-xl font-bold text-gray-800 mb-2">Import complete!</Text>
        <Text className="text-gray-600 text-center">
          Added {result.added} book{result.added !== 1 ? 's' : ''} to your wishlist.
        </Text>
        {result.skipped > 0 && (
          <Text className="text-gray-400 text-sm text-center mt-1">
            {result.skipped} book{result.skipped !== 1 ? 's' : ''} could not be imported.
          </Text>
        )}
      </View>
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// NYT Best Sellers tab
// ---------------------------------------------------------------------------

function NYTListsTab({ onSaved }: { onSaved: () => void }) {
  const [selectedList, setSelectedList] = useState(NYT_LISTS[0].encoded);
  const [books, setBooks] = useState<NYTBook[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState<string | null>(null);

  useEffect(() => {
    loadBooks();
  }, [selectedList]);

  async function loadBooks() {
    setLoading(true);
    setError(null);
    try {
      setBooks(await getNYTListBooks(selectedList));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function addNYTBook(book: NYTBook) {
    const key = book.isbn13 || book.title;
    setAdding(key);
    try {
      const match = await findBestMatch(book.title, book.author, book.isbn13 || undefined);

      if (match) {
        await saveBookToWishlist({
          title: match.title,
          author: match.author,
          authorFirstName: match.authorFirstName,
          genre: match.genre,
          pageCount: match.pageCount,
          coverUrl: match.coverUrl,
          googleBooksId: match.id,
        });
      } else {
        await saveBookToWishlist({
          title: book.title,
          author: book.author,
          authorFirstName: book.author.split(' ')[0],
          coverUrl: book.coverUrl,
        });
      }

      setAddedIds(prev => new Set([...prev, key]));
      onSaved();
    } catch (e) {
      Alert.alert('Error', String(e));
    } finally {
      setAdding(null);
    }
  }

  if (!process.env.EXPO_PUBLIC_NYT_API_KEY) {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <FontAwesome5 name="newspaper" size={32} color="#d1a090" />
        <Text className="text-gray-800 font-semibold text-center mt-4 mb-2">
          NYT API key not configured
        </Text>
        <Text className="text-gray-500 text-sm text-center">
          Add EXPO_PUBLIC_NYT_API_KEY to your .env file.{'\n'}
          Get a free key at developer.nytimes.com
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="border-b border-gray-100 py-3 max-h-14"
        contentContainerStyle={{ paddingHorizontal: 20, gap: 8, alignItems: 'center' }}
      >
        {NYT_LISTS.map(list => (
          <Pressable
            key={list.encoded}
            onPress={() => setSelectedList(list.encoded)}
            className={`px-4 py-1.5 rounded-full ${
              selectedList === list.encoded ? 'bg-brand-500' : 'bg-cream-200'
            }`}
          >
            <Text className={`text-sm font-medium ${
              selectedList === list.encoded ? 'text-white' : 'text-gray-600'
            }`}>
              {list.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#db2777" />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-gray-500 text-center text-sm">{error}</Text>
          <Pressable onPress={loadBooks} className="mt-3">
            <Text className="text-brand-500 font-medium">Try again</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView className="flex-1 px-5 pt-3">
          {books.map(book => {
            const key = book.isbn13 || book.title;
            const isAdded = addedIds.has(key);
            const isAdding = adding === key;

            return (
              <BookCard
                key={key}
                title={book.title}
                author={book.author}
                coverUrl={book.coverUrl}
                rightElement={
                  isAdding ? (
                    <ActivityIndicator color="#db2777" size="small" />
                  ) : isAdded ? (
                    <View className="bg-green-50 rounded-lg px-2 py-1">
                      <View className="flex-row items-center gap-1">
                        <FontAwesome5 name="check" size={9} color="#16a34a" solid />
                        <Text className="text-green-600 text-xs font-medium">Added</Text>
                      </View>
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => addNYTBook(book)}
                      className="bg-brand-500 rounded-lg px-2 py-1.5"
                    >
                      <Text className="text-white text-xs font-medium">Add</Text>
                    </Pressable>
                  )
                }
              />
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}
