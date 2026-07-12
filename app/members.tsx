import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase, Member } from '../lib/supabase';
import { ScreenHeader } from '../components/ScreenHeader';

export default function MembersScreen() {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    loadMembers();
  }, []);

  async function loadMembers() {
    const { data } = await supabase.from('members').select('*').order('name');
    setMembers((data ?? []) as Member[]);
    setLoading(false);
  }

  async function addMember() {
    if (!newName.trim()) return;
    setAdding(true);
    const { error } = await supabase.from('members').insert({ name: newName.trim() });
    console.log('addMember result:', error);
    if (error) {
      Alert.alert('Error adding member', `${error.message}\n\nCode: ${error.code}`);
    } else {
      setNewName('');
      loadMembers();
    }
    setAdding(false);
  }

  async function removeMember(member: Member) {
    Alert.alert('Remove Member?', `Remove ${member.name} from the club?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('members').delete().eq('id', member.id);
          loadMembers();
        },
      },
    ]);
  }

  return (
    <ScrollView className="flex-1 bg-cream-100" contentContainerStyle={{ padding: 20 }}>
      <ScreenHeader title="Members" subtitle="Manage club members" showBack />

      <View className="flex-row gap-2 mb-5">
        <TextInput
          value={newName}
          onChangeText={setNewName}
          placeholder="Member name..."
          placeholderTextColor="#9ca3af"
          style={{ fontSize: 16 }}
              className="flex-1 border border-gray-200 bg-white rounded-xl px-4 py-3 text-sm text-gray-900"
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
          <Pressable
            key={m.id}
            onPress={() => router.push(`/member/${m.id}`)}
            className="flex-row items-center justify-between bg-white rounded-xl px-4 py-3 mb-2 border border-gray-100"
          >
            <Text className="text-gray-800 font-medium">{m.name}</Text>
            <Pressable
              onPress={(e) => { e.stopPropagation(); removeMember(m); }}
            >
              <Text className="text-red-400 text-sm">Remove</Text>
            </Pressable>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}
