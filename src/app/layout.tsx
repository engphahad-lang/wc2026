import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'مسابقة الخبير - كأس العالم 2026',
  description: 'توقع النتائج وتنافس مع الأصدقاء في كأس العالم 2026',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;900&display=swap" rel="stylesheet" />
      </head>
      <body className="font-arabic bg-navy text-white min-h-screen">
        {children}
      </body>
    </html>
  )
}
