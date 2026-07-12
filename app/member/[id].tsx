import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  Image,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase, Member, MemberFavoriteBook, Book, BookLog } from '../../lib/supabase';
import { generateBookPersonality } from '../../lib/claude';
import { searchBooks, GoogleBook } from '../../lib/googleBooks';
import { getAuthorGender } from '../../lib/genderize';
import { BookCard } from '../../components/BookCard';
import { SearchBar } from '../../components/SearchBar';

type RatingRow = {
  id: string;
  score: number;
  book_log: {
    id: string;
    book: Book | null;
  } | null;
};

export default function MemberProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [member, setMember] = useState<Member | null>(null);
  const [ratings, setRatings] = useState<RatingRow[]>([]);
  const [favorites, setFavorites] = useState<MemberFavoriteBook[]>([]);
  const [meetingsAttended, setMeetingsAttended] = useState(0);
  const [loading, setLoading] = useState(true);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [personalityLoading, setPersonalityLoading] = useState(false);
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [logs, setLogs] = useState<BookLog[]>([]);
  const [showAddFavorites, setShowAddFavorites] = useState(false);
  const [showAddRating, setShowAddRating] = useState(false);
  const [editingRatingId, setEditingRatingId] = useState<string | null>(null);
  const [editingScore, setEditingScore] = useState('');
  const [confirmDeleteRatingId, setConfirmDeleteRatingId] = useState<string | null>(null);

  useEffect(() => {
    loadProfile();
  }, [id]);

  async function loadProfile() {
    setLoading(true);

    // Step 1: fetch member row
    const { data: memberData } = await supabase
      .from('members')
      .select('*')
      .eq('id', id)
      .single();

    if (!memberData) {
      setLoading(false);
      return;
    }
    setMember(memberData as Member);

    // Step 2: parallel fetch ratings + favorites + attendance + book log
    const [ratingsRes, favoritesRes, attendanceRes, logsRes] = await Promise.all([
      supabase
        .from('ratings')
        .select('id, score, book_log:book_log_id(id, book:book_id(*))')
        .eq('member_name', memberData.name),
      supabase
        .from('member_favorite_books')
        .select('*, book:book_id(*)')
        .eq('member_id', id)
        .order('created_at', { ascending: false }),
      supabase
        .from('meeting_attendees')
        .select('book_log_id')
        .eq('member_id', id),
      supabase
        .from('book_log')
        .select('*, book:books(*)')
        .order('date_read', { ascending: false }),
    ]);

    setRatings((ratingsRes.data ?? []) as unknown as RatingRow[]);
    setFavorites((favoritesRes.data ?? []) as MemberFavoriteBook[]);
    setMeetingsAttended((attendanceRes.data ?? []).length);
    setLogs((logsRes.data ?? []) as BookLog[]);
    setLoading(false);
  }

  async function handleGeneratePersonality() {
    if (!member) return;
    setPersonalityLoading(true);
    try {
      const ratingHistory = ratings
        .filter((r) => r.book_log?.book)
        .map((r) => ({ title: r.book_log!.book!.title, score: r.score }));
      const favoriteBookTitles = favorites
        .filter((f) => f.book)
        .map((f) => f.book!.title);

      const personality = await generateBookPersonality(
        member.name,
        ratingHistory,
        favoriteBookTitles
      );

      await supabase
        .from('members')
        .update({ book_personality: personality })
        .eq('id', id);

      setMember((prev) => prev ? { ...prev, book_personality: personality } : prev);
    } catch (e) {
      Alert.alert('Generation failed', String(e));
    } finally {
      setPersonalityLoading(false);
    }
  }

  async function handleSavePhone() {
    if (!member) return;
    const phone = phoneInput.trim() || null;
    await supabase.from('members').update({ phone }).eq('id', id);
    setMember((prev) => prev ? { ...prev, phone } : prev);
    setEditingPhone(false);
  }

  async function handlePickAvatar() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Allow photo access to upload a picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;

    setAvatarUploading(true);
    try {
      const uri = result.assets[0].uri;
      const response = await fetch(uri);
      const blob = await response.blob();
      const path = `${id}/avatar.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('member-avatars')
        .upload(path, blob, { contentType: 'image/jpeg', upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('member-avatars')
        .getPublicUrl(path);

      // Bust cache with timestamp
      const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      await supabase.from('members').update({ avatar_url: avatarUrl }).eq('id', id);
      setMember((prev) => prev ? { ...prev, avatar_url: avatarUrl } : prev);
    } catch (e) {
      Alert.alert('Upload failed', String(e));
    } finally {
      setAvatarUploading(false);
    }
  }

  async function deleteRating(ratingId: string) {
    if (confirmDeleteRatingId === ratingId) {
      await supabase.from('ratings').delete().eq('id', ratingId);
      setRatings((prev) => prev.filter((r) => r.id !== ratingId));
      setConfirmDeleteRatingId(null);
    } else {
      setConfirmDeleteRatingId(ratingId);
    }
  }

  async function saveRating(ratingId: string) {
    const score = parseFloat(editingScore);
    if (isNaN(score) || score < 1 || score > 10) return;
    await supabase.from('ratings').update({ score }).eq('id', ratingId);
    setRatings((prev) => prev.map((r) => r.id === ratingId ? { ...r, score } : r));
    setEditingRatingId(null);
  }

  async function removeFavorite(favId: string) {
    await supabase.from('member_favorite_books').delete().eq('id', favId);
    setFavorites((prev) => prev.filter((f) => f.id !== favId));
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-cream-100">
        <ActivityIndicator color="#db2777" size="large" />
      </View>
    );
  }

  if (!member) {
    return (
      <View className="flex-1 items-center justify-center bg-cream-100">
        <Text className="text-gray-500">Member not found</Text>
      </View>
    );
  }

  const avgRating =
    ratings.length > 0
      ? (ratings.reduce((a, r) => a + r.score, 0) / ratings.length).toFixed(1)
      : '—';

  const initial = member.name.charAt(0).toUpperCase();

  return (
    <ScrollView className="flex-1 bg-cream-100">
      {/* Hero */}
      <View className="bg-brand-500 px-5 pt-12 pb-8 items-center">
        <Pressable onPress={handlePickAvatar} className="mb-4">
          {avatarUploading ? (
            <View
              className="bg-white/30 rounded-full items-center justify-center"
              style={{ width: 80, height: 80 }}
            >
              <ActivityIndicator color="white" />
            </View>
          ) : member.avatar_url ? (
            <View style={{ width: 80, height: 80 }}>
              <Image
                source={{ uri: member.avatar_url }}
                style={{ width: 80, height: 80, borderRadius: 40 }}
                resizeMode="cover"
              />
              <View
                className="absolute bottom-0 right-0 bg-white rounded-full items-center justify-center"
                style={{ width: 24, height: 24 }}
              >
                <FontAwesome5 name="camera" size={10} color="#C4614A" solid />
              </View>
            </View>
          ) : (
            <View
              className="bg-white/30 rounded-full items-center justify-center"
              style={{ width: 80, height: 80 }}
            >
              <Text className="text-white font-bold text-4xl">{initial}</Text>
              <View
                className="absolute bottom-0 right-0 bg-white rounded-full items-center justify-center"
                style={{ width: 24, height: 24 }}
              >
                <FontAwesome5 name="camera" size={10} color="#C4614A" solid />
              </View>
            </View>
          )}
        </Pressable>
        <Text className="text-white text-xl font-bold">{member.name}</Text>

        {/* Phone (tappable) */}
        {editingPhone ? (
          <View className="flex-row items-center mt-3 gap-2">
            <TextInput
              value={phoneInput}
              onChangeText={setPhoneInput}
              placeholder="Phone number..."
              placeholderTextColor="rgba(255,255,255,0.6)"
              keyboardType="phone-pad"
              style={{ fontSize: 16 }}
              className="text-white text-sm border-b border-white/60 pb-1 min-w-32 text-center"
              autoFocus
            />
            <Pressable onPress={handleSavePhone}>
              <Text className="text-white font-semibold text-sm">Save</Text>
            </Pressable>
            <Pressable onPress={() => setEditingPhone(false)}>
              <Text className="text-white/60 text-sm">Cancel</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={() => {
              setPhoneInput(member.phone ?? '');
              setEditingPhone(true);
            }}
            className="mt-2"
          >
            <Text className="text-brand-200 text-sm">
              {member.phone ?? 'Tap to add phone number'}
            </Text>
          </Pressable>
        )}
      </View>

      <View className="px-5 pt-5">
        {/* Stats row */}
        <View className="flex-row gap-3 mb-5">
          <StatCard value={avgRating} label="Avg Rating" icon="star" suffix="" />
          <StatCard value={String(meetingsAttended)} label="Meetings" icon="calendar-alt" suffix="" />
          <StatCard value={String(ratings.length)} label="Books Rated" icon="book-open" suffix="" />
        </View>

        {/* Book Personality */}
        <View className="bg-cream-50 rounded-2xl p-4 mb-4" style={{ shadowColor: '#8c3e2e', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 }}>
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-gray-800 font-semibold">Book Personality</Text>
            <Pressable
              onPress={handleGeneratePersonality}
              disabled={personalityLoading}
              className={`rounded-xl px-3 py-2 ${member.book_personality ? 'border border-brand-300' : 'bg-brand-500'}`}
            >
              {personalityLoading ? (
                <ActivityIndicator
                  color={member.book_personality ? '#db2777' : 'white'}
                  size="small"
                />
              ) : (
                <View className="flex-row items-center gap-1.5">
                  <FontAwesome5
                    name={member.book_personality ? 'sync-alt' : 'magic'}
                    size={10}
                    color={member.book_personality ? '#a84f3c' : 'white'}
                    solid
                  />
                  <Text className={`text-xs font-semibold ${member.book_personality ? 'text-brand-600' : 'text-white'}`}>
                    {member.book_personality ? 'Regenerate' : 'Generate with AI'}
                  </Text>
                </View>
              )}
            </Pressable>
          </View>
          {member.book_personality ? (
            <View className="bg-brand-50 rounded-xl p-3">
              <Text className="text-brand-800 text-sm leading-5 italic">
                {member.book_personality}
              </Text>
            </View>
          ) : (
            <Text className="text-gray-400 text-sm">
              Tap "Generate with AI" to create a fun book personality powered by Claude.
            </Text>
          )}
        </View>

        {/* Favorite Books */}
        <View className="bg-cream-50 rounded-2xl p-4 mb-4" style={{ shadowColor: '#8c3e2e', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 }}>
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-gray-800 font-semibold">Favorite Books</Text>
            <Pressable
              onPress={() => setShowAddFavorites(true)}
              className="bg-brand-500 rounded-xl px-3 py-1.5"
            >
              <View className="flex-row items-center gap-1">
                <FontAwesome5 name="plus" size={10} color="white" solid />
                <Text className="text-white text-xs font-semibold">Add</Text>
              </View>
            </Pressable>
          </View>
          {favorites.length === 0 ? (
            <Text className="text-gray-400 text-sm">
              No favorites yet. Add books to power the Member Taste filter in Discovery.
            </Text>
          ) : (
            favorites.map((fav) => (
              fav.book ? (
                <BookCard
                  key={fav.id}
                  title={fav.book.title}
                  author={fav.book.author}
                  coverUrl={fav.book.cover_url}
                  genre={fav.book.genre}
                  pageCount={fav.book.page_count}
                  rightElement={
                    <Pressable
                      onPress={() => removeFavorite(fav.id)}
                      className="bg-cream-200 rounded-lg px-2 py-1"
                    >
                      <Text className="text-gray-400 text-xs">Remove</Text>
                    </Pressable>
                  }
                />
              ) : null
            ))
          )}
        </View>

        {/* Ratings History */}
        {(() => {
          const ratedLogIds = new Set(ratings.map((r) => r.book_log?.id).filter(Boolean));
          const unratedLogs = logs.filter((l) => l.book && !ratedLogIds.has(l.id));
          return (
          <View className="bg-cream-50 rounded-2xl p-4 mb-8" style={{ shadowColor: '#8c3e2e', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 }}>
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-gray-800 font-semibold">Ratings History</Text>
              {!!unratedLogs.length && (
                <Pressable
                  onPress={() => setShowAddRating(true)}
                  className="bg-brand-500 rounded-xl px-3 py-1.5"
                >
                  <View className="flex-row items-center gap-1">
                    <FontAwesome5 name="plus" size={10} color="white" solid />
                    <Text className="text-white text-xs font-semibold">Rate a Book</Text>
                  </View>
                </Pressable>
              )}
            </View>
            {ratings
              .filter((r) => r.book_log?.book)
              .map((r) => (
                <View
                  key={r.id}
                  className="flex-row items-center py-2 border-b border-gray-50 gap-3"
                >
                  {r.book_log!.book!.cover_url ? (
                    <Image
                      source={{ uri: r.book_log!.book!.cover_url }}
                      style={{ width: 32, height: 46, borderRadius: 4 }}
                      resizeMode="cover"
                    />
                  ) : (
                    <View
                      className="bg-brand-100 rounded items-center justify-center"
                      style={{ width: 32, height: 46 }}
                    >
                      <FontAwesome5 name="book" size={12} color="#C4614A" solid />
                    </View>
                  )}
                  <Text className="flex-1 text-gray-700 text-sm" numberOfLines={2}>
                    {r.book_log!.book!.title}
                  </Text>
                  {editingRatingId === r.id ? (
                    <View className="flex-row items-center gap-1">
                      <TextInput
                        value={editingScore}
                        onChangeText={setEditingScore}
                        keyboardType="decimal-pad"
                        maxLength={4}
                        autoFocus
                        style={{ borderWidth: 1, borderColor: '#C4614A', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, width: 52, textAlign: 'center', fontSize: 14, color: '#3a2218' }}
                      />
                      <Pressable onPress={() => saveRating(r.id)} className="bg-brand-500 rounded-lg p-1.5">
                        <FontAwesome5 name="check" size={10} color="white" solid />
                      </Pressable>
                      <Pressable onPress={() => setEditingRatingId(null)} className="bg-gray-100 rounded-lg p-1.5">
                        <FontAwesome5 name="times" size={10} color="#6b7280" solid />
                      </Pressable>
                    </View>
                  ) : (
                    <View className="flex-row items-center gap-1.5">
                      <Pressable
                        onPress={() => { setEditingRatingId(r.id); setEditingScore(String(r.score)); setConfirmDeleteRatingId(null); }}
                        className="bg-brand-50 rounded-full px-2 py-0.5"
                      >
                        <Text className="text-brand-700 font-bold text-sm">{r.score}</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => { deleteRating(r.id); setEditingRatingId(null); }}
                        className={`rounded-lg px-2 py-0.5 ${confirmDeleteRatingId === r.id ? 'bg-red-50' : 'bg-gray-50'}`}
                      >
                        <Text className={`text-xs ${confirmDeleteRatingId === r.id ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                          {confirmDeleteRatingId === r.id ? 'Confirm?' : 'Delete'}
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              ))}
            {ratings.filter((r) => r.book_log?.book).length === 0 && (
              <Text className="text-gray-400 text-sm">No ratings yet.</Text>
            )}
          </View>
          );
        })()}
      </View>

      {!!showAddFavorites && (
        <AddFavoritesModal
          memberId={id}
          existingBookIds={favorites.map((f) => f.book_id)}
          onClose={() => setShowAddFavorites(false)}
          onSaved={() => {
            setShowAddFavorites(false);
            loadProfile();
          }}
        />
      )}
      {!!showAddRating && member && (
        <AddRatingModal
          memberName={member.name}
          unratedLogs={logs.filter((l) => {
            const ratedLogIds = new Set(ratings.map((r) => r.book_log?.id).filter(Boolean));
            return l.book && !ratedLogIds.has(l.id);
          })}
          onClose={() => setShowAddRating(false)}
          onSaved={() => {
            setShowAddRating(false);
            loadProfile();
          }}
        />
      )}
    </ScrollView>
  );
}

