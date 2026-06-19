import React from 'react';
import { View, Text, Image, Pressable } from 'react-native';
import { getLengthBucket } from '../constants/genres';

type Props = {
  title: string;
  author: string;
  coverUrl?: string | null;
  genre?: string | null;
  pageCount?: number | null;
  rating?: number | null;
  onPress?: () => void;
  rightElement?: React.ReactNode;
};

export function BookCard({
  title,
  author,
  coverUrl,
  genre,
  pageCount,
  rating,
  onPress,
  rightElement,
}: Props) {
  const bucket = pageCount ? getLengthBucket(pageCount) : null;

  return (
    <Pressable
      onPress={onPress}
      className="flex-row bg-cream-50 rounded-2xl p-3 mb-3 items-center"
      style={{ shadowColor: '#8c3e2e', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 }}
    >
      {coverUrl ? (
        <Image
          source={{ uri: coverUrl }}
          className="rounded-xl mr-3"
          style={{ width: 56, height: 82 }}
          resizeMode="cover"
        />
      ) : (
        <View className="rounded-xl mr-3 bg-brand-100 items-center justify-center" style={{ width: 56, height: 82 }}>
          <Text className="text-brand-400 text-2xl">📚</Text>
        </View>
      )}
      <View className="flex-1">
        <Text className="text-[#3a2218] font-semibold text-sm" numberOfLines={2}>
          {title}
        </Text>
        <Text className="text-[#9a7060] text-xs mt-0.5" numberOfLines={1}>
          {author}
        </Text>
        <View className="flex-row flex-wrap gap-1 mt-1.5">
          {genre && (
            <View className="bg-brand-100 rounded-full px-2 py-0.5">
              <Text className="text-brand-700 text-xs">{genre}</Text>
            </View>
          )}
          {bucket && (
            <View className="bg-cream-200 rounded-full px-2 py-0.5">
              <Text className="text-[#9a7060] text-xs">{bucket}</Text>
            </View>
          )}
        </View>
      </View>
      {rightElement && <View className="ml-2">{rightElement}</View>}
    </Pressable>
  );
}
