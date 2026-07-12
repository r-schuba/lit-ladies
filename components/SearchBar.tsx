import React from 'react';
import { View, TextInput, Pressable, Text } from 'react-native';

type Props = {
  value: string;
  onChangeText: (v: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  loading?: boolean;
};

export function SearchBar({ value, onChangeText, onSubmit, placeholder, loading }: Props) {
  return (
    <View className="flex-row items-center bg-white border border-gray-200 rounded-xl px-3 py-2 mb-3">
      <Text className="text-gray-400 mr-2">🔍</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        placeholder={placeholder ?? 'Search books...'}
        placeholderTextColor="#9ca3af"
        returnKeyType="search"
        style={{ fontSize: 16 }}
              className="flex-1 text-gray-900 text-sm"
      />
      <Pressable
        onPress={onSubmit}
        disabled={loading}
        className="ml-2 bg-brand-500 rounded-lg px-3 py-1.5"
      >
        <Text className="text-white text-xs font-medium">
          {loading ? '...' : 'Search'}
        </Text>
      </Pressable>
    </View>
  );
}
