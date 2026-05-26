import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "katex/dist/katex.min.css";
import "./globals.css";
import SessionSync from "@/components/SessionSync";

// Suisse Intl is the Krea-spec typeface; Inter is the documented substitute.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Apex Tutor — AI Math & Science Tutor",
  description:
    "99% cheaper than a real-world tutor. Expert AI tutoring in Math and Science for grade-school and high-school students. Available 24/7, personalized just for you.",
  keywords: ["tutor", "math", "science", "AI", "students", "grade school", "high school"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-void-black text-canvas-white">
        <SessionSync />
        {children}
      </body>
    </html>
  );
}
