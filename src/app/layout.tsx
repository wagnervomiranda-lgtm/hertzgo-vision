import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "HertzGo Vision",
  description: "Dashboard operacional de eletropostos HertzGo",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "HertzGo",
  },
  icons: {
    apple: "/icon-180.png",
    icon: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#080b10",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="apple-touch-icon" href="/icon-180.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="HertzGo" />
        <style>{`
          html, body {
            background-color: #080b10 !important;
            margin: 0;
            padding: 0;
          }
        `}</style>
      </head>
      <body style={{backgroundColor:"#080b10",margin:0,padding:0}}>{children}</body>
    </html>
  );
}