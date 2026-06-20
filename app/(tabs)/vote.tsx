import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { supabase, Member, WishlistItem } from '../../lib/supabase';
import { BookCard } from '../../components/BookCard';
import { BookPreviewModal, PreviewableBook } from '../../components/BookPreviewModal';
import { EmptyState } from '../../components/EmptyState';
import { ScreenHeader } from '../../components/ScreenHeader';
import { getBookById } from '../../lib/googleBooks';

type NomineeBook = {
  book_id: string;
  book: {
    id: string;
    title: string;
    author: string;
    cover_url: string | null;
    genre: string | null;
    page_count: number | null;
    goodreads_rating: number | null;
    google_books_id: string | null;
  };
  votes: string[];
};

export default function VoteScreen() {
  const router = useRouter();
  const [nominees, setNominees] = useState<NomineeBook[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showVoteModal, setShowVoteModal] = useState(false);
  const [showNominateModal, setShowNominateModal] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [pendingWinner, setPendingWinner] = useState<NomineeBook | null>(null);
  const [previewBook, setPreviewBook] = useState<PreviewableBook | null>(null);
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  async function loadData() {
    setLoading(true);
    const [votesRes, membersRes] = await Promise.all([
      supabase
        .from('votes')
        .select('book_id, member_name, book:books(id, title, author, cover_url, genre, page_count, goodreads_rating, google_books_id)')
        .neq('member_name', '__nominee__'),
      supabase.from('members').select('*').order('name'),
    ]);

    const members = (membersRes.data ?? []) as Member[];
    setMembers(members);

    // Group votes by book
    const allVotes = votesRes.data ?? [];
    const nomineeRows = await supabase
      .from('votes')
      .select('book_id, book:books(id, title, author, cover_url, genre, page_count, goodreads_rating, google_books_id)')
      .eq('member_name', '__nominee__');

    const nomineeBooks: NomineeBook[] = (nomineeRows.data ?? []).map((row: any) => ({
      book_id: row.book_id,
      book: row.book,
      votes: allVotes
        .filter((v: any) => v.book_id === row.book_id)
        .map((v: any) => v.member_name),
    }));

    setNominees(nomineeBooks);
    setLoading(false);
  }

  async function openPreview(nominee: NomineeBook) {
    setPreviewLoadingId(nominee.book_id);
    try {
      if (nominee.book.google_books_id) {
        const gb = await getBookById(nominee.book.google_books_id);
        if (gb) { setPreviewBook(gb); return; }
      }
      setPreviewBook({
        title: nominee.book.title,
        author: nominee.book.author,
        coverUrl: nominee.book.cover_url,
        genre: nominee.book.genre,
        pageCount: nominee.book.page_count,
      });
    } catch {
      setPreviewBook({
        title: nominee.book.title,
        author: nominee.book.author,
        coverUrl: nominee.book.cover_url,
        genre: nominee.book.genre,
        pageCount: nominee.book.page_count,
      });
    } finally {
      setPreviewLoadingId(null);
    }
  }

  async function doConfirmWinner() {
    if (!pendingWinner) return;
    await supabase.from('book_log').insert({
      book_id: pendingWinner.book_id,
      date_read: null,
    });
    await supabase.from('votes').delete().eq('book_id', pendingWinner.book_id);
    setPendingWinner(null);
    loadData();
    router.push('/(tabs)/log');
  }

  async function removeNominee(bookId: string) {
    await supabase.from('votes').delete().eq('book_id', bookId);
    loadData();
  }

  async function doClearVotes() {
    await supabase.from('votes').delete().neq('member_name', '__nominee__');
    setShowClearConfirm(false);
    loadData();
  }

  const sorted = [...nominees].sort((a, b) => b.votes.length - a.votes.length);
  const maxVotes = sorted[0]?.votes.length ?? 1;

  return (
    <View className="flex-1 bg-cream-100">
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <ScreenHeader
          title="Vote"
          subtitle="Pick the next book"
          right={
            <View className="flex-col gap-1.5 items-end">
              <Pressable
                onPress={() => setShowNominateModal(true)}
                className="border border-brand-300 rounded-xl px-3 py-2"
              >
                <Text className="text-brand-600 font-semibold text-sm">Nominate</Text>
              </Pressable>
              {nominees.length > 0 && (
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={() => setShowClearConfirm(true)}
                    className="border border-red-200 rounded-xl px-3 py-2"
                  >
                    <Text className="text-red-400 font-semibold text-sm">Clear Votes</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setShowVoteModal(true)}
                    className="bg-brand-500 rounded-xl px-3 py-2"
                  >
                    <Text className="text-white font-semibold text-sm">Cast Votes</Text>
                  </Pressable>
                </View>
              )}
            </View>
          }
        />

        {loading ? (
          <ActivityIndicator color="#db2777" className="mt-8" />
        ) : nominees.length === 0 ? (
          <EmptyState
            icon="check-square"
            title="No nominees yet"
            subtitle="Nominate books from your wishlist to start voting!"
          />
        ) : (
          sorted.map((nominee, idx) => (
            <View key={nominee.book_id} className="mb-3 border border-gray-200 rounded-2xl overflow-hidden bg-white">
              <BookCard
                title={nominee.book.title}
                author={nominee.book.author}
                coverUrl={nominee.book.cover_url}
                genre={nominee.book.genre}
                pageCount={nominee.book.page_count}
                onPress={() => openPreview(nominee)}
                rightElement={
                  <View className="items-end gap-1">
                    <Text className="text-gray-700 font-bold text-sm">
                      {nominee.votes.length} vote{nominee.votes.length !== 1 ? 's' : ''}
                    </Text>
                    {idx === 0 && nominee.votes.length > 0 && (
                      <View className="bg-yellow-100 rounded-full px-2 py-0.5">
                        <View className="flex-row items-center gap-1">
                          <FontAwesome5 name="crown" size={9} color="#a16207" solid />
                          <Text className="text-yellow-700 text-xs">Leading</Text>
                        </View>
                      </View>
                    )}
                    {previewLoadingId === nominee.book_id && (
                      <ActivityIndicator size="small" color="#C4614A" />
                    )}
                  </View>
                }
              />
              {/* Vote bar */}
              <View className="bg-gray-200 rounded-full h-2 mx-3 mb-2 -mt-1">
                <View
                  className="bg-brand-400 rounded-full h-2"
                  style={{
                    width: `${maxVotes > 0 ? (nominee.votes.length / maxVotes) * 100 : 0}%`,
                  }}
                />
              </View>
              {nominee.votes.length > 0 && (
                <Text className="text-gray-400 text-xs mx-3 mb-1">
                  Votes: {nominee.votes.join(', ')}
                </Text>
              )}
              <View className="flex-row gap-2 mx-3 mb-3">
                <Pressable
                  onPress={() => setPendingWinner(nominee)}
                  className="flex-1 bg-green-50 border border-green-200 rounded-xl py-2 items-center"
                >
                  <View className="flex-row items-center gap-1.5">
                    <FontAwesome5 name="check-circle" size={11} color="#15803d" solid />
                    <Text className="text-green-700 text-xs font-medium">Confirm as Next Read</Text>
                  </View>
                </Pressable>
                <Pressable
                  onPress={() => removeNominee(nominee.book_id)}
                  className="border border-gray-200 rounded-xl px-3 py-2"
                >
                  <Text className="text-gray-400 text-xs">Remove</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <BookPreviewModal book={previewBook} onClose={() => setPreviewBook(null)} />

      {showVoteModal && (
        <CastVotesModal
          nominees={nominees}
          members={members}
          onClose={() => setShowVoteModal(false)}
          onSaved={() => {
            setShowVoteModal(false);
            loadData();
          }}
        />
      )}

      {showNominateModal && (
        <NominateModal
          onClose={() => setShowNominateModal(false)}
          onSaved={() => {
            setShowNominateModal(false);
            loadData();
          }}
        />
      )}

      <Modal visible={!!pendingWinner} transparent animationType="fade">
        <View className="flex-1 justify-center items-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <View className="bg-white rounded-2xl mx-6 p-6">
            <Text className="text-gray-900 font-bold text-base mb-2">Confirm as Next Read?</Text>
            <Text className="text-gray-500 text-sm mb-5">
              Add "{pendingWinner?.book.title}" to the book log as the next book?
            </Text>
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => setPendingWinner(null)}
                className="flex-1 border border-gray-200 rounded-xl py-3 items-center"
              >
                <Text className="text-gray-600 font-medium">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={doConfirmWinner}
                className="flex-1 bg-green-600 rounded-xl py-3 items-center"
              >
                <Text className="text-white font-semibold">Confirm</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showClearConfirm} transparent animationType="fade">
        <View className="flex-1 justify-center items-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <View className="bg-white rounded-2xl mx-6 p-6">
            <Text className="text-gray-900 font-bold text-base mb-2">Clear All Votes?</Text>
            <Text className="text-gray-500 text-sm mb-5">
              This will reset all member votes but keep the nominees in the poll.
            </Text>
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => setShowClearConfirm(false)}
                className="flex-1 border border-gray-200 rounded-xl py-3 items-center"
              >
                <Text className="text-gray-600 font-medium">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={doClearVotes}
                className="flex-1 bg-red-500 rounded-xl py-3 items-center"
              >
                <Text className="text-white font-semibold">Clear Votes</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function CastVotesModal({
  nominees,
  members,
  onClose,
  onSaved,
}: {
  nominees: NomineeBook[];
  members: Member[];
  onClose: () => void;
  onSaved: () => void;
}) {
  // Pre-populate from existing votes so saves don't wipe other members' votes
  const initialVotes: Record<string, string> = {};
  for (const nominee of nominees) {
    for (const memberName of nominee.votes) {
      initialVotes[memberName] = nominee.book_id;
    }
  }
  const [memberVotes, setMemberVotes] = useState<Record<string, string>>(initialVotes);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      // Delete existing votes (non-nominee) for these books
      const bookIds = nominees.map((n) => n.book_id);
      const { error: deleteError } = await supabase
        .from('votes')
        .delete()
        .in('book_id', bookIds)
        .neq('member_name', '__nominee__');
      if (deleteError) throw new Error(deleteError.message);

      // Upsert new votes
      const rows = Object.entries(memberVotes)
        .filter(([, bookId]) => !!bookId)
        .map(([member_name, book_id]) => ({ member_name, book_id }));

      if (rows.length > 0) {
        const { error: insertError } = await supabase
          .from('votes')
          .upsert(rows, { onConflict: 'book_id,member_name' });
        if (insertError) throw new Error(insertError.message);
      }

      onSaved();
    } catch (e) {
      Alert.alert('Error saving votes', String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <View className="flex-1 bg-cream-50">
        <View className="flex-row items-center justify-between px-5 pt-6 pb-4 border-b border-gray-100">
          <Text className="text-lg font-bold text-gray-900">Cast Votes</Text>
          <Pressable onPress={onClose}>
            <Text className="text-brand-500 font-medium">Cancel</Text>
          </Pressable>
        </View>

        <Pressable
          onPress={handleSave}
          disabled={saving}
          className="bg-brand-500 mx-5 mt-4 rounded-2xl py-4 items-center"
        >
          {saving ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-semibold text-base">Save Votes</Text>
          )}
        </Pressable>

        <ScrollView className="flex-1 px-5 pt-4">
          {members.length === 0 ? (
            <Text className="text-gray-400 text-sm">No members found. Add members first.</Text>
          ) : (
            members.map((member) => (
              <View key={member.id} className="mb-5">
                <Text className="text-gray-800 font-semibold mb-2">{member.name}</Text>
                {nominees.map((nominee) => {
                  const selected = memberVotes[member.name] === nominee.book_id;
                  return (
                    <Pressable
                      key={nominee.book_id}
                      onPress={() =>
                        setMemberVotes((prev) => ({
                          ...prev,
                          [member.name]: selected ? '' : nominee.book_id,
                        }))
                      }
                      className={`flex-row items-center p-3 rounded-xl mb-2 border ${
                        selected
                          ? 'border-brand-400 bg-brand-50'
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      <View
                        className={`w-4 h-4 rounded-full border-2 mr-3 ${
                          selected
                            ? 'border-brand-500 bg-brand-500'
                            : 'border-gray-300 bg-white'
                        }`}
                      />
                      <Text className="text-gray-800 text-sm flex-1" numberOfLines={1}>
                        {nominee.book.title}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ))
          )}

          <Pressable
            onPress={handleSave}
            disabled={saving}
            className="bg-brand-500 rounded-2xl py-4 items-center mt-4 mb-8"
          >
            {saving ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-semibold text-base">Save Votes</Text>
            )}
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

function NominateModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  React.useEffect(() => {
    supabase
      .from('wishlist')
      .select('*, book:books(*)')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setWishlistItems((data ?? []) as WishlistItem[]);
        setLoading(false);
      });
  }, []);

  async function nominate(item: WishlistItem) {
    setSaving(item.book_id);
    await supabase
      .from('votes')
      .upsert({ book_id: item.book_id, member_name: '__nominee__' }, { onConflict: 'book_id,member_name' });
    setSaving(null);
    Alert.alert('Nominated!', `"${item.book?.title}" added to vote list.`, [
      { text: 'OK', onPress: onSaved },
    ]);
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <View className="flex-1 bg-cream-50">
        <View className="flex-row items-center justify-between px-5 pt-6 pb-4 border-b border-gray-100">
          <Text className="text-lg font-bold text-gray-900">Nominate from Wishlist</Text>
          <Pressable onPress={onClose}>
            <Text className="text-brand-500 font-medium">Done</Text>
          </Pressable>
        </View>

        <ScrollView className="flex-1 px-5 pt-4">
          {loading ? (
            <ActivityIndicator color="#db2777" />
          ) : wishlistItems.length === 0 ? (
            <Text className="text-gray-400 text-sm">No books on wishlist.</Text>
          ) : (
            wishlistItems.map((item) => (
              <BookCard
                key={item.id}
                title={item.book?.title ?? ''}
                author={item.book?.author ?? ''}
                coverUrl={item.book?.cover_url}
                genre={item.book?.genre}
                pageCount={item.book?.page_count}
                rightElement={
                  saving === item.book_id ? (
                    <ActivityIndicator color="#db2777" size="small" />
                  ) : (
                    <Pressable
                      onPress={() => nominate(item)}
                      className="bg-brand-500 rounded-lg px-2 py-1.5"
                    >
                      <Text className="text-white text-xs font-medium">Nominate</Text>
                    </Pressable>
                  )
                }
              />
            ))
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
