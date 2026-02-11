import { Html, Head, Main, NextScript } from 'next/document';

const themeScript = `
(function() {
  function shouldBeDarkBasedOnTime() {
    var hour = new Date().getHours();
    return hour >= 18 || hour < 6;
  }
  
  function getInitialTheme() {
    try {
      var themeMode = localStorage.getItem('themeMode');
      
      // Migration: check old darkMode if no themeMode
      if (!themeMode) {
        var legacyDarkMode = localStorage.getItem('darkMode');
        if (legacyDarkMode !== null) {
          themeMode = legacyDarkMode === 'true' ? 'dark' : 'light';
          localStorage.setItem('themeMode', themeMode);
        } else {
          themeMode = 'auto';
        }
      }
      
      // Calculate based on mode
      if (themeMode === 'auto') {
        return shouldBeDarkBasedOnTime();
      }
      return themeMode === 'dark';
    } catch (e) {}
    return shouldBeDarkBasedOnTime();
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
