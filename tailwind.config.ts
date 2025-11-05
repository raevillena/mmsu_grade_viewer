// Tailwind CSS v4 uses CSS-first configuration
// The theme is now defined in globals.css using @theme
// This config file is kept for compatibility but may not be needed in v4
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
};

export default config;

