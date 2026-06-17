import '@/app/globals.css';

export const metadata = {
  title: 'Project-OmniGuard | Enterprise Cloud Platform',
  description: 'Edge-driven Cloud Infrastructure Platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0a0f1d] text-slate-100 antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}