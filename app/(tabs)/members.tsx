import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase, Member } from '../../lib/supabase';
import { ScreenHeader } from '../../components/ScreenHeader';

export default function MembersScreen() {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadMembers();
    }, [])
  );

  async function loadMembers() {
    const { data } = await supabase.from('members').select('*').order('name');
    setMembers((data ?? []) as Member[]);
    setLoading(false);
  }

  async function addMember() {
    if (!newName.trim()) return;
    setAdding(true);
    const { error } = await supabase.from('members').insert({ name: newName.trim() });
    if (error) {
      console.error('Error adding member', error.message);
    } else {
      setNewName('');
      loadMembers();
    }
    setAdding(false);
  }

  async function removeMember(memberId: string) {
    await supabase.from('members').delete().eq('id', memberId);
    setConfirmingRemove(null);
    loadMembers();
  }

  return (
    <ScrollView className="flex-1 bg-cream-100" contentContainerStyle={{ padding: 20 }}>
      <ScreenHeader title="Members" subtitle="Manage club members" />

      <View className="flex-row gap-2 mb-5">
        <TextInput
          value={newName}
          onChangeText={setNewName}
          placeholder="Member name..."
          placeholderTextColor="#9ca3af"
          style={{ fontSize: 16 }}
              className="flex-1 border border-cream-300 bg-cream-50 rounded-xl px-4 py-3 text-sm text-[#3a2218]"
          onSubmitEditing={addMember}
        />
        <Pressable
          onPress={addMember}
          disabled={adding}
          className="bg-brand-500 rounded-xl px-4 py-3 items-center justify-center"
        >
          {adding ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Text className="text-white font-semibold text-sm">Add</Text>
          )}
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color="#db2777" />
      ) : members.length === 0 ? (
        <Text className="text-gray-400 text-sm text-center mt-8">
          No members yet. Add your first member above!
        </Text>
      ) : (
        members.map((m) => (
          <View
            key={m.id}
            className="flex-row items-center bg-cream-50 rounded-xl px-4 py-3 mb-2"
            style={{ shadowColor: '#8c3e2e', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 5, elevation: 2 }}
          >
            <Pressable
              onPress={() => router.push(`/member/${m.id}`)}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}
            >
              {m.avatar_url ? (
                <Image
                  source={{ uri: m.avatar_url }}
                  style={{ width: 36, height: 36, borderRadius: 18 }}
                  resizeMode="cover"
                />
              ) : (
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#fae8de', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#C4614A', fontWeight: 'bold', fontSize: 14 }}>{m.name.charAt(0).toUpperCase()}</Text>
                </View>
              )}
              <Text style={{ color: '#1f2937', fontWeight: '500' }}>{m.name}</Text>
            </Pressable>
            {confirmingRemove === m.id ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Pressable
                  onPress={() => removeMember(m.id)}
                  style={{ backgroundColor: '#fee2e2', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4 }}
                >
                  <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '600' }}>Confirm</Text>
                </Pressable>
                <Pressable
                  onPress={() => setConfirmingRemove(null)}
                  style={{ backgroundColor: '#f3f4f6', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4 }}
                >
                  <Text style={{ color: '#6b7280', fontSize: 12 }}>Cancel</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={() => setConfirmingRemove(m.id)}
                style={{ paddingLeft: 16, paddingVertical: 4 }}
              >
                <Text style={{ color: '#f87171', fontSize: 14 }}>Remove</Text>
              </Pressable>
            )}
          </View>
        ))
      )}
    </ScrollView>
  );
}
