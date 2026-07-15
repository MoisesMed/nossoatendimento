import type { Metadata } from "next";
import { Nunito_Sans } from "next/font/google";
import Providers from "@/components/Providers";
import "./globals.css";

const appFont = Nunito_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-app",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Nosso Atendimento",
  description: "SaaS multi-tenant para atendimento em restaurantes",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={appFont.variable}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
