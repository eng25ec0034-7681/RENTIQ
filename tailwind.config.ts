import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          teal: "#00E5B0",
          "teal-dark": "#00B88D",
          "teal-light": "#33EBBF",
          bg: "#090D16",
          card: "#131927",
          border: "#1E293B",
        },
      },
    },
  },
  plugins: [],
};
export default config;
