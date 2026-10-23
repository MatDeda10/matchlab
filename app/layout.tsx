import type { Metadata, Viewport } from "next";
import { APP } from "@/lib/config/constants";
import { getDataSource } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import { ToastProvider } from "@/components/toast";
import { ThemeScript } from "@/components/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: `${APP.name} — Football intelligence`,
    template: `%s · ${APP.name}`,
  },
  description: APP.description,
  applicationName: APP.name,
  authors: [{ name: "MatchLab contributors" }],
  openGraph: {
    title: `${APP.name} — Football intelligence`,
    description: APP.description,
    type: "website",
    locale: "it_IT",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#090B10" },
    { media: "(prefers-color-scheme: light)", color: "#F5F6F8" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const dataSource = getDataSource();
  return (
    <html lang="it" data-theme="dark" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="antialiased">
        <AppShell
          isDemo={dataSource.isDemo}
          providerLabel={dataSource.label}
          warnings={dataSource.warnings}
        >
          <ToastProvider>{children}</ToastProvider>
        </AppShell>
      </body>
    </html>
  );
}
