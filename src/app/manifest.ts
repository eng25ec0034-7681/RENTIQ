import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RENTIQ - Rent Smart. Spend Less.",
    short_name: "RENTIQ",
    description: "Student-only platform for rentals, printing/Xerox and delivery.",
    start_url: "/",
    display: "standalone",
    background_color: "#090D16",
    theme_color: "#00E5B0",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
