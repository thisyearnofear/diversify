const path = require('path');
const webpack = require('webpack');
const { loadEnvConfig } = require('@next/env');
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

// Keep root .env.local working after the apps/web extraction (scripts + local DX).
loadEnvConfig(path.resolve(__dirname, '../..'));

// 0G evidence-anchoring SDK include — see the scoped route keys below.
const SDK_INCLUDE = [
  '../../node_modules/@0gfoundation/0g-storage-ts-sdk/**/*',
  '../../node_modules/open-jsonrpc-provider/**/*',
  '../../node_modules/reconnecting-websocket/**/*',
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // Monorepo: include files outside apps/web in the standalone trace.
  outputFileTracingRoot: path.join(__dirname, '../..'),

  transpilePackages: [
    "@diversifi/shared",
    "@stable-station/mento-utils",
  ],

  // `ai` is ESM-only and is loaded at runtime by the server-only TypeSafe
  // Gateway adapters (Signal Lens + Ask-the-World) via literal dynamic
  // imports in apps/web server-only code. Keep it external to the CommonJS
  // shared package transform; force-include it (and its @ai-sdk/* peers)
  // into the standalone trace for the routes that call Gateway.
  serverExternalPackages: ['ai'],
  outputFileTracingIncludes: {
    // Include globs resolve relative to THIS app dir (apps/web). With
    // node-linker=hoisted the packages live at the repo-root node_modules
    // (apps/web/node_modules only holds @diversifi/@stable-station links), so
    // every glob must climb to '../../node_modules' — a './node_modules' glob
    // silently matches nothing.
    // Full Gateway runtime graph — dynamic `import('ai')` hides these from NFT.
    '/api/agent/ask-world-spike': [
      '../../node_modules/ai/**/*',
      '../../node_modules/@ai-sdk/**/*',
      '../../node_modules/@vercel/oidc/**/*',
      '../../node_modules/@standard-schema/spec/**/*',
      '../../node_modules/@workflow/serde/**/*',
      '../../node_modules/eventsource-parser/**/*',
      '../../node_modules/json-schema/**/*',
      '../../node_modules/undici/**/*',
    ],
    '/api/agent/firecrawl-webhook': [
      '../../node_modules/ai/**/*',
      '../../node_modules/@ai-sdk/**/*',
      '../../node_modules/@vercel/oidc/**/*',
      '../../node_modules/@standard-schema/spec/**/*',
      '../../node_modules/@workflow/serde/**/*',
      '../../node_modules/eventsource-parser/**/*',
      '../../node_modules/json-schema/**/*',
      '../../node_modules/undici/**/*',
    ],
    // 0G evidence anchoring — shared-0g loads the SDK via dynamic `import()` at
    // runtime; force-include the SDK plus its runtime deps that nothing else
    // traces (open-jsonrpc-provider pulls ws/axios). Scoped (2026-09-25) to the
    // routes whose bundle actually contains storage-service/persistence-service
    // — a '*' key was adding ~22 MB of SDK to every function.
    //
    // KEEP RULE (2026-10-02): an entry stays ONLY if the route can reach
    // AIService.chat()/generateChatCompletion with user-influenced content —
    // that is the sole path to anchorAndRecord. 22 entries were removed after
    // verifying each route's static graph never reaches chat (probes, status
    // checks, price feeds, speech/transcription, direct ledger reads/writes,
    // deterministic advisory synthesis). The anchoring decorator loads the
    // SDK lazily, so uncovered routes degrade to "no anchor, response
    // unaffected" rather than crashing — but do NOT re-add an entry without
    // confirming the route actually anchors, or the ~24 MB comes back.
    '/api/agent/advisor': SDK_INCLUDE,
    '/api/agent/firecrawl-webhook': SDK_INCLUDE,
    '/api/agent/guardian-loop': SDK_INCLUDE,
    '/api/agent/intelligence': SDK_INCLUDE,
    '/api/agent/memory': SDK_INCLUDE,
    '/api/agent/onramp-help': SDK_INCLUDE,
    '/api/agent/web-analyze': SDK_INCLUDE,
    '/api/agent/x402-gateway': SDK_INCLUDE,
  },

  // NOTE (2026-09-11): outputFileTracingExcludes REMOVED entirely. Both
  // attempts broke ALL /api/* lambdas in production with MODULE_NOT_FOUND for
  // next/dist/server/lib/… files. NFT's exclude globs match path SEGMENTS, so
  // even repo-root-prefixed patterns like 'contracts/**/*' prune
  // node_modules copies of traced workspace packages (pnpm symlinks
  // @diversifi/shared into node_modules, and its traced files land under
  // paths containing those segments). Storage savings come from the root
  // .vercelignore (upload-time) + lean route code, not from trace excludes.
  // Do NOT re-add outputFileTracingExcludes without a production canary.

  experimental: {
    prefetchInlining: true,
    appNewScrollHandler: true,
  },

  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        // Modules with browser polyfills (needed by wagmi, viem, ethers v6)
        stream: require.resolve('stream-browserify'),
        http: require.resolve('stream-http'),
        https: require.resolve('https-browserify'),
        os: require.resolve('os-browserify/browser'),
        assert: require.resolve('assert/'),
        url: require.resolve('url/'),
        util: require.resolve('util/'),
        buffer: require.resolve('buffer/'),
        zlib: require.resolve('browserify-zlib'),
        process: require.resolve('process/browser'),
        // crypto: polyfill removed — only needed by server-side code leaking
        // through the shared package barrel (web3.js via @celo/identity).
        // Will be properly split in the package fission (docs/roadmap.md).
        crypto: false,
        // Truly server-only modules (no browser equivalent)
        fs: false,
        net: false,
        tls: false,
        dns: false,
        child_process: false,
        readline: false,
        'dtrace-provider': false,
      };

      // tablestore (Alibaba Cloud SDK) is server-only — its browser shim
      // references bower_components paths webpack can't resolve. IgnorePlugin
      // prevents it from being bundled on the client entirely.
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /^tablestore$/,
        }),
      );

      config.plugins.push(
        new webpack.ProvidePlugin({
          Buffer: ['buffer', 'Buffer'],
          process: 'process/browser',
        })
      );
    }
    return config;
  },

  turbopack: {
    resolveAlias: {
      // Truly server-only — no browser equivalent
      fs: './lib/empty-module.js',
      net: './lib/empty-module.js',
      tls: './lib/empty-module.js',
      dns: './lib/empty-module.js',
      child_process: './lib/empty-module.js',
      readline: './lib/empty-module.js',
      'dtrace-provider': './lib/empty-module.js',
      // tablestore (Alibaba Cloud SDK) — server-only, its browser shim
      // references unresolvable bower_components paths
      tablestore: './lib/empty-module.js',
    },
  },

  // Route every API request to Hetzner (always-on, no cold starts, no 15s
  // timeout, and the signer that writes on-chain lives there).
  //
  // PHASE MATTERS. `rewrites()` used to return a bare array, which Next
  // applies as `afterFiles` — checked AFTER the filesystem, so a
  // non-dynamic API page can win on a self-hosted `next start`. `beforeFiles`
  // is checked BEFORE the filesystem, so `/api/*` can never be served by a
  // Vercel lambda. See node_modules/next/dist/docs/.../rewrites.md — the
  // order is headers → redirects → proxy → beforeFiles → filesystem →
  // afterFiles → dynamic routes → fallback.
  //
  // VERCEL-ONLY. The VPS *is* the API origin; pointing it at itself would
  // loop. The rewrite is therefore applied only when building on Vercel
  // (VERCEL=1). A locally built artifact — which is what
  // scripts/deploy-to-hetzner.sh ships — carries no rewrite.
  async rewrites() {
    const hetznerBase = process.env.HETZNER_API_URL;
    const isVercel = process.env.VERCEL === '1';

    if (isVercel && !hetznerBase) {
      // A stripped or missing env must NOT silently fall back to serving the
      // API from serverless functions — that is exactly how the heavy routes
      // quietly stopped being proxied once already (2026-09-11). Fail the
      // build instead of shipping a lambda.
      throw new Error(
        '[rewrites] HETZNER_API_URL is required for a Vercel build — without it every ' +
          '/api/* route would serve from a Vercel lambda instead of the Hetzner runtime.',
      );
    }

    if (!hetznerBase || !isVercel) {
      return { beforeFiles: [], afterFiles: [], fallback: [] };
    }

    return {
      beforeFiles: [
        { source: '/api', destination: `${hetznerBase}/api` },
        { source: '/api/:path*', destination: `${hetznerBase}/api/:path*` },
      ],
      afterFiles: [],
      fallback: [],
    };
  },

  // Configure redirects
  async redirects() {
    return [
      {
        source: "/diversifi/index",
        destination: "/",
        permanent: true,
      },
      {
        source: "/diversifi",
        destination: "/",
        permanent: true,
      },
    ];
  },

  // Configure headers
  async headers() {
    // Legal drafts stay out of the index until counsel approves them
    // (NEXT_PUBLIC_LEGAL_APPROVED). The pages carry their own `noindex`
    // meta, but `_app` gates the page render behind a `ready` flag, so the
    // served HTML is the boot shell and never contains a per-page head —
    // the meta only appears after hydration, for crawlers that execute JS.
    // This header is the server-side half of the same contract, so it holds
    // for every crawler. Dev-only pages are grouped in: they are not content.
    const legalApproved = process.env.NEXT_PUBLIC_LEGAL_APPROVED === 'true';
    const noindexRules = legalApproved
      ? []
      : [
          {
            source:
              "/(terms|privacy|risk|fees|restricted|rive-test|stamps-test)",
            headers: [
              { key: "X-Robots-Tag", value: "noindex, nofollow" },
            ],
          },
          {
            source: "/receipt/:path*",
            headers: [
              { key: "X-Robots-Tag", value: "noindex, nofollow" },
            ],
          },
        ];

    return [
      ...noindexRules,
      {
        source: "/(.*)",
        headers: [
          {
            // Allow embedding in MiniPay
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            // Coinbase Smart Wallet popups need window.opener access;
            // without this the SDK logs COOP errors and connect fails.
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
          {
            key: "Referrer-Policy",
            value: "origin-when-cross-origin",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.googletagmanager.com",
              "worker-src 'self' blob:",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https: blob:",
              "media-src 'self' data: blob:",
              "font-src 'self' data: https: fonts.googleapis.com https://fonts.gstatic.com https://fonts.reown.com",
              "connect-src 'self' https://farcaster.xyz https://client.farcaster.xyz https://warpcast.com https://client.warpcast.com https://wrpcd.net https://*.wrpcd.net https://privy.farcaster.xyz https://privy.warpcast.com https://auth.privy.io https://*.rpc.privy.systems https://explorer-api.walletconnect.com https://rpc.walletconnect.org https://*.walletconnect.com https://*.walletconnect.org https://api.web3modal.org https://*.reown.com https://cca-lite.coinbase.com https://forno.celo.org https://forno.celo-sepolia.celo-testnet.org https://arb1.arbitrum.io https://rpc.testnet.arc.network https://rpc.arc.network https://*.arc.network https://rpc.testnet.chain.robinhood.com https://polygon-rpc.com https://eth.llamarpc.com https://rpc.ankr.com https://eth.publicnode.com https://ethereum.publicnode.com https://cloudflareinsights.com https://li.quest https://*.li.fi https://api.tenderly.co https://api.coingecko.com https://api.coinpaprika.com https://coins.llama.fi https://stablecoins.llama.fi https://api.llama.fi https://api.hyperliquid.xyz https://api.diversifi.famile.xyz https://www.imf.org https://api.worldbank.org https://api.frankfurter.app https://cdn.jsdelivr.net https://*.currency-api.pages.dev https://api.alternative.me https://ipapi.co",
              "frame-src 'self' https://auth.privy.io https://*.privy.io https://secure.walletconnect.org https://secure.walletconnect.com https://verify.walletconnect.org https://verify.walletconnect.com",
              "frame-ancestors 'self' https://*.minipay.app https://minipay.app https://*.celo.org https://*.opera.com https://*.warpcast.com https://warpcast.com https://*.farcaster.xyz https://farcaster.xyz",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

module.exports = withBundleAnalyzer(nextConfig);
