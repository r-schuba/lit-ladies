import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { supabase, BookLog, Member } from '../../lib/supabase';
import { LitLadiesLogo } from '../../components/LitLadiesLogo';

export default function HomeScreen() {
  const router = useRouter();
  const [recentLog, setRecentLog] = useState<BookLog[]>([]);
  const [memberCount, setMemberCount] = useState(0);
  const [totalBooks, setTotalBooks] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [logRes, membersRes, countRes] = await Promise.all([
        supabase
          .from('book_log')
          .select('*, book:books(*), ratings(*)')
          .order('date_read', { ascending: false })
          .limit(4),
        supabase.from('members').select('id'),
        supabase.from('book_log').select('id', { count: 'exact', head: true }),
      ]);

      setRecentLog((logRes.data ?? []) as BookLog[]);
      setMemberCount(membersRes.data?.length ?? 0);
      setTotalBooks(countRes.count ?? 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function avgRating(entry: BookLog): string {
    if (!entry.ratings || entry.ratings.length === 0) return '—';
    const sum = entry.ratings.reduce((a, r) => a + r.score, 0);
    return (sum / entry.ratings.length).toFixed(1);
  }

  return (
    <ScrollView
      className="flex-1 bg-cream-100"
      contentContainerStyle={{ paddingBottom: 32 }}
    >
      {/* Header */}
      <View className="px-5 pt-12 pb-6">
        <LitLadiesLogo size="md" />

        {/* Stat row */}
        <View className="flex-row gap-3 mt-5">
          <Pressable
            onPress={() => router.push('/(tabs)/log')}
            className="flex-1 bg-cream-50 rounded-2xl px-4 py-3"
            style={{ shadowColor: '#8c3e2e', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 6, elevation: 2 }}
          >
            <Text className="text-[#3a2218] text-2xl font-bold">{totalBooks}</Text>
            <Text className="text-[#9a7060] text-xs mt-0.5">Books Read</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/(tabs)/members')}
            className="flex-1 bg-cream-50 rounded-2xl px-4 py-3"
            style={{ shadowColor: '#8c3e2e', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 6, elevation: 2 }}
          >
            <Text className="text-[#3a2218] text-2xl font-bold">{memberCount}</Text>
            <Text className="text-[#9a7060] text-xs mt-0.5">Members</Text>
          </Pressable>
        </View>
      </View>

      {/* Quick actions */}
      <View className="px-5 mb-7">
        <Text className="text-[#3a2218] font-semibold text-base mb-3">Quick Actions</Text>
        <View className="flex-row flex-wrap gap-3">
          <ActionButton icon="book-open" label="Add to Log" onPress={() => router.push('/(tabs)/log')} />
          <ActionButton icon="magic" label="Discover Book" onPress={() => router.push('/(tabs)/generator')} />
          <ActionButton icon="heart" label="Add to Wishlist" onPress={() => router.push('/(tabs)/wishlist?add=1')} />
          <ActionButton icon="check-square" label="Vote" onPress={() => router.push('/(tabs)/vote')} />
        </View>
      </View>

      {/* Recent reads */}
      <View className="px-5">
        <Text className="text-[#3a2218] font-semibold text-base mb-3">Recent Reads</Text>
        {loading ? (
          <ActivityIndicator color="#C4614A" />
        ) : recentLog.length === 0 ? (
          <Text className="text-[#9a7060] text-sm">No books logged yet. Add your first read!</Text>
        ) : (
          recentLog.map((entry) => (
            <Pressable
              key={entry.id}
              onPress={() => router.push(`/book/${entry.book_id}`)}
              className="flex-row bg-cream-50 rounded-2xl p-3 mb-3 items-center"
              style={{ shadowColor: '#8c3e2e', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 }}
            >
              {entry.book?.cover_url ? (
                <Image
                  source={{ uri: entry.book.cover_url }}
                  style={{ width: 56, height: 82, borderRadius: 10 }}
                  resizeMode="cover"
                />
              ) : (
                <View
                  className="bg-brand-100 rounded-xl items-center justify-center"
                  style={{ width: 56, height: 82 }}
                >
                  <Text className="text-xl">📚</Text>
                </View>
              )}
              <View className="flex-1 ml-3">
                <Text className="text-[#3a2218] font-semibold text-sm" numberOfLines={2}>
                  {entry.book?.title}
                </Text>
                <Text className="text-[#9a7060] text-xs mt-0.5">{entry.book?.author}</Text>
                <View className="flex-row items-center gap-2 mt-2">
                  <View className="bg-brand-100 rounded-full px-2 py-0.5">
                    <Text className="text-brand-700 text-xs font-semibold">★ {avgRating(entry)}</Text>
                  </View>
                  {!!entry.date_read && (
                    <Text className="text-[#b0998a] text-xs">{entry.date_read}</Text>
                  )}
                </View>
              </View>
            </Pressable>
          ))
        )}
      </View>
    </ScrollView>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof FontAwesome5>['name'];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="bg-cream-50 rounded-2xl p-4 items-center"
      style={{ width: '47%', shadowColor: '#8c3e2e', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 6, elevation: 2 }}
    >
      <View className="mb-2">
        <FontAwesome5 name={icon} size={22} color="#C4614A" solid />
      </View>
      <Text className="text-[#6b4535] text-xs font-medium">{label}</Text>
    </Pressable>
  );
}
