import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Sora, JetBrains_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { Toaster } from "react-hot-toast";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-app-sans",
});

const sora = Sora({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-app-heading",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-app-mono",
});

export const metadata: Metadata = {
  title: "GET - Grandes Écoles de Tananarive",
  description: "Plateforme de gestion des candidatures post-bac",
  // Le site gère lui-même le FR/EN (voir LanguageSwitcher) : on désactive
  // la traduction automatique du navigateur, qui entre en conflit avec le
  // rendu React et duplique/mélange le texte lors du changement de langue.
  other: { google: "notranslate" },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      translate="no"
      className={`notranslate ${jakarta.variable} ${sora.variable} ${jetbrainsMono.variable}`}
    >
      <body className="antialiased min-h-screen">
        <NextIntlClientProvider>
          {children}
        </NextIntlClientProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#fff',
              color: '#333',
              padding: '16px',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            },
            success: {
              style: {
                border: '2px solid #22c55e',
              },
            },
            error: {
              style: {
                border: '2px solid #ef4444',
              },
            },
          }}
        />
      </body>
    </html>
  );
}
