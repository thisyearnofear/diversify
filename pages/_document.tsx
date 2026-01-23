import { Html, Head, Main, NextScript } from 'next/document';

const themeScript = `
(function() {
  function getInitialTheme() {
    try {
      const stored = localStorage.getItem('darkMode');
      if (stored !== null) {
        return stored === 'true';
      }
    } catch (e) {}
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  
  if (getInitialTheme()) {
    document.documentElement.classList.add('dark');
  }
})();
`;

export default function Document() {
  return (
    <Html lang="en" suppressHydrationWarning>
      <Head />
      <body className="bg-gray-100 dark:bg-gray-900 transition-colors duration-300">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
