import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { buildThemeVars, type UserTheme } from "@/lib/theme";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "HobbyPanel",
    template: "%s — HobbyPanel",
  },
  description:
    "A fast, modern, self-hostable Minecraft server management panel.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const rawTheme = cookieStore.get("hp_theme")?.value;
  let themeVars: Record<string, string> = {};
  if (rawTheme) {
    try {
      themeVars = buildThemeVars(JSON.parse(rawTheme) as UserTheme);
    } catch {
      // ignore malformed cookie
    }
  }

  return (
    <html
      lang="en"
      className="dark"
      suppressHydrationWarning
      style={themeVars as React.CSSProperties}
    >
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}
      >
        <div id="theme-bg" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
