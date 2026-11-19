export type ProductStatus = 'draft' | 'active' | 'archived';

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  fabric_info: string;
  fit_info: string;
  care_instructions: string;
  price: number;
  original_price: number | null;
  category: string;
  collection_name: string;
  is_new_arrival: boolean;
  is_best_seller: boolean;
  is_trending: boolean;
  is_featured: boolean;
  is_published: boolean;
  /** 013 — explicit console status, kept in sync with is_published. */
  product_status?: ProductStatus;
  tags?: string[];
  sort_order: number;
  created_at: string;
  updated_at: string;
  images?: ProductImage[];
  variants?: ProductVariant[];
  size_charts?: SizeChartRow[];
}

export interface ProductImage {
  id: string;
  product_id: string;
  url: string;
  alt_text: string;
  color_name: string | null;
  display_order: number;
  is_primary: boolean;
  created_at: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  sku: string | null;
  color_name: string;
  color_hex: string;
  size_name: string;
  stock_quantity: number;
  low_stock_threshold: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SizeChartRow {
  id: string;
  product_id: string;
  size_name: string;
  size_order: number;
  weight_min_kg: number;
  weight_max_kg: number;
  height_min_cm: number;
  height_max_cm: number;
  waist_cm: string;
  hip_cm: string;
  inseam_cm: string;
  length_cm: string;
  thigh_cm: string;
  created_at: string;
}

export interface Customer {
  id: string;
  auth_user_id?: string | null;
  full_name: string | null;
  email: string;
  phone: string | null;
  governorate: string | null;
  city: string | null;
  address: string | null;
  is_registered?: boolean;
  registered_at?: string | null;
  created_at: string;
  updated_at: string;
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'ready'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export interface OrderTrackingStage {
  step: number;
  code: 'accepted' | 'preparing' | 'ready' | 'out_for_delivery' | 'delivered' | 'cancelled';
  label: string;
  description: string;
  is_completed: boolean;
  is_cancelled: boolean;
}

export interface OrderItem {
  id?: string;
  order_id?: string;
  product_id?: string | null;
  variant_id?: string | null;
  product_name: string;
  product_slug: string | null;
  product_image: string | null;
  color_name: string;
  color_hex: string | null;
  size_name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
}

export interface Order {
  id: string;
  order_reference: string;
  customer_id: string;
  auth_user_id?: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  governorate: string;
  city: string;
  delivery_address: string;
  order_notes: string;
  payment_method: 'COD';
  subtotal: number;
  shipping_cost?: number;
  email_discount_amount: number;
  loyalty_discount_amount?: number;
  loyalty_discount_percent?: number;
  loyalty_free_reward_amount?: number;
  loyalty_free_reward_product_name?: string | null;
  loyalty_reward_type?: LoyaltyRewardType | null;
  loyalty_order_seq?: number | null;
  promo_discount_amount: number;
  discount_total: number;
  applied_promo_code: string | null;
  total_amount: number;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
  order_items?: OrderItem[];
}

export interface DiscountRule {
  id: string;
  code: string | null;
  name: string;
  description: string;
  rule_type: 'email_auto' | 'promo_code';
  discount_percent: number;
  min_order_amount: number;
  max_uses: number | null;
  uses_count: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NavLinkItem {
  label: string;
  path: string;
}

export interface SocialLinks {
  instagram?: string;
  tiktok?: string;
  youtube?: string;
  x?: string;
  facebook?: string;
  whatsapp?: string;
}

/** One ordered, individually switchable social destination shown on the site. */
export interface SocialChannel {
  key: keyof SocialLinks;
  label: string;
  url: string;
  enabled: boolean;
}

export interface SiteSettings {
  id: string;
  hero_bg_text: string;
  hero_script_text: string;
  hero_tagline: string;
  hero_collection_label: string;
  hero_cta_label: string;
  products_heading: string;
  products_subheading: string;
  newsletter_text: string;
  footer_tagline: string;
  copyright_text: string;
  nav_links: NavLinkItem[];
  footer_links: NavLinkItem[];
  social_links: SocialLinks;
  /** 013 — website control without code. */
  hero_cta_href: string;
  hero_image_url: string;
  newsletter_description: string;
  newsletter_cta_label: string;
  contact_email: string;
  contact_phone: string;
  whatsapp_url: string;
  announcement_text: string;
  announcement_enabled: boolean;
  social_channels: SocialChannel[];
  content_blocks: Record<string, string>;
  home_collection_mode: 'catalog' | 'featured';
  home_collection_limit: number;
  updated_at?: string;
}

export interface CartItem {
  variant_id: string;
  product_id: string;
  product_name: string;
  product_slug: string;
  product_image: string | null;
  color_name: string;
  color_hex: string;
  size_name: string;
  unit_price: number;
  original_price: number | null;
  quantity: number;
  max_stock: number;
}

export interface QuoteResponse {
  valid: boolean;
  stock_errors: string[];
  items: Array<{
    variant_id: string;
    product_id: string;
    product_name: string;
    product_slug: string;
    product_image: string | null;
    color_name: string;
    color_hex: string;
    size_name: string;
    unit_price: number;
    quantity: number;
    available_stock: number;
    line_total: number;
  }>;
  subtotal: number;
  shipping_cost?: number;
  email_discount_applied: boolean;
  email_discount_percent: number;
  email_discount_amount: number;
  email_discount_eligible?: boolean;
  email_discount_already_used?: boolean;
  loyalty_discount_eligible?: boolean;
  loyalty_discount_applied?: boolean;
  loyalty_discount_percent?: number;
  loyalty_discount_amount?: number;
  loyalty_reward_type?: LoyaltyRewardType | null;
  loyalty_order_seq?: number | null;
  both_discounts_eligible?: boolean;
  free_reward_available?: boolean;
  free_reward_applied?: boolean;
  free_reward_amount?: number;
  free_reward_product_name?: string | null;
  free_reward_variant_id?: string | null;
  free_reward_seq?: number | null;
  free_reward_source?: 'milestone' | null;
  /** Always 0 under the strict same-order model; kept for wire compatibility. */
  free_rewards_available?: number;
  promo_code_applied: string | null;
  promo_discount_percent: number;
  promo_discount_amount: number;
  promo_error: string | null;
  discount_total: number;
  final_total: number;
}

export interface OrderConfirmationData {
  order_id: string;
  order_reference: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  governorate: string;
  city: string;
  delivery_address: string;
  order_notes: string;
  payment_method: 'COD';
  subtotal: number;
  shipping_cost?: number;
  email_discount_amount: number;
  loyalty_discount_amount?: number;
  loyalty_discount_percent?: number;
  loyalty_free_reward_amount?: number;
  loyalty_free_reward_product_name?: string | null;
  loyalty_reward_type?: LoyaltyRewardType | null;
  loyalty_order_seq?: number | null;
  promo_discount_amount: number;
  discount_total: number;
  applied_promo_code: string | null;
  total_amount: number;
  status: OrderStatus;
  tracking?: OrderTrackingStage;
  created_at: string;
  updated_at?: string;
  items: OrderItem[];
}

export interface TrackedOrderData {
  order_reference: string;
  status: OrderStatus;
  tracking: OrderTrackingStage;
  payment_method: 'COD';
  subtotal: number;
  shipping_cost?: number;
  email_discount_amount: number;
  loyalty_discount_amount?: number;
  loyalty_discount_percent?: number;
  loyalty_free_reward_amount?: number;
  loyalty_free_reward_product_name?: string | null;
  loyalty_reward_type?: LoyaltyRewardType | null;
  loyalty_order_seq?: number | null;
  promo_discount_amount: number;
  discount_total: number;
  applied_promo_code: string | null;
  total_amount: number;
  city: string;
  governorate: string;
  created_at: string;
  updated_at?: string;
  items: OrderItem[];
}

export interface CustomerOrderHistoryItem extends TrackedOrderData {
  order_id: string;
  is_completed: boolean;
  is_cancelled: boolean;
}

export type LoyaltyRewardType = 'percent_10' | 'percent_20' | 'free_pants';
export type LoyaltyRewardStatus = 'earned' | 'reserved' | 'redeemed' | 'void';

/** A reward attached to (or waiting for) one of this customer's own orders. */
export interface LoyaltyReward {
  id: string;
  reward_type: LoyaltyRewardType;
  label: string | null;
  status: 'available' | 'reserved' | 'redeemed';
  milestone_seq: number;
  cycle_number: number;
  milestone_order_in_cycle: number;
  order_reference: string | null;
  order_status: OrderStatus | null;
  discount_amount: number;
  free_product_name: string | null;
  applied_at: string;
}

export interface LoyaltyRedemption {
  id: string;
  reward_type: LoyaltyRewardType;
  label: string | null;
  milestone_seq: number;
  order_reference: string | null;
  redeemed_at: string;
  discount_amount: number;
  free_product_name: string | null;
}

/** The reward waiting for the customer's next order ("unlocked by delivery"). */
export interface LoyaltyNextReward {
  reward_type: LoyaltyRewardType | null;
  label: string | null;
  /** Position inside the current 1-5 card. */
  target_order: number;
  /** Absolute milestone sequence, kept for cross-referencing. */
  target_seq?: number;
  orders_remaining: number;
  /**
   * True when this reward is unlocked and still unspent. False means an
   * undelivered order already holds it, so the next checkout is regular.
   */
  available?: boolean;
  /** Percentage configured for this milestone (10 by default). */
  percent?: number | null;
}

/** One row of the configured five-order programme. */
export interface LoyaltyProgramMilestone {
  slot: number;
  reward_type: LoyaltyRewardType | null;
  label: string;
  percent: number;
}

export interface LoyaltyProgram {
  cycle_length: number;
  milestones: LoyaltyProgramMilestone[];
  milestone_3_percent: number;
  milestone_4_percent: number;
  milestone_5_reward_type: 'free_pants';
  effective_from: string | null;
  pending_change: {
    milestone_3_percent: number;
    milestone_4_percent: number;
    effective_from: string;
  } | null;
}

export type LoyaltyMilestoneState =
  | 'upcoming'
  | 'next'
  | 'completed'
  | 'applied'
  | 'rewarded'
  | 'available';

export interface LoyaltyMilestone {
  seq: number;
  order_in_cycle: number;
  reward_type: LoyaltyRewardType | null;
  label: string | null;
  state: LoyaltyMilestoneState;
  order_reference: string | null;
  discount_amount: number;
  free_product_name: string | null;
}

export interface CustomerAccountOverview {
  profile: {
    id: string;
    email: string;
    full_name: string;
    phone: string;
    governorate: string;
    city: string;
    created_at: string | null;
  };
  purchase_summary: {
    completed_purchases: number;
    total_orders: number;
  };
  loyalty: {
    target_purchases: number;
    completed_purchases: number;
    qualifying_purchases: number;
    progress_in_cycle: number;
    purchases_remaining: number;
    earned_rewards: number;
    redeemed_rewards: number;
    /** Free pairs of pants available to redeem (one reward = exactly one pair). */
    available_rewards: number;
    available_free_pants: number;
    available_percent_rewards: number;
    free_product_unlocked: boolean;
    /** Always null: the fifth-order reward never expires. */
    free_reward_expires_at?: string | null;
    in_flight_purchases: number;
    next_order_seq: number | null;
    next_order_in_cycle: number | null;
    next_reward: LoyaltyNextReward | null;
    milestones: LoyaltyMilestone[];
    rewards: LoyaltyReward[];
    redemption_history: LoyaltyRedemption[];
  };
  discounts: {
    loyalty_target_purchases: number;
    loyalty_discount_percent: number;
    loyalty_discount_eligible: boolean;
    purchases_until_loyalty_discount: number | null;
    email_discount_percent: number;
    email_submitted: boolean;
    email_discount_used: boolean;
    email_discount_eligible: boolean;
    both_eligible_non_stacking: boolean;
    effective_discount_percent: number;
  };
  orders: CustomerOrderHistoryItem[];
}
