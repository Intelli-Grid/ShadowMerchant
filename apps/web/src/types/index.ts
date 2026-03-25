export interface Deal {
  _id: string;
  deal_id: string;
  title: string;
  description?: string;
  source_platform: 'amazon' | 'flipkart' | 'myntra' | 'meesho' | 'nykaa' | 'croma' | 'tatacliq';
  original_price: number;
  discounted_price: number;
  discount_percent: number;
  affiliate_url: string;
  image_url?: string;
  category?: string;
  sub_category?: string;
  brand?: string;
  rating?: number;
  rating_count?: number;
  deal_type: 'daily' | 'flash' | 'lightning' | 'clearance';
  deal_score: number;
  is_pro_exclusive: boolean;
  is_active: boolean;
  price_history: { date: string; price: number }[];
  published_at?: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

export interface User {
  _id: string;
  clerk_id: string;
  email: string;
  name?: string;
  subscription_tier: 'free' | 'pro';
  subscription_expires_at?: string;
  wishlist: string[];
  alert_preferences: {
    categories: string[];
    min_discount: number;
    platforms: string[];
    channels: string[];
  };
}

export interface Alert {
  _id: string;
  user_id: string;
  type: 'category' | 'brand' | 'price_drop' | 'keyword';
  criteria: {
    category?: string;
    brand?: string;
    keyword?: string;
    max_price?: number;
    min_discount?: number;
  };
  is_active: boolean;
}

export interface DealFilters {
  platform?: string;
  category?: string;
  min_discount?: number;
  max_price?: number;
  sort?: 'newest' | 'discount' | 'score';
  page?: number;
  limit?: number;
  pro_only?: boolean;
}

export interface ApiResponse<T> {
  deals?: T[];
  total?: number;
  page?: number;
  hasMore?: boolean;
  error?: string;
}
