import React from 'react';
import { View, Text } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';

type Props = {
  icon?: React.ComponentProps<typeof FontAwesome5>['name'];
  title: string;
  subtitle?: string;
};

export function EmptyState({ icon = 'book', title, subtitle }: Props) {
  return (
    <View className="flex-1 items-center justify-center py-16">
      <View className="bg-brand-100 rounded-full p-5 mb-4">
        <FontAwesome5 name={icon} size={28} color="#C4614A" solid />
      </View>
      <Text className="text-[#3a2218] font-semibold text-base text-center">{title}</Text>
      {subtitle && (
        <Text className="text-[#9a7060] text-sm text-center mt-1 px-8">{subtitle}</Text>
      )}
    </View>
  );
}
