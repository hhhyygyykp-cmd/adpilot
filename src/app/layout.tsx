import type { Metadata } from "next";
import { cookies } from "next/headers";
import { IBM_Plex_Sans_Arabic, Instrument_Serif, Manrope, Noto_Naskh_Arabic } from "next/font/google";
import { Providers } from "@/components/providers";
import type { Language } from "@/lib/types";
import { LANG_COOKIE } from "@/lib/types";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

const instrument = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-instrument",
});

const ibmArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600"],
  variable: "--font-ibm-arabic",
});

const naskh = Noto_Naskh_Arabic({
  subsets: ["arabic"],
  weight: ["400", "700"],
  variable: "--font-naskh",
});

export const metadata: Metadata = {
  title: "AdPilot — Your AI advertising agency",
  description:
    "Tell us what you want to promote. Your AI advertising agency handles the rest.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const langCookie = (await cookies()).get(LANG_COOKIE)?.value;
  const language: Language = langCookie === "ar" ? "ar" : "en";
  return (
    <html
      lang={language}
      dir={language === "ar" ? "rtl" : "ltr"}
      className={`${manrope.variable} ${instrument.variable} ${ibmArabic.variable} ${naskh.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <Providers initialLanguage={language}>{children}</Providers>
      </body>
    </html>
  );
}
