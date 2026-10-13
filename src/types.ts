export type Listing = {
  id: string;
  title: string;
  category: string;
  description: string;
  condition: string;
  price_per_day: number;
  max_rental_days?: number;
  college?: string;
  pickup_zone?: string;
  delivery_available: boolean;
  pickup_available: boolean;
  rules?: string;
  status: string;
  coverPhotoUrl?: string;
  listing_photos?: Array<{ storage_path: string; position: number }>;
  created_at: string;
  updated_at: string;
};

export type VerificationStatus =
  | "APPROVED"
  | "PROCESSING"
  | "REJECTED"
  | "MANUAL_REVIEW"
  | "RESUBMISSION_REQUIRED"
  | "PENDING";

export type UserRole = "student" | "admin" | "owner" | "customer" | "delivery_partner" | "super_admin";

export interface Profile {
  id: string;
  user_id?: string;
  name: string;
  college?: string;
  department?: string;
  year?: string;
  bio?: string;
  avatar_url?: string;
  profile_photo_url?: string | null;
  verification_status?: VerificationStatus;
  roles?: UserRole[];
  created_at: string;
  updated_at?: string;
}

export interface PublicProfile {
  id: string;
  name: string;
  college: string;
  profile_photo_url: string | null;
  verification_status: VerificationStatus;
}

export type RentalStatus =
  | 'REQUESTED'
  | 'ACCEPTED'
  | 'PAYMENT_PENDING'
  | 'CONFIRMED'
  | 'PICKUP_DELIVERY_PENDING'
  | 'ITEM_PICKED_UP'
  | 'RENTAL_ACTIVE'
  | 'RETURN_REQUESTED'
  | 'RETURN_DELIVERY'
  | 'RETURNED'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'OVERDUE'
  | 'DISPUTED'
  | 'DAMAGED_REVIEW';

export type FulfillmentType = 'PICKUP' | 'DELIVERY';
export type PaymentMethod = 'CASH' | 'UPI';
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';

export interface Rental {
  id: string;
  listing_id: string;
  renter_id: string;
  owner_id: string;
  start_date: string;
  end_date: string;
  days: number;
  price_per_day: number;
  rental_amount: number;
  security_deposit: number;
  platform_fee: number;
  total_amount: number;
  fulfillment: FulfillmentType;
  message?: string | null;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  status: RentalStatus;
  expires_at: string;
  created_at: string;
  updated_at: string;
  listing?: Listing;
  renter?: PublicProfile;
  owner?: PublicProfile;
}

export interface RentalStatusEvent {
  id: string;
  rental_id: string;
  from_status: string | null;
  to_status: string;
  changed_by: string | null;
  note: string | null;
  created_at: string;
}

export interface RentalEvidence {
  id: string;
  rental_id: string;
  type: 'HANDOVER' | 'RETURN';
  photo_paths: string[];
  signed_photo_urls?: string[];
  condition_notes?: string | null;
  damage_notes?: string | null;
  created_by: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  listing_id: string;
  rental_id?: string | null;
  renter_id: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
  listing?: Listing;
  other_user?: PublicProfile;
  last_message?: Message;
  unread_count?: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  read_at?: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  link?: string | null;
  read_at?: string | null;
  created_at: string;
}

export interface Block {
  blocker_id: string;
  blocked_id: string;
  created_at: string;
}

export interface Report {
  id: string;
  reporter_id: string;
  target_type: 'USER' | 'LISTING' | 'RENTAL' | 'MESSAGE';
  target_id: string;
  reason: string;
  created_at: string;
}

// Deprecated alias for backwards compatibility
export type RentalRequestStatus = RentalStatus;
export type DeliveryType = FulfillmentType;
export interface RentalRequest extends Rental {}
