import './globals.css';
import Script from 'next/script';

export const metadata = {
  title: 'Surf Agent Control',
  description: 'See what an AI agent can do to a page that exposes WebMCP tools — with and without Surf.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {/* polyfill: creates navigator/document.modelContext in browsers without native WebMCP */}
        <Script src="/webmcp-polyfill.js" strategy="beforeInteractive" />
        {children}
      </body>
    </html>
  );
}
