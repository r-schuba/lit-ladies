import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';

type Props = {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  showBack?: boolean;
};

export function ScreenHeader({ title, subtitle, right, showBack }: Props) {
  const router = useRouter();
  return (
    <View className="flex-row items-center justify-between pb-4">
      <View className="flex-1 flex-row items-center gap-3">
        {showBack && (
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <FontAwesome5 name="chevron-left" size={16} color="#6b7280" />
          </Pressable>
        )}
        <View className="flex-1">
          <Text className="text-2xl font-bold text-gray-900">{title}</Text>
          {subtitle && <Text className="text-gray-500 text-sm mt-0.5">{subtitle}</Text>}
        </View>
      </View>
      {right && <View>{right}</View>}
    </View>
  );
}
