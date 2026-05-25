const nextCoreWebVitals = require('eslint-config-next/core-web-vitals');

const tunedNextConfig = nextCoreWebVitals.map((entry) => {
  if (entry.name !== 'next') {
    return entry;
  }

  return {
    ...entry,
    rules: {
      ...(entry.rules || {}),
      '@next/next/no-img-element': 'off',
      'react/no-unescaped-entities': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/rules-of-hooks': 'warn',
      'react-hooks/immutability': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react/display-name': 'warn',
      'import/no-anonymous-default-export': 'warn'
    }
  };
});

module.exports = [
  ...tunedNextConfig,
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
      'dist/**',
      'coverage/**',
      'cache/**',
      '.cache/**',
      'broadcast/**',
      'lib/openzeppelin-contracts/**'
    ]
  }
];
