import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  Pressable,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { supabase, Book, BookLog, Rating, Member } from '../../lib/supabase';
import { generateDiscussionGuide, inferGenre, DiscussionGuide } from '../../lib/claude';
import { searchBooks } from '../../lib/googleBooks';
import { getLengthBucket } from '../../constants/genres';
import { RatingInput } from '../../components/RatingInput';
import { DatePickerField } from '../../components/DatePickerField';
import { BookPreviewModal, PreviewableBook } from '../../components/BookPreviewModal';
import { getBookById } from '../../lib/googleBooks';
import { BOOK_SOURCES, SOURCE_CATEGORIES, openSource } from '../../lib/bookSources';

type FullBook = Book & {
  book_log?: (BookLog & { ratings?: Rating[] })[];
};

export default function BookDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [book, setBook] = useState<FullBook | null>(null);
  const [guide, setGuide] = useState<DiscussionGuide | null>(null);
  const [guideLoading, setGuideLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [ratingDrafts, setRatingDrafts] = useState<Record<string, string>>({});
  const [savingMember, setSavingMember] = useState<string | null>(null);
  const [ratingsExpanded, setRatingsExpanded] = useState(false);
  const [previewBook, setPreviewBook] = useState<PreviewableBook | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    loadBook();
  }, [id]);

  async function loadBook() {
    setLoading(true);
    const [bookRes, guideRes, membersRes] = await Promise.all([
      supabase
        .from('books')
        .select('*, book_log(*, ratings(*))')
        .eq('id', id)
        .single(),
      supabase
        .from('discussion_guides')
        .select('*')
        .eq('book_id', id)
        .maybeSingle(),
      supabase.from('members').select('*').order('name'),
    ]);

    const bookData = bookRes.data as FullBook;
    setBook(bookData);
    const allMembers = (membersRes.data ?? []) as Member[];
    setMembers(allMembers);

    // Initialise rating drafts from existing ratings
    const existingRatings = bookData?.book_log?.[0]?.ratings ?? [];
    const drafts: Record<string, string> = {};
    allMembers.forEach((m) => {
      const found = existingRatings.find((r) => r.member_name === m.name);
      drafts[m.name] = found ? String(found.score) : '';
    });
    setRatingDrafts(drafts);

    if (guideRes.data) {
      setGuide({
        questions: guideRes.data.questions ?? [],
        themes: guideRes.data.themes ?? [],
        authorNote: guideRes.data.author_note ?? '',
        quotesPrompt: guideRes.data.quotes_prompt ?? '',
      });
    }
    setLoading(false);
  }

  async function autoSaveRating(memberName: string, value: string) {
    const logEntry = book?.book_log?.[0];
    if (!logEntry) return;
    setSavingMember(memberName);
    try {
      await supabase.from('ratings')
        .delete()
        .eq('book_log_id', logEntry.id)
        .eq('member_name', memberName);
      const score = parseFloat(value);
      if (!isNaN(score) && score >= 1 && score <= 10) {
        await supabase.from('ratings')
          .insert({ book_log_id: logEntry.id, member_name: memberName, score });
        setBook((prev) => {
          if (!prev?.book_log?.[0]) return prev;
          const existing = (prev.book_log[0].ratings ?? []).filter((r) => r.member_name !== memberName);
          existing.push({ id: '', book_log_id: logEntry.id, member_name: memberName, score, created_at: '' });
          return { ...prev, book_log: [{ ...prev.book_log[0], ratings: existing }] };
        });
      } else {
        setBook((prev) => {
          if (!prev?.book_log?.[0]) return prev;
          const updated = (prev.book_log[0].ratings ?? []).filter((r) => r.member_name !== memberName);
          return { ...prev, book_log: [{ ...prev.book_log[0], ratings: updated }] };
        });
      }
    } catch (e) {
      Alert.alert('Save failed', String(e));
    } finally {
      setSavingMember(null);
    }
  }

  async function openPreview() {
    if (!book) return;
    setPreviewLoading(true);
    try {
      if (book.google_books_id) {
        const gb = await getBookById(book.google_books_id);
        if (gb) {
          setPreviewBook(gb);
          return;
        }
      }
      // Fallback to DB data (no description/publisher)
      setPreviewBook({
        title: book.title,
        author: book.author,
        coverUrl: book.cover_url,
        genre: book.genre,
        pageCount: book.page_count,
      });
    } catch {
      setPreviewBook({
        title: book.title,
        author: book.author,
        coverUrl: book.cover_url,
        genre: book.genre,
        pageCount: book.page_count,
      });
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleGenerateGuide() {
    if (!book) return;
    setGuideLoading(true);
    try {
      const newGuide = await generateDiscussionGuide(book.title, book.author, book.genre);
      setGuide(newGuide);
      await supabase.from('discussion_guides').upsert({
        book_id: book.id,
        questions: newGuide.questions,
        themes: newGuide.themes,
        author_note: newGuide.authorNote,
        quotes_prompt: newGuide.quotesPrompt,
      }, { onConflict: 'book_id' });
    } catch (e) {
      Alert.alert('Generation failed', String(e));
    } finally {
      setGuideLoading(false);
    }
  }

  function avgRating(): string {
    const log = book?.book_log?.[0];
    if (!log?.ratings || log.ratings.length === 0) return '—';
    const sum = log.ratings.reduce((a, r) => a + r.score, 0);
    return (sum / log.ratings.length).toFixed(1);
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-cream-100">
        <ActivityIndicator color="#db2777" size="large" />
      </View>
    );
  }

  if (!book) {
    return (
      <View className="flex-1 items-center justify-center bg-cream-100">
        <Text className="text-gray-500">Book not found</Text>
      </View>
    );
  }

  const bucket = getLengthBucket(book.page_count);
  const logEntry = book.book_log?.[0];

  return (
    <ScrollView className="flex-1 bg-cream-100">
      {/* Hero */}
      <View className="bg-brand-500 px-5 pt-12 pb-8 items-center">
        {book.cover_url ? (
          <Image
            source={{ uri: book.cover_url }}
            style={{ width: 110, height: 160, borderRadius: 12 }}
            resizeMode="cover"
          />
        ) : (
          <View
            className="bg-white/20 rounded-xl items-center justify-center"
            style={{ width: 110, height: 160 }}
          >
            <Text className="text-5xl">📚</Text>
          </View>
        )}
        <Text className="text-white text-xl font-bold mt-4 text-center px-4">
          {book.title}
        </Text>
        <Text className="text-brand-200 text-sm mt-1">{book.author}</Text>
        <View className="flex-row gap-3 mt-4">
          {book.genre && (
            <View className="bg-white/20 rounded-full px-3 py-1">
              <Text className="text-white text-xs">{book.genre}</Text>
            </View>
          )}
          {!!book.page_count && (
            <View className="bg-white/20 rounded-full px-3 py-1">
              <Text className="text-white text-xs">{book.page_count}p · {bucket}</Text>
            </View>
          )}
        </View>
      </View>

      <View className="px-5 pt-5">
        {/* Stats row */}
        <View className="flex-row gap-3 mb-3">
          <StatCard value={avgRating()} label="Club Rating" emoji="⭐" suffix="/10" />
          <StatCard value={book.page_count ? `${book.page_count}` : '—'} label="Pages" emoji="📄" suffix="" />
          <StatCard value={book.author_gender ?? 'unknown'} label="Author" emoji="👤" suffix="" />
        </View>
        <Pressable
          onPress={openPreview}
          disabled={previewLoading}
          className="flex-row items-center justify-center gap-1.5 bg-cream-50 border border-cream-300 rounded-xl py-2 mb-5"
        >
          {previewLoading
            ? <ActivityIndicator size="small" color="#C4614A" />
            : <>
                <FontAwesome5 name="info-circle" size={13} color="#C4614A" solid />
                <Text className="text-brand-600 text-sm font-medium">More Info</Text>
              </>
          }
        </Pressable>

        {/* Where to Find It */}
        <View className="bg-cream-50 rounded-2xl p-4 mb-4" style={{ shadowColor: '#8c3e2e', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 }}>
          <Text className="text-gray-800 font-semibold mb-3">Where to Find It</Text>
          {SOURCE_CATEGORIES.map(cat => {
            const sources = BOOK_SOURCES.filter(s => s.category === cat.key);
            return (
              <View key={cat.key} className="mb-3 last:mb-0">
                <Text className="text-xs text-gray-400 font-medium mb-2 uppercase tracking-wide">
                  {cat.emoji}  {cat.label}
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {sources.map(source => (
                    <Pressable
                      key={source.id}
                      onPress={() => openSource(source, book.title, book.author)}
                      className="flex-row items-center gap-1.5 rounded-xl px-3 py-2 border border-gray-100"
                      style={{ backgroundColor: source.bgColor }}
                    >
                      <FontAwesome5
                        name={source.icon}
                        size={11}
                        color={source.iconColor}
                        {...(source.iconIsBrand ? {} : { solid: true })}
                      />
                      <View>
                        <Text className="text-xs font-semibold" style={{ color: source.iconColor }}>
                          {source.name}
                        </Text>
                        <Text className="text-xs" style={{ color: source.iconColor, opacity: 0.7 }}>
                          {source.subtitle}
                        </Text>
                      </View>
                      <FontAwesome5 name="external-link-alt" size={8} color={source.iconColor} solid style={{ opacity: 0.5 }} />
                    </Pressable>
                  ))}
                </View>
              </View>
            );
          })}
        </View>

        {/* Ratings */}
        {!!logEntry && (
          <View className="bg-cream-50 rounded-2xl mb-4" style={{ shadowColor: '#8c3e2e', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 }}>
            <Pressable
              onPress={() => setRatingsExpanded((v) => !v)}
              className="flex-row items-center justify-between px-4 py-3"
            >
              <Text className="text-gray-800 font-semibold">Member Ratings</Text>
              <Text className="text-gray-400 text-2xl">{ratingsExpanded ? '▲' : '▼'}</Text>
            </Pressable>
            {!!ratingsExpanded && (
              <View className="px-4 pb-4 border-t border-cream-200">
                {members.map((m) => (
                  <RatingInput
                    key={m.id}
                    memberName={m.name}
                    score={ratingDrafts[m.name] ?? ''}
                    onScoreChange={(v) => setRatingDrafts((prev) => ({ ...prev, [m.name]: v }))}
                    onBlur={() => autoSaveRating(m.name, ratingDrafts[m.name] ?? '')}
                    saving={savingMember === m.name}
                  />
                ))}
              </View>
            )}
          </View>
        )}

        {/* Meeting info */}
        {logEntry && (
          <View className="bg-cream-50 rounded-2xl p-4 mb-4" style={{ shadowColor: '#8c3e2e', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 }}>
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-gray-800 font-semibold">Meeting Details</Text>
              <Pressable
                onPress={() => setShowEditModal(true)}
                className="bg-brand-50 rounded-lg px-3 py-1.5"
              >
                <Text className="text-brand-600 text-xs font-medium">✏️ Edit</Text>
              </Pressable>
            </View>
            {logEntry.date_read ? (
              <Text className="text-gray-600 text-sm">📅 Date: {logEntry.date_read}</Text>
            ) : (
              <Text className="text-gray-400 text-sm italic">No date set</Text>
            )}
            {logEntry.meeting_location ? (
              <Text className="text-gray-600 text-sm mt-1">📍 {logEntry.meeting_location}</Text>
            ) : (
              <Text className="text-gray-400 text-sm italic mt-1">No location set</Text>
            )}
          </View>
        )}

        {/* Discussion Guide */}
        <View className="bg-cream-50 rounded-2xl p-4 mb-8" style={{ shadowColor: '#8c3e2e', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 }}>
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-gray-800 font-semibold">Discussion Guide</Text>
            <Pressable
              onPress={handleGenerateGuide}
              disabled={guideLoading}
              className={`rounded-xl px-3 py-2 ${guide ? 'border border-brand-300' : 'bg-brand-500'}`}
            >
              {guideLoading ? (
                <ActivityIndicator color={guide ? '#db2777' : 'white'} size="small" />
              ) : (
                <Text className={`text-xs font-semibold ${guide ? 'text-brand-600' : 'text-white'}`}>
                  {guide ? '🔄 Regenerate' : '✨ Generate with AI'}
                </Text>
              )}
            </Pressable>
          </View>

          {!guide ? (
            <Text className="text-gray-400 text-sm">
              Tap "Generate with AI" to create a discussion guide powered by Claude.
            </Text>
          ) : (
            <>
              {guide.authorNote && (
                <View className="bg-brand-50 rounded-xl p-3 mb-4">
                  <Text className="text-brand-800 text-xs leading-5">{guide.authorNote}</Text>
                </View>
              )}
              {guide.themes.length > 0 && (
                <View className="mb-4">
                  <Text className="text-gray-700 font-medium text-sm mb-2">Key Themes</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {guide.themes.map((theme, i) => (
                      <View key={i} className="bg-brand-50 rounded-full px-3 py-1" style={{ flexShrink: 1 }}>
                        <Text className="text-brand-700 text-xs">{theme}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
              {guide.questions.length > 0 && (
                <View className="mb-4">
                  <Text className="text-gray-700 font-medium text-sm mb-2">Discussion Questions</Text>
                  {guide.questions.map((q, i) => (
                    <View key={i} className="flex-row mb-3">
                      <View className="w-6 h-6 rounded-full bg-brand-100 items-center justify-center mr-3 mt-0.5 shrink-0">
                        <Text className="text-brand-700 text-xs font-bold">{i + 1}</Text>
                      </View>
                      <Text className="text-gray-700 text-sm leading-5 flex-1">{q}</Text>
                    </View>
                  ))}
                </View>
              )}
              {guide.quotesPrompt && (
                <View className="bg-cream-100 rounded-xl p-3">
                  <Text className="text-gray-500 text-xs leading-5 italic">
                    "{guide.quotesPrompt}"
                  </Text>
                </View>
              )}
            </>
          )}
        </View>
      </View>

      <BookPreviewModal book={previewBook} onClose={() => setPreviewBook(null)} />

      {showEditModal && logEntry && (
        <EditLogModal
          logEntry={logEntry}
          book={book}
          onClose={() => setShowEditModal(false)}
          onSaved={() => {
            setShowEditModal(false);
            loadBook();
          }}
        />
      )}
    </ScrollView>
  );
}

function EditLogModal({
  logEntry,
  book,
  onClose,
  onSaved,
}: {
  logEntry: BookLog & { ratings?: Rating[] };
  book: FullBook;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [dateRead, setDateRead] = useState(logEntry.date_read ?? '');
  const [location, setLocation] = useState(logEntry.meeting_location ?? '');
  const [genre, setGenre] = useState(book.genre ?? '');
  const [genreFetching, setGenreFetching] = useState(false);
  const [saving, setSaving] = useState(false);

  async function fetchGenre() {
    setGenreFetching(true);
    try {
      const results = await searchBooks(book.title, 3);
      const match = results.find(
        (r) => r.title.toLowerCase() === book.title.toLowerCase()
      ) ?? results[0];
      const inferred = await inferGenre(book.title, book.author, match?.description ?? null);
      if (inferred) {
        setGenre(inferred);
      } else {
        Alert.alert('Not found', 'Could not infer a genre for this book.');
      }
    } catch (e) {
      Alert.alert('Fetch failed', String(e));
    } finally {
      setGenreFetching(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await supabase
        .from('book_log')
        .update({ date_read: dateRead || null, meeting_location: location || null })
        .eq('id', logEntry.id);

      await supabase
        .from('books')
        .update({ genre: genre || null })
        .eq('id', book.id);

      onSaved();
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
          <Text className="text-lg font-bold text-gray-900">Edit Entry</Text>
          <Pressable onPress={onClose}>
            <Text className="text-brand-500 font-medium">Cancel</Text>
          </Pressable>
        </View>

        <ScrollView className="flex-1 px-5 pt-4">
          <Text className="text-gray-700 text-sm font-medium mb-1">Genre</Text>
          <View className="flex-row gap-2 mb-4">
            <TextInput
              value={genre}
              onChangeText={setGenre}
              placeholder="e.g. Literary Fiction"
              placeholderTextColor="#9ca3af"
              className="flex-1 bg-cream-100 border border-cream-300 rounded-xl px-4 py-3 text-sm text-[#3a2218]"
            />
            <Pressable
              onPress={fetchGenre}
              disabled={genreFetching}
              className="bg-brand-50 border border-brand-200 rounded-xl px-3 items-center justify-center"
            >
              {genreFetching
                ? <ActivityIndicator color="#db2777" size="small" />
                : <Text className="text-brand-600 text-xs font-medium">Auto{'\n'}Fetch</Text>
              }
            </Pressable>
          </View>

          <DatePickerField
            label="Date"
            value={dateRead}
            onChange={setDateRead}
            placeholder="Select a date"
          />

          <Text className="text-gray-700 text-sm font-medium mb-1">Meeting Location</Text>
          <TextInput
            value={location}
            onChangeText={setLocation}
            placeholder="e.g. Sarah's house"
            placeholderTextColor="#9ca3af"
            className="bg-cream-100 border border-cream-300 rounded-xl px-4 py-3 text-sm text-[#3a2218] mb-4"
          />

          <Pressable
            onPress={handleSave}
            disabled={saving}
            className="bg-brand-500 rounded-2xl py-4 items-center mt-6 mb-8"
          >
            {saving ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-semibold text-base">Save Changes</Text>
            )}
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

function StatCard({
  value, label, emoji, suffix,
}: {
  value: string; label: string; emoji: string; suffix: string;
}) {
  return (
    <View className="flex-1 bg-white rounded-2xl p-3 items-center border border-gray-100">
      <Text className="text-base">{emoji}</Text>
      <Text className="text-gray-900 font-bold text-sm mt-1">{value}{suffix}</Text>
      <Text className="text-gray-400 text-xs">{label}</Text>
    </View>
  );
}
