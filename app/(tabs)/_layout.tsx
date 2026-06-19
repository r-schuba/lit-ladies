import { Tabs, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { FontAwesome5 } from '@expo/vector-icons';
import { Modal, Pressable, View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function TabIcon({ name, focused }: { name: React.ComponentProps<typeof FontAwesome5>['name']; focused: boolean }) {
  return (
    <FontAwesome5
      name={name}
      size={focused ? 20 : 18}
      color={focused ? '#C4614A' : '#b0998a'}
      solid
    />
  );
}

const MORE_ITEMS = [
  { label: 'Wishlist', description: 'Books you want to read next', icon: 'heart' as const, route: '/(tabs)/wishlist' },
  { label: 'Vote', description: 'Nominate and vote on the next pick', icon: 'check-square' as const, route: '/(tabs)/vote' },
  { label: 'Meetings', description: 'Track attendance and meeting details', icon: 'calendar-alt' as const, route: '/(tabs)/meetings' },
  { label: 'Photos', description: 'Meeting photos and memories', icon: 'images' as const, route: '/(tabs)/photos' },
];

export default function TabLayout() {
  const [showMore, setShowMore] = useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#C4614A',
          tabBarInactiveTintColor: '#b0998a',
          tabBarStyle: {
            backgroundColor: '#FDF6EE',
            borderTopColor: '#EDD9C8',
            height: 60,
            paddingBottom: 8,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            headerShown: false,
            tabBarIcon: ({ focused }) => <TabIcon name="home" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="log"
          options={{
            title: 'Log',
            tabBarIcon: ({ focused }) => <TabIcon name="book-open" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="members"
          options={{
            title: 'Members',
            tabBarIcon: ({ focused }) => <TabIcon name="users" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="generator"
          options={{
            title: 'Discover',
            tabBarIcon: ({ focused }) => <TabIcon name="magic" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="more"
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              setShowMore(true);
            },
          }}
          options={{
            title: 'More',
            tabBarLabel: () => null,
            tabBarIcon: ({ focused }) => (
              <FontAwesome5
                name="bars"
                size={focused || showMore ? 24 : 22}
                color={focused || showMore ? '#C4614A' : '#b0998a'}
                solid
              />
            ),
            tabBarItemStyle: { paddingTop: 10 },
          }}
        />
        <Tabs.Screen name="wishlist" options={{ href: null, title: 'Wishlist' }} />
        <Tabs.Screen name="vote" options={{ href: null, title: 'Vote' }} />
        <Tabs.Screen name="meetings" options={{ href: null, title: 'Meetings' }} />
        <Tabs.Screen name="photos" options={{ href: null, title: 'Photos' }} />
      </Tabs>

      <Modal visible={showMore} transparent animationType="fade" onRequestClose={() => setShowMore(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' }}
          onPress={() => setShowMore(false)}
        >
          <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'flex-end' }}>
            <Pressable
              onPress={(e) => e.stopPropagation()}
              style={{
                backgroundColor: '#FFFAF6',
                width: 280,
                height: '100%',
                paddingTop: insets.top + 56,
                paddingHorizontal: 20,
                paddingBottom: insets.bottom + 16,
              }}
            >
              {MORE_ITEMS.map((item) => (
                <Pressable
                  key={item.route}
                  onPress={() => {
                    setShowMore(false);
                    router.push(item.route as any);
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F5EBE0' }}
                >
                  <View style={{ width: 38, height: 38, backgroundColor: '#fae8de', borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
                    <FontAwesome5 name={item.icon} size={16} color="#C4614A" solid />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#1f2937', fontWeight: '600', fontSize: 15 }}>{item.label}</Text>
                    <Text style={{ color: '#9ca3af', fontSize: 12, marginTop: 1 }}>{item.description}</Text>
                  </View>
                  <FontAwesome5 name="chevron-right" size={11} color="#b0998a" />
                </Pressable>
              ))}
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
