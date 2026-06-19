import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { buildGoogleCalendarUrl, buildIcsContent } from '../../lib/calendar';
import { ScreenHeader } from '../../components/ScreenHeader';
import { DatePickerField } from '../../components/DatePickerField';

export default function NewMeetingScreen() {
  const router = useRouter();
  const [bookTitle, setBookTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('19:00');
  const [location, setLocation] = useState('');
  const [duration, setDuration] = useState('2');
  const [description, setDescription] = useState('');

  function buildDate(): Date | null {
    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) return null;
    const [year, month, day] = date.split('-').map(Number);
    const [hour, minute] = time.split(':').map(Number);
    const d = new Date(Date.UTC(year, month - 1, day, hour, minute));
    if (isNaN(d.getTime())) return null;
    return d;
  }

  function handleGoogleCalendar() {
    const startDate = buildDate();
    if (!startDate) {
      Alert.alert('Invalid date/time', 'Please use YYYY-MM-DD format for date and HH:MM for time.');
      return;
    }
    const url = buildGoogleCalendarUrl({
      title: bookTitle ? `📚 Lit Ladies: ${bookTitle}` : '📚 Lit Ladies Book Club',
      startDate,
      durationHours: parseFloat(duration) || 2,
      location: location || undefined,
      description: description || undefined,
    });
    Linking.openURL(url);
  }

  function handleDownloadIcs() {
    const startDate = buildDate();
    if (!startDate) {
      Alert.alert('Invalid date/time', 'Please use YYYY-MM-DD format for date and HH:MM for time.');
      return;
    }
    const ics = buildIcsContent({
      title: bookTitle ? `📚 Lit Ladies: ${bookTitle}` : '📚 Lit Ladies Book Club',
      startDate,
      durationHours: parseFloat(duration) || 2,
      location: location || undefined,
      description: description || undefined,
    });

    if (Platform.OS === 'web') {
      const blob = new Blob([ics], { type: 'text/calendar' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'lit-ladies-meeting.ics';
      a.click();
      URL.revokeObjectURL(url);
    } else {
      Alert.alert('ICS Content', ics.slice(0, 200) + '...', [
        { text: 'OK' },
      ]);
    }
  }

  return (
    <ScrollView className="flex-1 bg-cream-100" contentContainerStyle={{ padding: 20 }}>
      <ScreenHeader title="Plan Meeting" subtitle="Create a calendar invite" showBack />

      <View className="bg-white rounded-2xl p-5 border border-gray-100 mb-4">
        <Field
          label="Book Title"
          value={bookTitle}
          onChangeText={setBookTitle}
          placeholder="e.g. The Great Gatsby"
        />
        <DatePickerField
          label="Date"
          value={date}
          onChange={setDate}
          placeholder="Select a date"
        />
        <Field
          label="Time (HH:MM, 24h)"
          value={time}
          onChangeText={setTime}
          placeholder="19:00"
          keyboardType="numbers-and-punctuation"
        />
        <Field
          label="Location"
          value={location}
          onChangeText={setLocation}
          placeholder="e.g. Sarah's house, 123 Main St"
        />
        <Field
          label="Duration (hours)"
          value={duration}
          onChangeText={setDuration}
          placeholder="2"
          keyboardType="decimal-pad"
        />
        <Field
          label="Description (optional)"
          value={description}
          onChangeText={setDescription}
          placeholder="Bring snacks! RSVP by Friday."
          multiline
        />
      </View>

      {/* Preview */}
      {!!(bookTitle || date) && (
        <View className="bg-brand-50 rounded-2xl p-4 mb-4 border border-brand-100">
          <Text className="text-brand-800 font-semibold text-sm mb-1">Preview</Text>
          <Text className="text-brand-700 text-sm">
            📚 {bookTitle ? `Lit Ladies: ${bookTitle}` : 'Lit Ladies Book Club'}
          </Text>
          {!!date && <Text className="text-brand-600 text-xs mt-1">📅 {date} at {time}</Text>}
          {!!location && <Text className="text-brand-600 text-xs">📍 {location}</Text>}
          {!!duration && <Text className="text-brand-600 text-xs">⏱ {duration}h</Text>}
        </View>
      )}

      <Pressable
        onPress={handleGoogleCalendar}
        className="bg-blue-500 rounded-2xl py-4 items-center mb-3"
      >
        <Text className="text-white font-semibold text-base">📅 Open in Google Calendar</Text>
      </Pressable>

      <Pressable
        onPress={handleDownloadIcs}
        className="border border-gray-300 rounded-2xl py-4 items-center mb-3"
      >
        <Text className="text-gray-700 font-semibold text-base">⬇️ Download .ics File</Text>
      </Pressable>

      <Pressable
        onPress={() => router.back()}
        className="py-4 items-center"
      >
        <Text className="text-gray-400 text-sm">Back</Text>
      </Pressable>
    </ScrollView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  keyboardType?: any;
  multiline?: boolean;
}) {
  return (
    <View className="mb-4">
      <Text className="text-gray-700 text-sm font-medium mb-1">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9ca3af"
        keyboardType={keyboardType}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        className={`border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 ${
          multiline ? 'min-h-20 text-top' : ''
        }`}
      />
    </View>
  );
}
