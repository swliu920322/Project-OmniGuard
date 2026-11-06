/** @type {import('tailwindcss').Config} */
module.exports = {
  // 🟩 刚性锁死：迫使 Tailwind 引擎在编译时只扫描你指定的物理资产范围
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    // 语义 → CSS 映射声明在 interpreter 包内，必须纳入扫描，否则切换形式无视觉变化
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