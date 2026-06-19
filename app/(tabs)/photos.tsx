import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
  Modal,
  Dimensions,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { supabase, MeetingPhoto } from '../../lib/supabase';
import { ScreenHeader } from '../../components/ScreenHeader';
import { EmptyState } from '../../components/EmptyState';

const SCREEN_WIDTH = Dimensions.get('window').width;

type PhotoWithMeta = MeetingPhoto & {
  book_log?: {
    date_read: string | null;
    book?: { title: string };
  };
};

export default function PhotosScreen() {
  const [photos, setPhotos] = useState<PhotoWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewPhoto, setViewPhoto] = useState<PhotoWithMeta | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadPhotos();
    }, [])
  );

  async function loadPhotos() {
    setLoading(true);
    const { data } = await supabase
      .from('meeting_photos')
      .select('*, book_log:book_log_id(date_read, book:book_id(title))')
      .order('created_at', { ascending: false });
    setPhotos((data ?? []) as PhotoWithMeta[]);
    setLoading(false);
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }

  const THUMB = (SCREEN_WIDTH - 3) / 2;

  return (
    <View style={{ flex: 1, backgroundColor: '#FDF6EE' }}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <ScreenHeader
          title="Photos"
          subtitle={`${photos.length} photo${photos.length !== 1 ? 's' : ''}`}
        />

        {loading ? (
          <ActivityIndicator color="#C4614A" style={{ marginTop: 32 }} />
        ) : photos.length === 0 ? (
          <EmptyState
            icon="📷"
            title="No photos yet"
            subtitle="Upload photos from your meeting cards"
          />
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 3 }}>
            {photos.map((photo) => (
              <Pressable key={photo.id} onPress={() => setViewPhoto(photo)} style={{ width: THUMB }}>
                <Image
                  source={{ uri: photo.photo_url }}
                  style={{ width: THUMB, height: THUMB, borderRadius: 10 }}
                  resizeMode="cover"
                />
                <View style={{ paddingTop: 4, paddingBottom: 8 }}>
                  {!!photo.book_log?.book?.title && (
                    <Text style={{ fontSize: 11, fontWeight: '600', color: '#3a2218' }} numberOfLines={1}>
                      {photo.book_log.book.title}
                    </Text>
                  )}
                  {!!photo.book_log?.date_read && (
                    <Text style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>
                      {formatDate(photo.book_log.date_read)}
                    </Text>
                  )}
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      {/* View Photo Modal */}
      <Modal
        visible={!!viewPhoto}
        transparent
        animationType="fade"
        onRequestClose={() => setViewPhoto(null)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' }}>
          <Pressable
            onPress={() => setViewPhoto(null)}
            style={{ position: 'absolute', top: 56, right: 20, zIndex: 10, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, padding: 8 }}
          >
            <FontAwesome5 name="times" size={18} color="white" solid />
          </Pressable>
          {!!viewPhoto && (
            <>
              <Image
                source={{ uri: viewPhoto.photo_url }}
                style={{ width: SCREEN_WIDTH, height: SCREEN_WIDTH }}
                resizeMode="contain"
              />
              <View style={{ marginTop: 16, paddingHorizontal: 24, alignItems: 'center' }}>
                {!!viewPhoto.caption && (
                  <Text style={{ color: 'white', textAlign: 'center', fontSize: 15, marginBottom: 6 }}>
                    {viewPhoto.caption}
                  </Text>
                )}
                {!!viewPhoto.book_log?.book?.title && (
                  <Text style={{ color: '#b0998a', fontSize: 13, textAlign: 'center' }}>
                    {viewPhoto.book_log.book.title}
                    {!!viewPhoto.book_log.date_read && ` · ${new Date(viewPhoto.book_log.date_read).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`}
                  </Text>
                )}
              </View>
            </>
          )}
        </View>
      </Modal>
    </View>
  );
}
