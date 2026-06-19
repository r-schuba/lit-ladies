import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { supabase, BookLog, Member } from '../../lib/supabase';
import { searchBooks, GoogleBook } from '../../lib/googleBooks';
import { inferGenre } from '../../lib/claude';
import { getAuthorGender } from '../../lib/genderize';
import { BookCard } from '../../components/BookCard';
import { SearchBar } from '../../components/SearchBar';
import { RatingInput } from '../../components/RatingInput';
import { EmptyState } from '../../components/EmptyState';
import { ScreenHeader } from '../../components/ScreenHeader';
import { DatePickerField } from '../../components/DatePickerField';

// Simple bar chart using pure RN views
function SimpleBarChart({ data }: { data: { label: string; value: number }[] }) {
  if (data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
      <View style={{ flexDirection: 'row', gap: 16, paddingHorizontal: 8 }}>
        {data.map((d) => (
          <View key={d.label} style={{ width: 88, alignItems: 'center' }}>
            {/* Fixed-height bar area — all bars grow upward from the same baseline */}
            <View style={{ height: 140, justifyContent: 'flex-end', alignItems: 'center' }}>
              <Text style={{ fontSize: 11, color: '#374151', fontWeight: '500', marginBottom: 4 }}>
                {d.value.toFixed(1)}
              </Text>
              <View style={{ width: 44, height: Math.max(12, (d.value / max) * 100), backgroundColor: '#df8256', borderRadius: 4 }} />
            </View>
            {/* Fixed-height label area below */}
            <View style={{ height: 56, paddingTop: 6 }}>
              <Text style={{ fontSize: 11, color: '#6b7280', textAlign: 'center', width: 88 }} numberOfLines={3}>
                {d.label}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

export default function LogScreen() {
  const router = useRouter();
  const [logs, setLogs] = useState<BookLog[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [tab, setTab] = useState<'list' | 'charts'>('list');
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [refreshingGenres, setRefreshingGenres] = useState(false);
  const [genreProgress, setGenreProgress] = useState('');

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  async function loadData() {
    setLoading(true);
    const [logRes, memberRes] = await Promise.all([
      supabase
        .from('book_log')
        .select('*, book:books(*), ratings(*)')
        .order('date_read', { ascending: false }),
      supabase.from('members').select('*').order('name'),
    ]);
    setLogs((logRes.data ?? []) as BookLog[]);
    setMembers((memberRes.data ?? []) as Member[]);
    setLoading(false);
  }

  async function refreshAllGenres() {
    setRefreshingGenres(true);
    const books = logs.map((l) => l.book).filter(Boolean) as NonNullable<BookLog['book']>[];
    let updated = 0;
    for (const book of books) {
      setGenreProgress(book.title.length > 24 ? book.title.slice(0, 24) + '…' : book.title);
      try {
        const results = await searchBooks(book.title, 3);
        const match = results.find(
          (r) => r.title.toLowerCase() === book.title.toLowerCase()
        ) ?? results[0];
        const genre = await inferGenre(book.title, book.author, match?.description ?? null);
        console.log(`[genre] "${book.title}" → ${genre}`);
        if (genre) {
          const { error } = await supabase.from('books').update({ genre }).eq('id', book.id);
          if (error) console.error(`[genre] supabase error for "${book.title}":`, error.message);
          else updated++;
        }
      } catch (e) {
        console.error(`[genre] failed for "${book.title}":`, e);
      }
    }
    setRefreshingGenres(false);
    setGenreProgress('');
    Alert.alert('Done!', `Updated genres for ${updated} of ${books.length} books.`);
    loadData();
  }

  async function deleteLog(entryId: string) {
    await supabase.from('book_log').delete().eq('id', entryId);
    setLogs((prev) => prev.filter((l) => l.id !== entryId));
    setConfirmingDelete(null);
  }

  function avgRating(entry: BookLog): number | null {
    if (!entry.ratings || entry.ratings.length === 0) return null;
    return entry.ratings.reduce((a, r) => a + r.score, 0) / entry.ratings.length;
  }

  // Chart data: avg rating per book
  const bookChartData = logs
    .map((entry) => ({
      label: (() => {
        const t = entry.book?.title ?? '';
        if (t.length <= 20) return t;
        const cut = t.slice(0, 20);
        const lastSpace = cut.lastIndexOf(' ');
        return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut) + '…';
      })(),
      value: avgRating(entry) ?? 0,
    }))
    .filter((d) => d.value > 0)
    .reverse();

  // Chart data: avg rating by member
  const memberMap: Record<string, number[]> = {};
  for (const entry of logs) {
    for (const r of entry.ratings ?? []) {
      if (!memberMap[r.member_name]) memberMap[r.member_name] = [];
      memberMap[r.member_name].push(r.score);
    }
  }
  const memberChartData = Object.entries(memberMap)
    .map(([label, scores]) => ({ label, value: scores.reduce((a, b) => a + b, 0) / scores.length }))
    .sort((a, b) => b.value - a.value);

  // Chart data: avg rating by genre
  const genreMap: Record<string, number[]> = {};
  for (const entry of logs) {
    const genre = entry.book?.genre ?? 'Unknown';
    const rating = avgRating(entry);
    if (rating !== null) {
      if (!genreMap[genre]) genreMap[genre] = [];
      genreMap[genre].push(rating);
    }
  }
  const genreChartData = Object.entries(genreMap).map(([label, scores]) => ({
    label,
    value: scores.reduce((a, b) => a + b, 0) / scores.length,
  }));

  return (
    <View className="flex-1 bg-cream-100">
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <ScreenHeader
          title="Book Log"
          subtitle={`${logs.length} books read`}
          right={
            <Pressable
              onPress={() => setShowAddModal(true)}
              className="bg-brand-500 rounded-xl px-4 py-2 flex-row items-center gap-1.5"
            >
              <FontAwesome5 name="plus" size={11} color="white" solid />
              <Text className="text-white font-semibold text-sm">Add</Text>
            </Pressable>
          }
        />


        {/* Tabs */}
        <View className="flex-row bg-cream-200 rounded-xl p-1 mb-4">
          {(['list', 'charts'] as const).map((t) => (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              className={`flex-1 rounded-lg py-2 items-center ${
                tab === t ? 'bg-white shadow-sm' : ''
              }`}
            >
              <View className="flex-row items-center gap-1.5">
                <FontAwesome5
                  name={t === 'list' ? 'list' : 'chart-bar'}
                  size={12}
                  color={tab === t ? '#a84f3c' : '#9a7060'}
                  solid
                />
                <Text className={`text-sm font-medium ${tab === t ? 'text-brand-600' : 'text-[#9a7060]'}`}>
                  {t === 'list' ? 'List' : 'Charts'}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator color="#db2777" className="mt-8" />
        ) : tab === 'list' ? (
          logs.length === 0 ? (
            <EmptyState
              icon="book-open"
              title="No books logged yet"
              subtitle="Tap Add to log your first book!"
            />
          ) : (
            logs.map((entry) => (
              <BookCard
                key={entry.id}
                title={entry.book?.title ?? ''}
                author={entry.book?.author ?? ''}
                coverUrl={entry.book?.cover_url}
                genre={entry.book?.genre}
                pageCount={entry.book?.page_count}
                onPress={() => router.push(`/book/${entry.book_id}`)}
                rightElement={
                  <View className="items-end gap-1">
                    {avgRating(entry) !== null && (
                      <View className="bg-brand-50 rounded-xl px-2 py-1 items-center">
                        <View className="flex-row items-center gap-1">
                          <FontAwesome5 name="star" size={10} color="#a84f3c" solid />
                          <Text className="text-brand-700 font-bold text-sm">
                            {avgRating(entry)!.toFixed(1)}
                          </Text>
                        </View>
                        <Text className="text-brand-400 text-xs text-center">club avg</Text>
                      </View>
                    )}
                    <Text className="text-gray-400 text-xs">{entry.date_read ?? ''}</Text>
                    {confirmingDelete === entry.id ? (
                      <Pressable
                        onPress={(e) => { e.stopPropagation(); deleteLog(entry.id); }}
                        className="bg-red-500 rounded-lg px-2 py-1 mt-1 flex-row items-center gap-1"
                      >
                        <FontAwesome5 name="check" size={10} color="white" solid />
                        <Text className="text-white text-xs font-medium">Confirm</Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        onPress={(e) => { e.stopPropagation(); setConfirmingDelete(entry.id); }}
                        className="bg-red-50 rounded-lg px-2 py-1 mt-1"
                      >
                        <FontAwesome5 name="trash-alt" size={12} color="#ef4444" solid />
                      </Pressable>
                    )}
                  </View>
                }
              />
            ))
          )
        ) : (
          <View>
            {bookChartData.length === 0 ? (
              <EmptyState icon="chart-bar" title="No chart data yet" subtitle="Log books with ratings to see charts" />
            ) : (
              <>
                <Text className="text-[#3a2218] font-semibold mb-2">Avg Rating per Book</Text>
                <SimpleBarChart data={bookChartData} />
                {memberChartData.length > 0 && (
                  <>
                    <Text className="text-[#3a2218] font-semibold mb-2 mt-2">Avg Rating by Member</Text>
                    <SimpleBarChart data={memberChartData} />
                  </>
                )}
                {genreChartData.length > 0 && (
                  <>
                    <Text className="text-[#3a2218] font-semibold mb-2 mt-2">Avg Rating by Genre</Text>
                    <SimpleBarChart data={genreChartData} />
                  </>
                )}
              </>
            )}
          </View>
        )}
      </ScrollView>

      {showAddModal && (
        <AddBookModal
          members={members}
          onClose={() => setShowAddModal(false)}
          onSaved={(bookId: string) => {
            setShowAddModal(false);
            loadData();
            router.push(`/book/${bookId}`);
          }}
        />
      )}
    </View>
  );
}

function AddBookModal({
  members,
  onClose,
  onSaved,
}: {
  members: Member[];
  onClose: () => void;
  onSaved: (bookId: string) => void;
}) {
  const [step, setStep] = useState<'search' | 'ratings'>('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GoogleBook[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedBook, setSelectedBook] = useState<GoogleBook | null>(null);
  const [dateRead, setDateRead] = useState(new Date().toISOString().split('T')[0]);
  const [meetingLocation, setMeetingLocation] = useState('');
  const [ratings, setRatings] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

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

  function selectBook(book: GoogleBook) {
    setSelectedBook(book);
    // Initialize ratings for all members
    const init: Record<string, string> = {};
    members.forEach((m) => (init[m.name] = ''));
    setRatings(init);
    setStep('ratings');
  }

  async function handleSave() {
    if (!selectedBook) return;
    setSaving(true);
    try {
      // Detect author gender
      const gender = await getAuthorGender(selectedBook.authorFirstName);

      // Upsert book
      const { data: bookData, error: bookErr } = await supabase
        .from('books')
        .upsert(
          {
            title: selectedBook.title,
            author: selectedBook.author,
            author_gender: gender,
            genre: selectedBook.genre,
            page_count: selectedBook.pageCount,
            cover_url: selectedBook.coverUrl,
            google_books_id: selectedBook.id,
          },
          { onConflict: 'google_books_id' }
        )
        .select()
        .single();

      if (bookErr || !bookData) throw bookErr ?? new Error('Failed to save book');

      // Create log entry
      const { data: logData, error: logErr } = await supabase
        .from('book_log')
        .insert({
          book_id: bookData.id,
          date_read: dateRead || null,
          meeting_location: meetingLocation || null,
        })
        .select()
        .single();

      if (logErr || !logData) throw logErr ?? new Error('Failed to save log');

      // Insert ratings
      const validRatings = Object.entries(ratings)
        .filter(([, v]) => v.trim() !== '')
        .map(([member_name, score]) => ({
          book_log_id: logData.id,
          member_name,
          score: parseFloat(score),
        }))
        .filter((r) => !isNaN(r.score) && r.score >= 1 && r.score <= 10);

      if (validRatings.length > 0) {
        await supabase.from('ratings').insert(validRatings);
      }

      onSaved(bookData.id);
    } catch (e) {
      Alert.alert('Save failed', String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <View className="flex-1 bg-cream-50">
        <View className="flex-row items-center justify-between px-5 pt-6 pb-4 border-b border-gray-100">
          <Text className="text-lg font-bold text-gray-900">
            {step === 'search' ? 'Search Book' : 'Add Ratings'}
          </Text>
          <Pressable onPress={onClose}>
            <Text className="text-brand-500 font-medium">Cancel</Text>
          </Pressable>
        </View>

        <ScrollView className="flex-1 px-5 pt-4">
          {step === 'search' ? (
            <>
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
                  onPress={() => selectBook(book)}
                  rightElement={
                    <Text className="text-brand-500 text-xs font-medium">Select</Text>
                  }
                />
              ))}
            </>
          ) : (
            <>
              <Text className="text-gray-900 font-semibold mb-1">{selectedBook?.title}</Text>
              <Text className="text-gray-500 text-sm mb-4">{selectedBook?.author}</Text>

              <DatePickerField
                label="Date Read"
                value={dateRead}
                onChange={setDateRead}
                placeholder="Select a date"
              />

              <Text className="text-gray-700 text-sm font-medium mb-1">Meeting Location</Text>
              <TextInput
                value={meetingLocation}
                onChangeText={setMeetingLocation}
                placeholder="e.g. Sarah's house"
                placeholderTextColor="#9ca3af"
                className="bg-cream-100 border border-cream-300 rounded-xl px-4 py-3 text-sm text-[#3a2218] mb-4"
              />

              <Text className="text-gray-700 text-sm font-medium mb-2">Member Ratings (1–10)</Text>
              {members.length === 0 ? (
                <Text className="text-gray-400 text-sm">No members added yet. Add members first.</Text>
              ) : (
                members.map((m) => (
                  <RatingInput
                    key={m.id}
                    memberName={m.name}
                    score={ratings[m.name] ?? ''}
                    onScoreChange={(v) => setRatings((prev) => ({ ...prev, [m.name]: v }))}
                  />
                ))
              )}

              <Pressable
                onPress={handleSave}
                disabled={saving}
                className="bg-brand-500 rounded-2xl py-4 items-center mt-6 mb-8"
              >
                {saving ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white font-semibold text-base">Save to Log</Text>
                )}
              </Pressable>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
