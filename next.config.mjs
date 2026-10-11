const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://mdyvponmttlgyitzfbto.supabase.co";
let supabaseHost = "mdyvponmttlgyitzfbto.supabase.co";
try {
  supabaseHost = new URL(supabaseUrl).hostname;
} catch (_) {}

export default {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: supabaseHost,
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "mdyvponmttlgyitzfbto.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};
