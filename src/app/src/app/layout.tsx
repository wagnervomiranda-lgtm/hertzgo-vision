import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "HertzGo · Painel Operacional",
  description: "Dashboard de gestão da rede de eletropostos HertzGo",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, padding: 0, background: "#050608" }}>
        {children}
      </body>
    </html>
  );
}
