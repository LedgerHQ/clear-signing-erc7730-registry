import { type Config } from "tailwindcss";

export default {
  content: ["./src/**/*.tsx"],
  theme: {
    extend: {
      fontFamily: {
        inter: ["var(--font-inter)"],
      },
      colors: {
        "light-grey": "#E0E0E0",
        "dark-grey": "#959595",
      },
    },
  },
  plugins: [],
} satisfies Config;
