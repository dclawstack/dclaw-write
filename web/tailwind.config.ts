import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: "#3B82F6",
      },
    },
  },
  plugins: [],
} satisfies Config;
