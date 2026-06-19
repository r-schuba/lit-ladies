import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { searchBooksFiltered, GoogleBook } from '../../lib/googleBooks';
import { getAuthorGender } from '../../lib/genderize';
import { supabase, Member } from '../../lib/supabase';
import { GENRES, LENGTH_BUCKETS, LengthBucket } from '../../constants/genres';
import { FilterPill } from '../../components/FilterPill';
import { ScreenHeader } from '../../components/ScreenHeader';

type GenderFilter = 'any' | 'female' | 'male' | 'unknown';

export default function GeneratorScreen() {
  const router = useRouter();
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedLength, setSelectedLength] = useState<LengthBucket | null>(null);
  const [genderFilter, setGenderFilter] = useState<GenderFilter>('any');
  const [minRating, setMinRating] = useState<number | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [memberGenresLoading, setMemberGenresLoading] = useState(false);

  const [result, setResult] = useState<GoogleBook | null>(null);
  const [loading, setLoading] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [wishlistAdded, setWishlistAdded] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);

  useEffect(() => {
    supabase.from('members').select('*').order('name').then(({ data }) => {
      setMembers((data ?? []) as Member[]);
    });
  }, []);

  async function handleMemberSelect(member: Member) {
    if (selectedMember?.id === member.id) {
      setSelectedMember(null);
      return;
    }
    setSelectedMember(member);
    setMemberGenresLoading(true);
    try {
      const { data } = await supabase
        .from('member_favorite_books')
        .select('book:book_id(genre)')
        .eq('member_id', member.id);

      const genres = [
        ...new Set(
          (data ?? [])
            .map((row: { book: { genre: string | null } | null }) => row.book?.genre)
            .filter((g): g is string => !!g)
        ),
      ];

      if (genres.length === 0) {
        Alert.alert(
          'No genres found',
          `Add favorite books to ${member.name}'s profile first.`
        );
        setSelectedMember(null);
      } else {
        setSelectedGenres(genres);
      }
    } catch (e) {
      Alert.alert('Error', String(e));
      setSelectedMember(null);
    } finally {
      setMemberGenresLoading(false);
    }
  }

  async function handleSpin() {
    setLoading(true);
    setResult(null);
    try {
      const lengthRange = selectedLength ? LENGTH_BUCKETS[selectedLength] : null;
      let books = await searchBooksFiltered({
        genres: selectedGenres.length > 0 ? selectedGenres : undefined,
        minRating: minRating ?? undefined,
        minPages: lengthRange?.min,
        maxPages: lengthRange?.max === 9999 ? undefined : lengthRange?.max,
        maxResults: 40,
      });

      // Apply gender filter
      if (genderFilter !== 'any' && books.length > 0) {
        const genderedBooks: GoogleBook[] = [];
        for (const book of books.slice(0, 20)) {
          const gender = await getAuthorGender(book.authorFirstName);
          if (gender === genderFilter) genderedBooks.push(book);
        }
        books = genderedBooks;
      }

      if (books.length === 0) {
        Alert.alert('No results', 'Try relaxing your filters.');
        return;
      }

      const random = books[Math.floor(Math.random() * books.length)];
      setResult(random);
      setWishlistAdded(false);
    } catch (e) {
      Alert.alert('Error', String(e));
    } finally {
      setLoading(false);
    }
  }

  async function addToWishlist() {
    if (!result) return;
    setWishlistLoading(true);
    try {
      const gender = await getAuthorGender(result.authorFirstName);
      const { data: bookData } = await supabase
        .from('books')
        .upsert(
          {
            title: result.title,
            author: result.author,
            author_gender: gender,
            genre: result.genre,
            page_count: result.pageCount,
            cover_url: result.coverUrl,
            google_books_id: result.id,
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

      setWishlistAdded(true);
    } catch (e) {
      Alert.alert('Error', String(e));
    } finally {
      setWishlistLoading(false);
    }
  }

  return (
    <ScrollView className="flex-1 bg-cream-100" contentContainerStyle={{ padding: 20 }}>
      <ScreenHeader
        title="Book Discovery"
        subtitle="Find your next great read"
      />

      {/* Member Taste filter */}
      <Text className="text-gray-700 font-semibold text-sm mb-2">
        Member Taste{selectedMember ? ` — ${selectedMember.name}'s favorites` : ''}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2 -mx-1">
        <View className="flex-row px-1">
          <FilterPill
            label="Any Member"
            active={selectedMember === null}
            onPress={() => setSelectedMember(null)}
          />
          {members.map((m) => (
            <FilterPill
              key={m.id}
              label={m.name}
              active={selectedMember?.id === m.id}
              onPress={() => handleMemberSelect(m)}
            />
          ))}
        </View>
      </ScrollView>
      {!!memberGenresLoading && (
        <ActivityIndicator color="#db2777" size="small" className="mb-2" />
      )}

      {/* Genre filter */}
      <Text className="text-gray-700 font-semibold text-sm mb-2 mt-2">
        Genre{selectedGenres.length > 0 ? ` (${selectedGenres.length} selected)` : ''}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4 -mx-1">
        <View className="flex-row px-1">
          <FilterPill
            label="Any"
            active={selectedGenres.length === 0}
            onPress={() => { setSelectedGenres([]); setSelectedMember(null); }}
          />
          {GENRES.map((g) => (
            <FilterPill
              key={g}
              label={g}
              active={selectedGenres.includes(g)}
              onPress={() => {
                setSelectedMember(null);
                setSelectedGenres((prev) =>
                  prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
                );
              }}
            />
          ))}
        </View>
      </ScrollView>

      {/* Length filter */}
      <Text className="text-gray-700 font-semibold text-sm mb-2">Length</Text>
      <View className="flex-row flex-wrap mb-4">
        <FilterPill
          label="Any Length"
          active={selectedLength === null}
          onPress={() => setSelectedLength(null)}
        />
        {(Object.keys(LENGTH_BUCKETS) as LengthBucket[]).map((k) => (
          <FilterPill
            key={k}
            label={LENGTH_BUCKETS[k].label.split(' ')[0]}
            active={selectedLength === k}
            onPress={() => setSelectedLength(selectedLength === k ? null : k)}
          />
        ))}
      </View>

      {/* Author gender filter */}
      <Text className="text-gray-700 font-semibold text-sm mb-2">Author Gender</Text>
      <View className="flex-row flex-wrap mb-4">
        {(['any', 'female', 'male', 'unknown'] as GenderFilter[]).map((g) => (
          <FilterPill
            key={g}
            label={g.charAt(0).toUpperCase() + g.slice(1)}
            active={genderFilter === g}
            onPress={() => setGenderFilter(g)}
          />
        ))}
      </View>

      {/* Min rating filter */}
      <Text className="text-gray-700 font-semibold text-sm mb-2">Min Google Rating</Text>
      <View className="flex-row flex-wrap mb-6">
        <FilterPill
          label="Any"
          active={minRating === null}
          onPress={() => setMinRating(null)}
        />
        {[3.5, 4.0, 4.5].map((r) => (
          <FilterPill
            key={r}
            label={`★ ${r}+`}
            active={minRating === r}
            onPress={() => setMinRating(minRating === r ? null : r)}
          />
        ))}
      </View>

      {/* Spin button */}
      <Pressable
        onPress={handleSpin}
        disabled={loading}
        className="bg-brand-500 rounded-2xl py-4 items-center mb-6"
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <View className="flex-row items-center gap-2">
            <FontAwesome5 name="random" size={14} color="white" solid />
            <Text className="text-white font-bold text-base">Spin the Wheel!</Text>
          </View>
        )}
      </Pressable>

      {/* Result */}
      {result && (
        <View className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm">
          <View className="items-center mb-4">
            {result.coverUrl ? (
              <Image
                source={{ uri: result.coverUrl }}
                style={{ width: 100, height: 140, borderRadius: 12 }}
                resizeMode="cover"
              />
            ) : (
              <View
                className="bg-brand-100 rounded-xl items-center justify-center"
                style={{ width: 100, height: 140 }}
              >
                <Text className="text-4xl">📚</Text>
              </View>
            )}
          </View>
          <Text className="text-gray-900 font-bold text-lg text-center">{result.title}</Text>
          <Text className="text-gray-500 text-sm text-center mt-1">{result.author}</Text>
          <View className="flex-row justify-center flex-wrap gap-2 mt-3">
            {!!result.genre && (
              <View className="bg-brand-50 rounded-full px-3 py-1">
                <Text className="text-brand-700 text-xs">{result.genre}</Text>
              </View>
            )}
            {!!result.pageCount && (
              <View className="bg-gray-100 rounded-full px-3 py-1">
                <Text className="text-gray-600 text-xs">{result.pageCount} pages</Text>
              </View>
            )}
          </View>
          {result.description && (
            <Text className="text-gray-500 text-xs mt-3 leading-5" numberOfLines={4}>
              {result.description}
            </Text>
          )}
          <View className="flex-row gap-3 mt-4">
            <Pressable
              onPress={handleSpin}
              className="flex-1 border border-brand-300 rounded-xl py-3 items-center"
            >
              <View className="flex-row items-center gap-1.5">
                <FontAwesome5 name="sync-alt" size={12} color="#a84f3c" solid />
                <Text className="text-brand-600 font-semibold text-sm">Spin Again</Text>
              </View>
            </Pressable>
            <Pressable
              onPress={addToWishlist}
              disabled={wishlistAdded || wishlistLoading}
              style={{ flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', backgroundColor: wishlistAdded ? '#4ade80' : '#C4614A' }}
            >
              {wishlistLoading ? (
                <ActivityIndicator color="white" size="small" />
              ) : wishlistAdded ? (
                <View className="flex-row items-center gap-1.5">
                  <FontAwesome5 name="check" size={12} color="white" solid />
                  <Text className="text-white font-semibold text-sm">Added!</Text>
                </View>
              ) : (
                <View className="flex-row items-center gap-1.5">
                  <FontAwesome5 name="heart" size={12} color="white" solid />
                  <Text className="text-white font-semibold text-sm">Add to Wishlist</Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>
      )}

    </ScrollView>
  );
}
