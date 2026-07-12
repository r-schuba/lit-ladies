import React from 'react';
import { View, Text, TextInput, ActivityIndicator } from 'react-native';

type Props = {
  memberName: string;
  score: string;
  onScoreChange: (v: string) => void;
  onBlur?: () => void;
  saving?: boolean;
};

export function RatingInput({ memberName, score, onScoreChange, onBlur, saving }: Props) {
  return (
    <View className="flex-row items-center justify-between py-2 border-b border-gray-100">
      <Text className="text-gray-700 text-sm flex-1">{memberName}</Text>
      <View className="flex-row items-center gap-2">
        {saving && <ActivityIndicator size="small" color="#C4614A" />}
        <TextInput
          value={score}
          onChangeText={onScoreChange}
          onBlur={onBlur}
          keyboardType="decimal-pad"
          placeholder="1–10"
          placeholderTextColor="#9ca3af"
          maxLength={4}
          style={{ fontSize: 16 }}
              className="border border-gray-200 rounded-lg px-3 py-1.5 w-20 text-center text-sm text-gray-900"
        />
        <Text className="text-gray-400 text-xs">/10</Text>
      </View>
    </View>
  );
}
