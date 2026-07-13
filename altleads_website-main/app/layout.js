import { Outfit } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from '@/components/ThemeProvider';

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata = {
  title: "AltLeads — Outbound Execution, Intelligence & CRM for B2B Teams",
  description: "Multi-channel outbound execution, verified data intelligence, and workflow-first CRM orchestration. Email, LinkedIn, WhatsApp, and calls — in one system.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${outfit.variable} antialiased bg-white text-slate-900 dark:bg-black dark:text-white transition-colors duration-300`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
