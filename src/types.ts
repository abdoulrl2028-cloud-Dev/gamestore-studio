export type Role = 'user' | 'developer' | 'admin';
export type GameStatus = 'draft' | 'submitted' | 'in_review' | 'rejected' | 'published' | 'unpublished';
export type PlatformName = 'android' | 'windows' | 'linux' | 'macos';
export type OrderStatus = 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded';

export type Profile = {
  id: string;
  email: string | null;
  display_name: string;
  role: Role;
};

export type Game = {
  id: string;
  title: string;
  slug: string;
  description: string;
  short_description: string;
  price_cents: number;
  currency: string;
  genre: string;
  platforms: PlatformName[];
  file_size_bytes: number;
  current_version: string;
  min_requirements: string;
  recommended_requirements: string;
  cover_path: string | null;
  owner_id: string | null;
  age_rating: string;
  developer_website: string | null;
  privacy_policy_url: string | null;
  review_note: string;
  submitted_at: string | null;
  status: GameStatus;
  is_featured: boolean;
  average_rating: number;
  ratings_count: number;
  sales_count: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Category = { id: string; name: string; slug: string };
export type GameImage = { id: string; storage_path: string; alt_text: string; sort_order: number };
export type GameVideo = { id: string; storage_path: string | null; external_url: string | null; title: string };
export type GameVersion = {
  id: string;
  game_id: string;
  version_name: string;
  changelog: string;
  file_name: string;
  file_size_bytes: number;
  platform: PlatformName;
  is_latest: boolean;
  published_at: string;
};
export type Review = {
  id: string;
  rating: number;
  body: string;
  author_name: string;
  created_at: string;
  user_id: string;
};
export type OrderRow = {
  id: string;
  status: OrderStatus;
  subtotal_cents: number;
  discount_cents: number;
  total_cents: number;
  currency: string;
  payment_method: string;
  created_at: string;
  order_items: { unit_price_cents: number; games: { id: string; title: string } | null }[];
};

export const GAME_FIELDS =
  'id, title, slug, description, short_description, price_cents, currency, genre, platforms, file_size_bytes, current_version, min_requirements, recommended_requirements, cover_path, owner_id, age_rating, developer_website, privacy_policy_url, review_note, submitted_at, status, is_featured, average_rating, ratings_count, sales_count, published_at, created_at, updated_at';

export const PLATFORMS: { id: PlatformName; label: string }[] = [
  { id: 'android', label: 'Android' },
  { id: 'windows', label: 'Windows' },
  { id: 'linux', label: 'Linux' },
  { id: 'macos', label: 'macOS' },
];