function StatCard({
  value,
  label,
  icon,
  suffix,
}: {
  value: string;
  label: string;
  icon: React.ComponentProps<typeof FontAwesome5>['name'];
  suffix: string;
}) {
  return (
    <View className="flex-1 bg-cream-50 rounded-2xl p-3 items-center" style={{ shadowColor: '#8c3e2e', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 5, elevation: 2 }}>
      <FontAwesome5 name={icon} size={14} color="#C4614A" solid />
      <Text className="text-[#3a2218] font-bold text-sm mt-1.5">
        {value}{suffix}
      </Text>
      <Text className="text-[#9a7060] text-xs">{label}</Text>
    </View>
  );
}

function AddFavoritesModal({
  memberId,
  existingBookIds,
  onClose,
  onSaved,
}: {
  memberId: string;
  existingBookIds: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GoogleBook[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

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

  async function addFavorite(book: GoogleBook) {
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
        .from('member_favorite_books')
        .upsert({ member_id: memberId, book_id: bookData.id }, { onConflict: 'member_id,book_id' });

      onSaved();
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
          <Text className="text-lg font-bold text-gray-900">Add Favorite Book</Text>
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
              rightElement={
                saving === book.id ? (
                  <ActivityIndicator color="#db2777" size="small" />
                ) : existingBookIds.includes(book.id) ? (
                  <View className="flex-row items-center gap-1">
                    <FontAwesome5 name="check" size={10} color="#16a34a" solid />
                    <Text className="text-green-600 text-xs font-medium">Added</Text>
                  </View>
                ) : (
                  <Pressable
                    onPress={(e) => { e.stopPropagation(); addFavorite(book); }}
                    className="bg-brand-500 rounded-lg px-2 py-1.5"
                  >
                    <Text className="text-white text-xs font-medium">Add</Text>
                  </Pressable>
                )
              }
            />
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

function AddRatingModal({
  memberName,
  unratedLogs,
  onClose,
  onSaved,
}: {
  memberName: string;
  unratedLogs: BookLog[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [scores, setScores] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  async function handleSave(log: BookLog) {
    const raw = scores[log.id];
    const score = parseFloat(raw);
    if (isNaN(score) || score < 1 || score > 10) return;
    setSaving(log.id);
    try {
      await supabase
        .from('ratings')
        .insert({ book_log_id: log.id, member_name: memberName, score });
      setScores((prev) => { const next = { ...prev }; delete next[log.id]; return next; });
      onSaved();
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
          <Text className="text-lg font-bold text-gray-900">Rate a Book</Text>
          <Pressable onPress={onClose}>
            <Text className="text-brand-500 font-medium">Done</Text>
          </Pressable>
        </View>
        <ScrollView className="flex-1 px-5 pt-4">
          {unratedLogs.map((log) => (
            <View
              key={log.id}
              className="flex-row items-center py-3 border-b border-gray-100 gap-3"
            >
              {log.book?.cover_url ? (
                <Image
                  source={{ uri: log.book.cover_url }}
                  style={{ width: 32, height: 46, borderRadius: 4 }}
                  resizeMode="cover"
                />
              ) : (
                <View
                  className="bg-brand-100 rounded items-center justify-center"
                  style={{ width: 32, height: 46 }}
                >
                  <FontAwesome5 name="book" size={12} color="#C4614A" solid />
                </View>
              )}
              <Text className="flex-1 text-gray-700 text-sm" numberOfLines={2}>
                {log.book?.title}
              </Text>
              <View className="flex-row items-center gap-1">
                <TextInput
                  value={scores[log.id] ?? ''}
                  onChangeText={(v) => setScores((prev) => ({ ...prev, [log.id]: v }))}
                  keyboardType="decimal-pad"
                  placeholder="1–10"
                  placeholderTextColor="#9ca3af"
                  maxLength={4}
                  style={{ borderWidth: 1, borderColor: '#EDD9C8', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, width: 56, textAlign: 'center', fontSize: 14, color: '#3a2218' }}
                />
                {saving === log.id ? (
                  <ActivityIndicator size="small" color="#C4614A" />
                ) : (
                  <Pressable
                    onPress={() => handleSave(log)}
                    disabled={!scores[log.id]}
                    className={`rounded-lg p-1.5 ${scores[log.id] ? 'bg-brand-500' : 'bg-gray-100'}`}
                  >
                    <FontAwesome5 name="check" size={10} color={scores[log.id] ? 'white' : '#9ca3af'} solid />
                  </Pressable>
                )}
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}
