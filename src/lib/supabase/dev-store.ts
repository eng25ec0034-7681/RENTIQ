import fs from "fs";
import path from "path";
import crypto from "crypto";

export interface DevUser {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  created_at: string;
}

export interface DevProfile {
  id: string;
  name: string;
  college: string;
  department: string;
  year: string;
  bio: string;
  profile_photo_url: string | null;
  verification_status: "PENDING" | "PROCESSING" | "APPROVED" | "REJECTED" | "MANUAL_REVIEW" | "RESUBMISSION_REQUIRED";
  created_at: string;
}

export interface DevRole {
  id: string;
  user_id: string;
  role: "customer" | "owner" | "delivery_partner" | "admin" | "super_admin";
  created_at: string;
}

interface DevDatabase {
  users: DevUser[];
  profiles: DevProfile[];
  roles: DevRole[];
}

const DB_PATH = path.join(process.cwd(), "scratch", "local-dev-db.json");

function ensureDbExists(): DevDatabase {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(DB_PATH)) {
    const initialDb: DevDatabase = { users: [], profiles: [], roles: [] };
    fs.writeFileSync(DB_PATH, JSON.stringify(initialDb, null, 2), "utf-8");
    return initialDb;
  }

  try {
    const content = fs.readFileSync(DB_PATH, "utf-8");
    return JSON.parse(content) as DevDatabase;
  } catch {
    const initialDb: DevDatabase = { users: [], profiles: [], roles: [] };
    fs.writeFileSync(DB_PATH, JSON.stringify(initialDb, null, 2), "utf-8");
    return initialDb;
  }
}

function saveDb(db: DevDatabase): void {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf-8");
}

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export const devStore = {
  signUp: async (email: string, password: string, name: string) => {
    const db = ensureDbExists();

    const existingUser = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (existingUser) {
      throw new Error("User already exists with this email address");
    }

    const userId = crypto.randomUUID();
    const now = new Date().toISOString();

    const newUser: DevUser = {
      id: userId,
      email: email.toLowerCase(),
      passwordHash: hashPassword(password),
      name,
      created_at: now,
    };

    const newProfile: DevProfile = {
      id: userId,
      name,
      college: "",
      department: "",
      year: "",
      bio: "",
      profile_photo_url: null,
      verification_status: "PENDING",
      created_at: now,
    };

    const newRoles: DevRole[] = [
      { id: crypto.randomUUID(), user_id: userId, role: "customer", created_at: now },
      { id: crypto.randomUUID(), user_id: userId, role: "owner", created_at: now },
    ];

    db.users.push(newUser);
    db.profiles.push(newProfile);
    db.roles.push(...newRoles);

    saveDb(db);

    return {
      user: { id: userId, email: newUser.email, user_metadata: { name } },
      session: { access_token: `dev-session-${userId}`, user: { id: userId, email: newUser.email } },
    };
  },

  signIn: async (email: string, password: string) => {
    const db = ensureDbExists();
    const user = db.users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.passwordHash === hashPassword(password)
    );

    if (!user) {
      throw new Error("Invalid email or password");
    }

    return {
      user: { id: user.id, email: user.email, user_metadata: { name: user.name } },
      session: { access_token: `dev-session-${user.id}`, user: { id: user.id, email: user.email } },
    };
  },

  getUserById: async (userId: string) => {
    const db = ensureDbExists();
    const user = db.users.find((u) => u.id === userId);
    if (!user) return null;
    return { id: user.id, email: user.email, name: user.name };
  },

  getProfile: async (userId: string) => {
    const db = ensureDbExists();
    let profile = db.profiles.find((p) => p.id === userId);
    if (!profile) {
      const user = db.users.find((u) => u.id === userId);
      if (!user) return null;
      profile = {
        id: userId,
        name: user.name,
        college: "",
        department: "",
        year: "",
        bio: "",
        profile_photo_url: null,
        verification_status: "PENDING",
        created_at: new Date().toISOString(),
      };
      db.profiles.push(profile);
      saveDb(db);
    }
    return profile;
  },

  updateProfile: async (
    userId: string,
    updates: Partial<Omit<DevProfile, "id" | "verification_status" | "created_at">>
  ) => {
    const db = ensureDbExists();
    const index = db.profiles.findIndex((p) => p.id === userId);
    if (index === -1) {
      throw new Error("Profile not found");
    }

    const existing = db.profiles[index];
    const updated: DevProfile = {
      ...existing,
      name: updates.name ?? existing.name,
      college: updates.college ?? existing.college,
      department: updates.department ?? existing.department,
      year: updates.year ?? existing.year,
      bio: updates.bio ?? existing.bio,
      profile_photo_url: updates.profile_photo_url ?? existing.profile_photo_url,
      // verification_status remains unchanged
      verification_status: existing.verification_status,
    };

    db.profiles[index] = updated;
    saveDb(db);
    return updated;
  },

  getRoles: async (userId: string) => {
    const db = ensureDbExists();
    const roles = db.roles.filter((r) => r.user_id === userId).map((r) => r.role);
    if (roles.length === 0) {
      return ["customer", "owner"];
    }
    return roles;
  },

  savePhoto: async (userId: string, fileBuffer: Buffer, fileName: string) => {
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const fileExt = fileName.split(".").pop() || "jpg";
    const savedName = `${userId}-${Date.now()}.${fileExt}`;
    const filePath = path.join(uploadsDir, savedName);

    fs.writeFileSync(filePath, fileBuffer);

    const publicUrl = `/uploads/${savedName}`;

    // Update profile
    await devStore.updateProfile(userId, { profile_photo_url: publicUrl });

    return publicUrl;
  },
};
