import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';

export type PreviewableBook = {
  title: string;
  author: string;
  coverUrl?: string | null;
  genre?: string | null;
  pageCount?: number | null;
  averageRating?: number | null;
  ratingsCount?: number | null;
  description?: string | null;
  publishedDate?: string | null;
  publisher?: string | null;
};

function stripHtml(str: string): string {
  return str
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
      <Text style={{ color: '#9ca3af', fontSize: 13, width: 100 }}>{label}</Text>
      <Text style={{ color: '#374151', fontSize: 13, fontWeight: '500', flex: 1, textAlign: 'right' }}>{value}</Text>
    </View>
  );
}

type Props = {
  book: PreviewableBook | null;
  onClose: () => void;
  /** If provided, an "Add to Wishlist" button is shown at the bottom */
  onAdd?: () => Promise<void>;
};

export function BookPreviewModal({ book, onClose, onAdd }: Props) {
  const [adding, setAdding] = useState(false);

  async function handleAdd() {
    if (!onAdd) return;
    setAdding(true);
    try {
      await onAdd();
    } finally {
      setAdding(false);
    }
  }

  return (
    <Modal
      visible={!!book}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      {!!book && (
        <View style={{ flex: 1, backgroundColor: '#FDF6EE' }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, paddingTop: 20, borderBottomWidth: 1, borderBottomColor: '#EDD9C8' }}>
            <Pressable onPress={onClose} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <FontAwesome5 name="chevron-left" size={13} color="#C4614A" solid />
              <Text style={{ color: '#C4614A', fontSize: 16 }}>Back</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ paddingBottom: onAdd ? 110 : 40 }}>
            {/* Hero */}
            <View style={{ backgroundColor: '#C4614A', paddingTop: 28, paddingBottom: 28, paddingHorizontal: 20, alignItems: 'center' }}>
              {book.coverUrl ? (
                <Image
                  source={{ uri: book.coverUrl }}
                  style={{ width: 110, height: 160, borderRadius: 12 }}
                  resizeMode="cover"
                />
              ) : (
                <View style={{ width: 110, height: 160, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 48 }}>📚</Text>
                </View>
              )}
              <Text style={{ color: 'white', fontSize: 20, fontWeight: '700', marginTop: 16, textAlign: 'center', paddingHorizontal: 12 }}>
                {book.title}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, marginTop: 4 }}>
                {book.author}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14, justifyContent: 'center' }}>
                {!!book.genre && (
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 4 }}>
                    <Text style={{ color: 'white', fontSize: 12 }}>{book.genre}</Text>
                  </View>
                )}
                {!!book.pageCount && (
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 4 }}>
                    <Text style={{ color: 'white', fontSize: 12 }}>{book.pageCount} pages</Text>
                  </View>
                )}
                {!!book.averageRating && (
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 4 }}>
                    <Text style={{ color: 'white', fontSize: 12 }}>⭐ {book.averageRating}/5 on Google</Text>
                  </View>
                )}
              </View>
            </View>

            <View style={{ padding: 20, gap: 16 }}>
              {/* About */}
              {!!book.description && (
                <View style={{ backgroundColor: 'white', borderRadius: 16, padding: 16, shadowColor: '#8c3e2e', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 }}>
                  <Text style={{ color: '#1f2937', fontWeight: '600', fontSize: 15, marginBottom: 10 }}>About</Text>
                  <Text style={{ color: '#4b5563', fontSize: 14, lineHeight: 22 }}>
                    {stripHtml(book.description)}
                  </Text>
                </View>
              )}

              {/* Details */}
              {(!!book.publisher || !!book.publishedDate || !!book.ratingsCount) && (
                <View style={{ backgroundColor: 'white', borderRadius: 16, padding: 16, shadowColor: '#8c3e2e', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 }}>
                  <Text style={{ color: '#1f2937', fontWeight: '600', fontSize: 15, marginBottom: 4 }}>Details</Text>
                  {!!book.publisher && <DetailRow label="Publisher" value={book.publisher} />}
                  {!!book.publishedDate && <DetailRow label="Published" value={book.publishedDate} />}
                  {!!book.ratingsCount && <DetailRow label="Google Ratings" value={book.ratingsCount.toLocaleString()} />}
                </View>
              )}
            </View>
          </ScrollView>

          {/* Add to Wishlist CTA */}
          {!!onAdd && (
            <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FDF6EE', borderTopWidth: 1, borderTopColor: '#EDD9C8', padding: 16, paddingBottom: 32 }}>
              <Pressable
                onPress={handleAdd}
                disabled={adding}
                style={{ backgroundColor: '#C4614A', borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
              >
                {adding ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>+ Add to Wishlist</Text>
                )}
              </Pressable>
            </View>
          )}
        </View>
      )}
    </Modal>
  );
}
