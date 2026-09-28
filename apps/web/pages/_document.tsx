import { Html, Head, Main, NextScript } from 'next/document';

const themeScript = `
(function() {
  // Must match ThemeContext.shouldBeDarkBasedOnOS — if the pre-hydration
  // guess and the context disagree, the page flips theme after mount.
  function shouldBeDarkBasedOnOS() {
    try {
      return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    } catch (e) {
      return false;
    }
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
        return shouldBeDarkBasedOnOS();
      }
      return themeMode === 'dark';
    } catch (e) {}
    return shouldBeDarkBasedOnOS();
  }
  
  if (getInitialTheme()) {
    document.documentElement.classList.add('dark');
  }
})();
`;

/**
 * REMOVED: Wallet button is no longer hidden during onboarding
 * Users should be able to connect wallet anytime
 * The onboarding flow is now optional and parallel to wallet connection
 */

export default function Document() {
  return (
    <Html lang="en" suppressHydrationWarning>
      <Head>
        <link rel="icon" href="/icon.png" />
        <link rel="manifest" href="/manifest.json" />
        {/* Browser chrome follows the page surface (body bg-gray-100 / dark:bg-gray-900). */}
        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#f3f4f6" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#111827" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        {/* status-bar-style lives in _app (black-translucent, pairs with viewport-fit=cover). */}
        <meta name="apple-mobile-web-app-title" content="DiversiFi" />
        <link rel="apple-touch-icon" href="/icon.png" />
      </Head>
      <body className="bg-gray-100 dark:bg-gray-900 transition-colors duration-300">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
