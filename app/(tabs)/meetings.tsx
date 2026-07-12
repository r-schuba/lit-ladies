import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  Dimensions,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase, BookLog, Member, MeetingAttendee, MeetingPhoto } from '../../lib/supabase';
import { buildGoogleCalendarUrl } from '../../lib/calendar';
import { ScreenHeader } from '../../components/ScreenHeader';
import { EmptyState } from '../../components/EmptyState';

const SCREEN_WIDTH = Dimensions.get('window').width;

function CheckPill({
  name,
  checked,
  onPress,
}: {
  name: string;
  checked: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center rounded-full px-3 py-1.5 mr-2 mb-2 ${
        checked ? 'bg-brand-500' : 'bg-gray-100'
      }`}
    >
      <Text className={`text-sm font-medium ${checked ? 'text-white' : 'text-gray-600'}`}>
        {checked ? `✓ ${name}` : name}
      </Text>
    </Pressable>
  );
}

type EditDraft = { date: string; location: string };

function openGCal(entry: BookLog) {
  if (!entry.date_read) {
    Alert.alert('No date set', 'Add a date to this meeting first.');
    return;
  }
  const [y, m, d] = entry.date_read.split('-').map(Number);
  const startDate = new Date(Date.UTC(y, m - 1, d, 19, 0)); // default 7pm
  const url = buildGoogleCalendarUrl({
    title: `📚 Lit Ladies: ${entry.book?.title ?? 'Book Club'}`,
    startDate,
    durationHours: 2,
    location: entry.meeting_location ?? undefined,
  });
  Linking.openURL(url);
}

export default function MeetingsScreen() {
  const [logs, setLogs] = useState<BookLog[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [attendees, setAttendees] = useState<MeetingAttendee[]>([]);
  const [photos, setPhotos] = useState<MeetingPhoto[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [pending, setPending] = useState<Record<string, Set<string>>>({});
  const [edits, setEdits] = useState<Record<string, EditDraft>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Upload modal state
  const [uploadModal, setUploadModal] = useState<{ logId: string } | null>(null);
  const [uploadCaption, setUploadCaption] = useState('');
  const [uploadImage, setUploadImage] = useState<{ uri: string; width: number; height: number } | null>(null);
  const [uploading, setUploading] = useState(false);

  // View photo modal state
  const [viewPhoto, setViewPhoto] = useState<MeetingPhoto | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  async function loadData() {
    setLoading(true);
    const [logsRes, membersRes, attendeesRes, photosRes] = await Promise.all([
      supabase
        .from('book_log')
        .select('*, book:books(title, author, cover_url)')
        .order('date_read', { ascending: false }),
      supabase.from('members').select('*').order('name'),
      supabase.from('meeting_attendees').select('book_log_id, member_id'),
      supabase.from('meeting_photos').select('*').order('created_at', { ascending: false }),
    ]);
    setLogs((logsRes.data ?? []) as BookLog[]);
    setMembers((membersRes.data ?? []) as Member[]);
    setAttendees((attendeesRes.data ?? []) as MeetingAttendee[]);
    setPhotos((photosRes.data ?? []) as MeetingPhoto[]);
    setLoading(false);
  }

  function photosFor(logId: string): MeetingPhoto[] {
    return photos.filter((p) => p.book_log_id === logId);
  }

  async function handlePickPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Allow photo access to upload a picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });
    if (result.canceled) return;
    const { uri, width, height } = result.assets[0];
    setUploadImage({ uri, width, height });
  }

  async function handleUploadPhoto() {
    if (!uploadModal || !uploadImage) return;
    setUploading(true);
    try {
      const { logId } = uploadModal;
      const response = await fetch(uploadImage.uri);
      const blob = await response.blob();
      const path = `${logId}/${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('meeting-photos')
        .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('meeting-photos').getPublicUrl(path);
      const photoUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const { data: inserted, error: insertError } = await supabase
        .from('meeting_photos')
        .insert({ book_log_id: logId, photo_url: photoUrl, caption: uploadCaption.trim() || null })
        .select()
        .single();
      if (insertError) throw insertError;

      setPhotos((prev) => [inserted as MeetingPhoto, ...prev]);
      setUploadModal(null);
      setUploadCaption('');
      setUploadImage(null);
    } catch (e) {
      Alert.alert('Upload failed', String(e));
    } finally {
      setUploading(false);
    }
  }

  function savedFor(logId: string): Set<string> {
    return new Set(
      attendees.filter((a) => a.book_log_id === logId).map((a) => a.member_id)
    );
  }

  function activeFor(logId: string): Set<string> {
    return pending[logId] ?? savedFor(logId);
  }

  function toggleAttendee(logId: string, memberId: string) {
    setPending((prev) => {
      const current = new Set(prev[logId] ?? savedFor(logId));
      if (current.has(memberId)) {
        current.delete(memberId);
      } else {
        current.add(memberId);
      }
      return { ...prev, [logId]: current };
    });
  }

  function hasPendingAttendance(logId: string): boolean {
    if (!pending[logId]) return false;
    const saved = savedFor(logId);
    const pend = pending[logId];
    if (saved.size !== pend.size) return true;
    for (const id of pend) {
      if (!saved.has(id)) return true;
    }
    return false;
  }

  function hasPendingEdit(logId: string): boolean {
    const draft = edits[logId];
    if (!draft) return false;
    const log = logs.find((l) => l.id === logId);
    if (!log) return false;
    return draft.date !== (log.date_read ?? '') || draft.location !== (log.meeting_location ?? '');
  }

  function initEdit(logId: string) {
    if (edits[logId]) return;
    const log = logs.find((l) => l.id === logId);
    if (!log) return;
    setEdits((prev) => ({
      ...prev,
      [logId]: { date: log.date_read ?? '', location: log.meeting_location ?? '' },
    }));
  }

  async function saveAttendance(logId: string) {
    const chosen = pending[logId];
    if (!chosen) return;
    setSaving(`attend-${logId}`);
    try {
      const { error: delError } = await supabase
        .from('meeting_attendees')
        .delete()
        .eq('book_log_id', logId);
      if (delError) throw delError;

      if (chosen.size > 0) {
        const rows = Array.from(chosen).map((member_id) => ({ book_log_id: logId, member_id }));
        const { error: insError } = await supabase.from('meeting_attendees').insert(rows);
        if (insError) throw insError;
      }

      // Reload from DB to guarantee the counter reflects what was actually saved
      const { data: fresh } = await supabase
        .from('meeting_attendees')
        .select('book_log_id, member_id');
      setAttendees((fresh ?? []) as MeetingAttendee[]);
      setPending((prev) => {
        const next = { ...prev };
        delete next[logId];
        return next;
      });
      setExpanded(null);
    } catch (e) {
      Alert.alert('Save failed', String(e));
    } finally {
      setSaving(null);
    }
  }

  async function saveDetails(logId: string) {
    const draft = edits[logId];
    if (!draft) return;
    setSaving(`detail-${logId}`);
    try {
      const { error } = await supabase
        .from('book_log')
        .update({ date_read: draft.date || null, meeting_location: draft.location || null })
        .eq('id', logId);
      if (error) throw error;
      setLogs((prev) =>
        prev.map((l) =>
          l.id === logId
            ? { ...l, date_read: draft.date || null, meeting_location: draft.location || null }
            : l
        )
      );
      setEdits((prev) => {
        const next = { ...prev };
        delete next[logId];
        return next;
      });
    } catch (e) {
      Alert.alert('Save failed', String(e));
    } finally {
      setSaving(null);
    }
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return 'No date';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function handleExpand(logId: string) {
    if (expanded === logId) {
      setExpanded(null);
    } else {
      setExpanded(logId);
      initEdit(logId);
    }
  }

  return (
    <View className="flex-1 bg-cream-100">
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <ScreenHeader
          title="Meetings"
          subtitle={`${logs.length} meeting${logs.length !== 1 ? 's' : ''}`}
        />

        {loading ? (
          <ActivityIndicator color="#db2777" className="mt-8" />
        ) : logs.length === 0 ? (
          <EmptyState
            icon="📅"
            title="No meetings yet"
            subtitle="Log a book to create a meeting record"
          />
        ) : (
          logs.map((entry) => {
            const isExpanded = expanded === entry.id;
            const active = activeFor(entry.id);
            const attendCount = isExpanded ? active.size : savedFor(entry.id).size;
            const draft = edits[entry.id];
            const isSavingAttend = saving === `attend-${entry.id}`;
            const isSavingDetail = saving === `detail-${entry.id}`;

            return (
              <View
                key={entry.id}
                className="bg-cream-50 rounded-2xl mb-3 overflow-hidden"
                style={{ shadowColor: '#8c3e2e', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 }}
              >
                {/* Header row */}
                <Pressable
                  onPress={() => handleExpand(entry.id)}
                  className="flex-row items-center px-4 py-3 gap-3"
                >
                  {entry.book?.cover_url ? (
                    <Image
                      source={{ uri: entry.book.cover_url }}
                      style={{ width: 32, height: 46, borderRadius: 4 }}
                      resizeMode="cover"
                    />
                  ) : (
                    <View
                      className="bg-brand-100 rounded items-center justify-center"
                      style={{ width: 32, height: 46 }}
                    >
                      <Text className="text-xs">📚</Text>
                    </View>
                  )}

                  <View className="flex-1">
                    <Text className="text-gray-900 font-semibold text-sm" numberOfLines={1}>
                      {entry.book?.title ?? 'Unknown Book'}
                    </Text>
                    <Text className="text-gray-400 text-xs mt-0.5">
                      {formatDate(entry.date_read)}
                      {!!entry.meeting_location && ` · ${entry.meeting_location}`}
                    </Text>
                  </View>

                  <View className="flex-row items-center gap-2">
                    <Pressable
                      onPress={() => openGCal(entry)}
                      className="bg-blue-50 rounded-lg px-2 py-1 flex-row items-center gap-1"
                    >
                      <FontAwesome5 name="calendar-plus" size={11} color="#2563eb" solid />
                      <Text className="text-blue-600 text-xs font-medium">GCal</Text>
                    </Pressable>
                    <View className="bg-brand-50 rounded-full px-2 py-0.5">
                      <Text className="text-brand-700 text-xs font-semibold">
                        {attendCount}/{members.length}
                      </Text>
                    </View>
                    <Text className="text-gray-400 text-xs">{isExpanded ? '▲' : '▾'}</Text>
                  </View>
                </Pressable>

                {/* Expanded: edit details + attendance */}
                {!!isExpanded && (
                  <View className="px-4 pb-4 border-t border-cream-200 pt-3">
                    {/* Edit fields */}
                    <Text className="text-gray-500 text-xs font-medium uppercase tracking-wide mb-2">
                      Meeting Details
                    </Text>
                    <View className="flex-row gap-2 mb-2">
                      <View className="flex-1">
                        <Text className="text-gray-500 text-xs mb-1">Date</Text>
                        <TextInput
                          value={draft?.date ?? entry.date_read ?? ''}
                          onChangeText={(v) =>
                            setEdits((prev) => ({
                              ...prev,
                              [entry.id]: { ...( prev[entry.id] ?? { date: entry.date_read ?? '', location: entry.meeting_location ?? '' }), date: v },
                            }))
                          }
                          placeholder="YYYY-MM-DD"
                          placeholderTextColor="#9ca3af"
                          style={{ fontSize: 16 }}
              className="bg-cream-100 border border-cream-300 rounded-xl px-3 py-2 text-sm text-[#3a2218]"
                          keyboardType="numbers-and-punctuation"
                        />
                      </View>
                      <View className="flex-1">
                        <Text className="text-gray-500 text-xs mb-1">Location</Text>
                        <TextInput
                          value={draft?.location ?? entry.meeting_location ?? ''}
                          onChangeText={(v) =>
                            setEdits((prev) => ({
                              ...prev,
                              [entry.id]: { ...( prev[entry.id] ?? { date: entry.date_read ?? '', location: entry.meeting_location ?? '' }), location: v },
                            }))
                          }
                          placeholder="e.g. Sarah's house"
                          placeholderTextColor="#9ca3af"
                          style={{ fontSize: 16 }}
              className="bg-cream-100 border border-cream-300 rounded-xl px-3 py-2 text-sm text-[#3a2218]"
                        />
                      </View>
                    </View>
                    {!!hasPendingEdit(entry.id) && (
                      <Pressable
                        onPress={() => saveDetails(entry.id)}
                        disabled={!!isSavingDetail}
                        className="bg-gray-800 rounded-xl py-2 items-center mb-3"
                      >
                        {isSavingDetail ? (
                          <ActivityIndicator color="white" size="small" />
                        ) : (
                          <Text className="text-white font-semibold text-sm">Save Details</Text>
                        )}
                      </Pressable>
                    )}

                    {/* Attendance */}
                    <Text className="text-gray-500 text-xs font-medium uppercase tracking-wide mb-2 mt-1">
                      Attendance
                    </Text>
                    <View className="flex-row flex-wrap">
                      {members.map((m) => (
                        <CheckPill
                          key={m.id}
                          name={m.name}
                          checked={active.has(m.id)}
                          onPress={() => toggleAttendee(entry.id, m.id)}
                        />
                      ))}
                    </View>
                    {!!hasPendingAttendance(entry.id) && (
                      <Pressable
                        onPress={() => saveAttendance(entry.id)}
                        disabled={!!isSavingAttend}
                        className="bg-brand-500 rounded-xl py-2.5 items-center mt-1"
                      >
                        {isSavingAttend ? (
                          <ActivityIndicator color="white" size="small" />
                        ) : (
                          <Text className="text-white font-semibold text-sm">Save Attendance</Text>
                        )}
                      </Pressable>
                    )}

                    {/* Photos */}
                    <View className="flex-row items-center justify-between mt-4 mb-2">
                      <Text className="text-gray-500 text-xs font-medium uppercase tracking-wide">
                        Photos
                      </Text>
                      <Pressable
                        onPress={() => { setUploadModal({ logId: entry.id }); setUploadImage(null); setUploadCaption(''); }}
                        className="flex-row items-center gap-1 bg-brand-50 rounded-lg px-2 py-1"
                      >
                        <FontAwesome5 name="camera" size={11} color="#C4614A" solid />
                        <Text className="text-brand-600 text-xs font-medium">Add Photo</Text>
                      </Pressable>
                    </View>
                    {photosFor(entry.id).length === 0 ? (
                      <Text className="text-gray-400 text-xs">No photos yet</Text>
                    ) : (
                      <View className="flex-row flex-wrap gap-2">
                        {photosFor(entry.id).map((photo) => (
                          <Pressable key={photo.id} onPress={() => setViewPhoto(photo)}>
                            <Image
                              source={{ uri: photo.photo_url }}
                              style={{ width: (SCREEN_WIDTH - 80) / 2, height: (SCREEN_WIDTH - 80) / 2, borderRadius: 10 }}
                              resizeMode="cover"
                            />
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Upload Photo Modal */}
      <Modal
        visible={!!uploadModal}
        transparent={false}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setUploadModal(null)}
      >
        <View style={{ flex: 1, backgroundColor: '#FDF6EE' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#EDD9C8' }}>
            <Pressable onPress={() => setUploadModal(null)}>
              <Text style={{ color: '#C4614A', fontSize: 16 }}>Cancel</Text>
            </Pressable>
            <Text style={{ fontWeight: '700', fontSize: 16, color: '#3a2218' }}>Add Photo</Text>
            <Pressable onPress={handleUploadPhoto} disabled={!uploadImage || uploading}>
              <Text style={{ color: !uploadImage || uploading ? '#b0998a' : '#C4614A', fontSize: 16, fontWeight: '600' }}>
                {uploading ? 'Uploading…' : 'Save'}
              </Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
            <Pressable
              onPress={handlePickPhoto}
              style={{
                backgroundColor: '#fae8de',
                borderRadius: 16,
                height: uploadImage
                  ? Math.min(400, (SCREEN_WIDTH - 40) * (uploadImage.height / uploadImage.width))
                  : 200,
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              {!!uploadImage ? (
                <Image source={{ uri: uploadImage.uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              ) : (
                <View style={{ alignItems: 'center', gap: 8 }}>
                  <FontAwesome5 name="camera" size={32} color="#C4614A" solid />
                  <Text style={{ color: '#C4614A', fontWeight: '600' }}>Choose Photo</Text>
                </View>
              )}
            </Pressable>
            <View>
              <Text style={{ color: '#6b7280', fontSize: 12, marginBottom: 6 }}>Caption (optional)</Text>
              <TextInput
                value={uploadCaption}
                onChangeText={setUploadCaption}
                placeholder="Add a caption…"
                placeholderTextColor="#9ca3af"
                multiline
                style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#EDD9C8', borderRadius: 12, padding: 12, fontSize: 14, color: '#3a2218', minHeight: 72 }}
              />
            </View>
          </ScrollView>
        </View>
      </Modal>

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
              {!!viewPhoto.caption && (
                <Text style={{ color: 'white', marginTop: 16, paddingHorizontal: 24, textAlign: 'center', fontSize: 15 }}>
                  {viewPhoto.caption}
                </Text>
              )}
            </>
          )}
        </View>
      </Modal>
    </View>
  );
}
