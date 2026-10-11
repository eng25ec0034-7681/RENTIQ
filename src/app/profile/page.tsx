"use client";
// src/app/profile/page.tsx
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  User,
  ShieldCheck,
  Building,
  GraduationCap,
  Calendar,
  FileText,
  Camera,
  LogOut,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  XCircle,
  HelpCircle,
  RefreshCw,
  Package,
  Heart,
} from "lucide-react";
import { Profile, VerificationStatus, UserRole } from "@/types";
import { validateImageFile } from "@/lib/validations";

export default function ProfilePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [userEmail, setUserEmail] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Editable fields
  const [name, setName] = useState("");
  const [college, setCollege] = useState("");
  const [department, setDepartment] = useState("");
  const [year, setYear] = useState("");
  const [bio, setBio] = useState("");

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/profile");
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load profile");
      }

      setProfile(data.profile);
      setRoles(data.roles || []);
      setUserEmail(data.userEmail || "");

      if (data.profile) {
        setName(data.profile.name || "");
        setCollege(data.profile.college || "");
        setDepartment(data.profile.department || "");
        setYear(data.profile.year || "");
        setBio(data.profile.bio || "");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error loading profile";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, college, department, year, bio }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update profile");
      }

      setProfile(data.profile);
      setSuccess("Profile updated successfully!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error saving profile";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setSuccess(null);

    // Client-side image validation (type & size <= 2MB)
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setError(validation.error || "Invalid image file");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/profile/upload-photo", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to upload profile photo");
      }

      setProfile(data.profile);
      setSuccess("Profile photo updated successfully!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error uploading photo";
      setError(msg);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch {
      router.push("/login");
    }
  };

  const getVerificationBadge = (status?: VerificationStatus) => {
    switch (status) {
      case "APPROVED":
        return {
          label: "APPROVED",
          icon: CheckCircle2,
          className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
        };
      case "PROCESSING":
        return {
          label: "PROCESSING",
          icon: Clock,
          className: "bg-blue-500/10 text-blue-400 border-blue-500/30",
        };
      case "REJECTED":
        return {
          label: "REJECTED",
          icon: XCircle,
          className: "bg-red-500/10 text-red-400 border-red-500/30",
        };
      case "MANUAL_REVIEW":
        return {
          label: "MANUAL REVIEW",
          icon: HelpCircle,
          className: "bg-purple-500/10 text-purple-400 border-purple-500/30",
        };
      case "RESUBMISSION_REQUIRED":
        return {
          label: "RESUBMISSION REQUIRED",
          icon: RefreshCw,
          className: "bg-amber-500/10 text-amber-400 border-amber-500/30",
        };
      case "PENDING":
      default:
        return {
          label: "PENDING",
          icon: Clock,
          className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
        };
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <Loader2 className="w-8 h-8 text-brand-teal animate-spin" />
      </div>
    );
  }

  const vBadge = getVerificationBadge(profile?.verification_status);
  const VIcon = vBadge.icon;

  return (
    <div className="flex-1 px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Student Profile</h1>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl hover:bg-red-500/20 transition min-h-[44px]"
        >
          <LogOut className="w-4 h-4" />
          Log Out
        </button>
      </div>

      {/* Error / Success Alerts */}
      {error && (
        <div className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="mb-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      {/* Photo & Status Card */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 mb-6 flex flex-col items-center text-center relative">
        <div className="relative mb-3">
          <div className="w-24 h-24 rounded-full overflow-hidden bg-slate-800 border-2 border-brand-teal/40 flex items-center justify-center shadow-lg">
            {profile?.profile_photo_url ? (
              // eslint-disable-next-next/no-img-element
              <img src={profile.profile_photo_url} alt={profile.name} className="w-full h-full object-cover" />
            ) : (
              <User className="w-12 h-12 text-slate-500" />
            )}
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-brand-teal text-slate-950 flex items-center justify-center shadow hover:scale-110 transition min-h-[44px] min-w-[44px]"
            title="Upload Photo"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handlePhotoUpload}
            accept="image/*"
            className="hidden"
            id="profile-photo-input"
          />
        </div>
        <h2 className="text-xl font-bold text-white mb-0.5">{profile?.name || "Student"}</h2>
        <p className="text-xs text-slate-400 mb-3">{userEmail}</p>

        {/* Verification Status Badge */}
        <div className="flex items-center gap-2 mb-3">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold ${vBadge.className}`}>
            <VIcon className="w-3.5 h-3.5" />
            Verification: {vBadge.label}
          </span>
        </div>

        {/* Roles List (Read Only) */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 mt-1">
          <span className="text-[11px] font-semibold uppercase text-slate-400 mr-1">Roles:</span>
          {roles.map((r: any) => (
            <span key={r} className="px-2.5 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-[11px] font-medium text-slate-300 capitalize">
              {r.replace("_", " ")}
            </span>
          ))}
        </div>
      </div>

      {/* My Listings & Favorites Quick Access */}
      <div className="grid grid-cols-2 gap-3 mt-4 mb-6">
        <Link
          href="/my-listings"
          className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-brand-teal/50 hover:bg-slate-800/60 transition group min-h-[56px] shadow-sm"
        >
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-brand-teal group-hover:scale-105 transition-transform shrink-0">
            <Package className="w-5 h-5" />
          </div>
          <div className="text-left">
            <div className="text-sm font-semibold text-white">My Listings</div>
            <div className="text-[11px] text-slate-400">View & manage items</div>
          </div>
        </Link>

        <Link
          href="/favorites"
          className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-rose-500/50 hover:bg-slate-800/60 transition group min-h-[56px] shadow-sm"
        >
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 group-hover:scale-105 transition-transform shrink-0">
            <Heart className="w-5 h-5 fill-rose-500/30" />
          </div>
          <div className="text-left">
            <div className="text-sm font-semibold text-white">Favorites</div>
            <div className="text-[11px] text-slate-400">Saved items</div>
          </div>
        </Link>
      </div>

      {/* Edit Profile Form */}
      <form onSubmit={handleSaveProfile} className="space-y-4">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">Edit Profile Information</h3>
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Full Name</label>
          <div className="relative">
            <User className="w-5 h-5 absolute left-3.5 top-3.5 text-slate-500" />
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-white text-base focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal transition min-h-[44px]"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">College / University</label>
          <div className="relative">
            <Building className="w-5 h-5 absolute left-3.5 top-3.5 text-slate-500" />
            <input
              type="text"
              value={college}
              onChange={(e) => setCollege(e.target.value)}
              placeholder="e.g. Oxford Institute of Tech"
              className="w-full pl-11 pr-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-white text-base placeholder-slate-500 focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal transition min-h-[44px]"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Department</label>
            <div className="relative">
              <GraduationCap className="w-5 h-5 absolute left-3.5 top-3.5 text-slate-500" />
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. CSE"
                className="w-full pl-11 pr-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-white text-base placeholder-slate-500 focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal transition min-h-[44px]"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Year of Study</label>
            <div className="relative">
              <Calendar className="w-5 h-5 absolute left-3.5 top-3.5 text-slate-500" />
              <input
                type="text"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="e.g. 3rd Year"
                className="w-full pl-11 pr-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-white text-base placeholder-slate-500 focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal transition min-h-[44px]"
              />
            </div>
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Bio</label>
          <div className="relative">
            <FileText className="w-5 h-5 absolute left-3.5 top-3.5 text-slate-500" />
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell other students a bit about yourself..."
              className="w-full pl-11 pr-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-white text-base placeholder-slate-500 focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal transition resize-none"
            />
          </div>
        </div>
        {/* Read-Only Status & Role Warning */}
        <div className="p-3 bg-slate-900/50 border border-slate-800 rounded-xl text-xs text-slate-400 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-brand-teal shrink-0" />
          <span>Verification status & assigned roles are managed securely by campus admins.</span>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="w-full py-3.5 px-4 bg-brand-teal text-slate-950 font-bold rounded-xl shadow-lg shadow-brand-teal/20 hover:bg-brand-teal-light transition duration-150 flex items-center justify-center gap-2 min-h-[44px] disabled:opacity-50 mt-4"
        >
          {saving ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Saving Profile...
            </>
          ) : (
            "Save Changes"
          )}
        </button>
      </form>
    </div>
  );
}
