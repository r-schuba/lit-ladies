import React from 'react';
import { Pressable, Text } from 'react-native';

type Props = {
  label: string;
  active: boolean;
  onPress: () => void;
};

export function FilterPill({ label, active, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-full px-3 py-1.5 mr-2 mb-2 ${
        active ? 'bg-brand-500' : 'bg-gray-100'
      }`}
    >
      <Text className={`text-xs font-medium ${active ? 'text-white' : 'text-gray-600'}`}>
        {label}
      </Text>
    </Pressable>
  );
}
