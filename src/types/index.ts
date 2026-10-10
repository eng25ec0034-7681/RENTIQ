export type VerificationStatus = 
  | "PENDING"
  | "PROCESSING"
  | "APPROVED"
  | "REJECTED"
  | "MANUAL_REVIEW"
  | "RESUBMISSION_REQUIRED";

export type UserRole = "customer" | "owner" | "delivery_partner" | "admin" | "super_admin";

export interface Profile {
  id: string;
  name: string;
  college: string;
  department: string;
  year: string;
  bio: string;
  profile_photo_url: string | null;
  verification_status: VerificationStatus;
  created_at: string;
}

export interface PublicProfile {
  id: string;
  name: string;
  college: string;
  profile_photo_url: string | null;
  verification_status: VerificationStatus;
}

export interface UserRoleRecord {
  id: string;
  user_id: string;
  role: UserRole;
  created_at: string;
}
