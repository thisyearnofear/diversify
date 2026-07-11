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
    // Guard the first-load bundle: value-importing the @diversifi/shared
    // barrel from client code pulls the entire AI/swap/ethers stack in
    // (it's CommonJS = no tree-shaking). Deep-import the specific leaf
    // module instead, e.g. '@diversifi/shared/src/config/celo-tokens'.
    // Type-only imports are erased and therefore allowed.
    // See docs/internal/bundle-analysis-2026-07-11.md.
    files: ['hooks/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}', 'context/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'warn',
        {
          paths: [
            {
              name: '@diversifi/shared',
              message:
                'Deep-import the specific leaf module (@diversifi/shared/src/...) instead of the barrel — the barrel ships the whole AI/swap/ethers stack to the client. Type-only imports are fine.',
              allowTypeImports: true,
            },
          ],
        },
      ],
    },
  },
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
      'dist/**',
      '**/dist/**',
      'coverage/**',
      'cache/**',
      '.cache/**',
      'broadcast/**',
      'lib/openzeppelin-contracts/**'
    ]
  }
];
