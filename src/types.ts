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

export type UserRole = "student" | "admin" | "owner";

export interface Profile {
  id: string;
  user_id: string;
  name: string;
  college?: string;
  department?: string;
  year?: string;
  bio?: string;
  avatar_url?: string;
  profile_photo_url?: string;
  verification_status?: VerificationStatus;
  roles: UserRole[];
  created_at: string;
  updated_at: string;
}

export type RentalRequestStatus =
  | 'REQUESTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'ACTIVE'
  | 'RETURNED'
  | 'CANCELLED';

export type DeliveryType = 'PICKUP' | 'DELIVERY';

export interface RentalRequest {
  id: string;
  listing_id: string;
  renter_id: string;
  owner_id: string;
  start_date: string;
  end_date: string;
  delivery_type: DeliveryType;
  delivery_location?: string;
  total_days: number;
  total_price: number;
  status: RentalRequestStatus;
  notes?: string;
  created_at: string;
  updated_at: string;
  listing?: Listing;
  owner?: Profile;
  renter?: Profile;
}
