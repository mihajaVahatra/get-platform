import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { Toaster } from "react-hot-toast";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-app-sans",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-app-heading",
  display: "swap",
});

export const metadata: Metadata = {
  title: "GET - Grandes Écoles de Tananarive",
  description: "Plateforme de gestion des candidatures post-bac",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${inter.variable} ${spaceGrotesk.variable} bg-background`}>
      <body className="antialiased min-h-screen font-sans">
        {children}
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
