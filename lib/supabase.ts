import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Book = {
  id: string;
  title: string;
  author: string;
  author_gender: 'female' | 'male' | 'unknown' | null;
  genre: string | null;
  page_count: number | null;
  goodreads_rating: number | null;
  cover_url: string | null;
  google_books_id: string | null;
  created_at: string;
};

export type BookLog = {
  id: string;
  book_id: string;
  date_read: string | null;
  meeting_date: string | null;
  meeting_location: string | null;
  created_at: string;
  book?: Book;
  ratings?: Rating[];
};

export type Rating = {
  id: string;
  book_log_id: string;
  member_name: string;
  score: number;
  created_at: string;
};

export type WishlistItem = {
  id: string;
  book_id: string;
  suggested_by: string | null;
  created_at: string;
  book?: Book;
};

export type Vote = {
  id: string;
  book_id: string;
  member_name: string;
  created_at: string;
  book?: Book;
};

export type Member = {
  id: string;
  name: string;
  phone: string | null;
  book_personality: string | null;
  avatar_url: string | null;
};

export type MemberFavoriteBook = {
  id: string;
  member_id: string;
  book_id: string;
  created_at: string;
  book?: Book;
};

export type MeetingAttendee = {
  id: string;
  book_log_id: string;
  member_id: string;
  created_at: string;
};

export type MeetingPhoto = {
  id: string;
  book_log_id: string;
  photo_url: string;
  caption: string | null;
  created_at: string;
};
