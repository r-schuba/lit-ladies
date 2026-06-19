import React, { useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView, Platform } from 'react-native';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function range(start: number, end: number) {
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

function toDate(str: string): { year: number; month: number; day: number } {
  if (str && str.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [y, m, d] = str.split('-').map(Number);
    return { year: y, month: m, day: d };
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

function toDateString(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatDisplay(str: string): string {
  const { year, month, day } = toDate(str);
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

type Props = {
  label: string;
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void;
  placeholder?: string;
};

function Column({
  items,
  selected,
  onSelect,
  display,
}: {
  items: number[];
  selected: number;
  onSelect: (v: number) => void;
  display?: (v: number) => string;
}) {
  const ITEM_HEIGHT = 44;
  return (
    <ScrollView
      style={{ flex: 1, height: ITEM_HEIGHT * 5 }}
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM_HEIGHT}
      decelerationRate="fast"
      contentContainerStyle={{ paddingVertical: ITEM_HEIGHT * 2 }}
    >
      {items.map((item) => (
        <Pressable
          key={item}
          onPress={() => onSelect(item)}
          style={{ height: ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text
            style={{
              fontSize: 18,
              color: selected === item ? '#db2777' : '#6b7280',
              fontWeight: selected === item ? '700' : '400',
            }}
          >
            {display ? display(item) : String(item)}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

export function DatePickerField({ label, value, onChange, placeholder = 'Select date' }: Props) {
  const [show, setShow] = useState(false);
  const parsed = toDate(value);
  const [tempYear, setTempYear] = useState(parsed.year);
  const [tempMonth, setTempMonth] = useState(parsed.month);
  const [tempDay, setTempDay] = useState(parsed.day);

  function handleOpen() {
    const p = toDate(value);
    setTempYear(p.year);
    setTempMonth(p.month);
    setTempDay(p.day);
    setShow(true);
  }

  function handleDone() {
    const maxDay = daysInMonth(tempYear, tempMonth);
    const safeDay = Math.min(tempDay, maxDay);
    onChange(toDateString(tempYear, tempMonth, safeDay));
    setShow(false);
  }

  const years = range(2000, new Date().getFullYear() + 2);
  const months = range(1, 12);
  const days = range(1, daysInMonth(tempYear, tempMonth));

  if (Platform.OS === 'web') {
    return (
      <View className="mb-4">
        <Text className="text-gray-700 text-sm font-medium mb-1">{label}</Text>
        {/* @ts-ignore */}
        <input
          type="date"
          value={value}
          onChange={(e: any) => onChange(e.target.value)}
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            padding: '12px 16px',
            fontSize: 14,
            color: value ? '#111827' : '#9ca3af',
            width: '100%',
            boxSizing: 'border-box',
            outline: 'none',
            fontFamily: 'inherit',
          }}
        />
      </View>
    );
  }

  return (
    <View className="mb-4">
      <Text className="text-gray-700 text-sm font-medium mb-1">{label}</Text>
      <Pressable
        onPress={handleOpen}
        className="border border-gray-200 rounded-xl px-4 py-3"
      >
        <Text className={value ? 'text-gray-900 text-sm' : 'text-gray-400 text-sm'}>
          {value ? formatDisplay(value) : placeholder}
        </Text>
      </Pressable>

      <Modal visible={show} transparent animationType="slide">
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' }}
          onPress={() => setShow(false)}
        />
        <View style={{ backgroundColor: 'white', borderTopWidth: 1, borderTopColor: '#f3f4f6' }}>
          <View className="flex-row items-center justify-between px-5 py-3 border-b border-gray-100">
            <Pressable onPress={() => setShow(false)}>
              <Text className="text-gray-500 font-medium">Cancel</Text>
            </Pressable>
            <Pressable onPress={handleDone}>
              <Text className="text-brand-500 font-semibold">Done</Text>
            </Pressable>
          </View>

          {/* Highlight bar behind selected row */}
          <View style={{ position: 'relative', paddingHorizontal: 16 }}>
            <View
              style={{
                position: 'absolute',
                top: '50%',
                left: 16,
                right: 16,
                height: 44,
                marginTop: -22,
                backgroundColor: '#fdf2f8',
                borderRadius: 10,
              }}
            />
            <View className="flex-row">
              <Column
                items={months}
                selected={tempMonth}
                onSelect={setTempMonth}
                display={(m) => MONTHS[m - 1]}
              />
              <Column
                items={days}
                selected={tempDay}
                onSelect={setTempDay}
                display={(d) => String(d)}
              />
              <Column
                items={years}
                selected={tempYear}
                onSelect={setTempYear}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
