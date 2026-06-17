/** @type {import('tailwindcss').Config} */
module.exports = {
  // 🟩 刚性锁死：迫使 Tailwind 引擎在编译时只扫描你指定的物理资产范围
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
    },
  },
  plugins: [],
};