import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ICBANQ 영업 운영 포털",
  description: "사내용 영업 운영 포털 MVP"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

