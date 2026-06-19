import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { ScreenHeader } from '../../components/ScreenHeader';

type MenuItem = {
  label: string;
  description: string;
  icon: React.ComponentProps<typeof FontAwesome5>['name'];
  route: string;
};

const MENU_ITEMS: MenuItem[] = [
  {
    label: 'Wishlist',
    description: 'Books you want to read next',
    icon: 'heart',
    route: '/(tabs)/wishlist',
  },
  {
    label: 'Vote',
    description: 'Nominate and vote on the next pick',
    icon: 'check-square',
    route: '/(tabs)/vote',
  },
  {
    label: 'Meetings',
    description: 'Track attendance and meeting details',
    icon: 'calendar-alt',
    route: '/(tabs)/meetings',
  },
  {
    label: 'Photos',
    description: 'Meeting photos and memories',
    icon: 'images',
    route: '/(tabs)/photos',
  },
];

export default function MoreScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-cream-100">
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <ScreenHeader title="More" subtitle="More features" />
        {MENU_ITEMS.map((item) => (
          <Pressable
            key={item.route}
            onPress={() => router.push(item.route as any)}
            className="bg-cream-50 rounded-2xl px-4 py-4 mb-3 flex-row items-center gap-4"
            style={{ shadowColor: '#8c3e2e', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 }}
          >
            <View className="w-10 h-10 bg-brand-100 rounded-xl items-center justify-center">
              <FontAwesome5 name={item.icon} size={18} color="#C4614A" solid />
            </View>
            <View className="flex-1">
              <Text className="text-gray-900 font-semibold text-base">{item.label}</Text>
              <Text className="text-gray-400 text-sm mt-0.5">{item.description}</Text>
            </View>
            <FontAwesome5 name="chevron-right" size={12} color="#b0998a" />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
