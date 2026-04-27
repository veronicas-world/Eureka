import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ['var(--font-jetbrains)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        sans: ['var(--font-jetbrains)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        paper:       "var(--paper)",
        surface:     "var(--surface)",
        ink:         "var(--ink)",
        "ink-soft":  "var(--ink-soft)",
        "ink-faint": "var(--ink-faint)",
        "ink-ghost": "var(--ink-ghost)",
        accent:      "var(--accent)",
        "accent-deep": "var(--accent-deep)",
        "accent-bg": "var(--accent-bg)",
        nav:         "var(--nav)",
      },
      borderColor: {
        hairline:  "var(--hairline)",
        hairline2: "var(--hairline-2)",
      },
    },
  },
  plugins: [],
};
export default config;
