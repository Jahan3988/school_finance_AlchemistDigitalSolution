import type { Metadata } from "next";
import { Noto_Nastaliq_Urdu } from "next/font/google";
import { LanguageProvider } from "@/i18n/provider";
import "./globals.css";

const urduFont = Noto_Nastaliq_Urdu({
  variable: "--font-urdu",
  subsets: ["arabic"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "School Finance",
  description: "School fee management and collection overview.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning className={`${urduFont.variable} h-full font-sans antialiased`}>
      <body className="min-h-full font-sans">
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
