import type { Metadata } from 'next';
import '@/styles/globals.css';
import '@/styles/markdown.css';
import 'katex/dist/katex.min.css';

export const metadata: Metadata = {
  title: 'Better Markdown to PDF',
  description: 'A polished markdown-to-PDF web application with LaTeX support',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const theme = localStorage.getItem('theme') || 'light';
                document.documentElement.setAttribute('data-theme', theme);
              })();
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
