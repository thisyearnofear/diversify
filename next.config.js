/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',

  typescript: {
    ignoreBuildErrors: true,
  },

  transpilePackages: [
    "@diversifi/shared",
    "@stable-station/mento-utils",
  ],

  experimental: {
    prefetchInlining: true,
    appNewScrollHandler: true,
  },

  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        fs: false,
        net: false,
        tls: false,
        dns: false,
        child_process: false,
        readline: false,
        zlib: false,
        'dtrace-provider': false,
        stream: false,
        util: false,
        buffer: false,
        assert: false,
        http: false,
        https: false,
        os: false,
        url: false,
        crypto: false,
      };
    }
    return config;
  },

  turbopack: {
    resolveAlias: {
      fs: './lib/empty-module.js',
      net: './lib/empty-module.js',
      tls: './lib/empty-module.js',
      dns: './lib/empty-module.js',
      child_process: './lib/empty-module.js',
      readline: './lib/empty-module.js',
      zlib: './lib/empty-module.js',
      'dtrace-provider': './lib/empty-module.js',
      stream: './lib/empty-module.js',
      util: './lib/empty-module.js',
      buffer: './lib/empty-module.js',
      assert: './lib/empty-module.js',
      http: './lib/empty-module.js',
      https: './lib/empty-module.js',
      os: './lib/empty-module.js',
      url: './lib/empty-module.js',
      crypto: './lib/empty-module.js',
    },
  },

  // Route heavy/slow API routes to Hetzner (always-on, no cold starts, no 15s timeout)
  async rewrites() {
    const hetznerBase = process.env.HETZNER_API_URL;
    if (!hetznerBase) return [];
    return [
      { source: '/api/agent/status', destination: `${hetznerBase}/api/agent/status` },
      { source: '/api/agent/advisor', destination: `${hetznerBase}/api/agent/advisor` },
      { source: '/api/agent/deep-analyze', destination: `${hetznerBase}/api/agent/deep-analyze` },
      { source: '/api/agent/x402-gateway', destination: `${hetznerBase}/api/agent/x402-gateway` },
      { source: '/api/vault/:path*', destination: `${hetznerBase}/api/vault/:path*` },
    ];
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
    return [
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
            key: "Referrer-Policy",
            value: "origin-when-cross-origin",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.googletagmanager.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https: blob:",
              "media-src 'self' data: blob:",
              "font-src 'self' data: https: fonts.googleapis.com https://fonts.gstatic.com https://fonts.reown.com",
              "connect-src 'self' https://farcaster.xyz https://client.farcaster.xyz https://warpcast.com https://client.warpcast.com https://wrpcd.net https://*.wrpcd.net https://privy.farcaster.xyz https://privy.warpcast.com https://auth.privy.io https://*.rpc.privy.systems https://explorer-api.walletconnect.com https://rpc.walletconnect.org https://*.walletconnect.com https://*.walletconnect.org https://api.web3modal.org https://*.reown.com https://cca-lite.coinbase.com https://forno.celo.org https://forno.celo-sepolia.celo-testnet.org https://arb1.arbitrum.io https://rpc.testnet.arc.network https://rpc.arc.network https://*.arc.network https://rpc.testnet.chain.robinhood.com https://polygon-rpc.com https://eth.llamarpc.com https://rpc.ankr.com https://eth.publicnode.com https://ethereum.publicnode.com https://cloudflareinsights.com https://li.quest https://*.li.fi https://api.coingecko.com https://api.coinpaprika.com https://coins.llama.fi https://api.synthdata.co https://api.hyperliquid.xyz https://api.diversifi.famile.xyz",
              "frame-src 'self' https://auth.privy.io https://*.privy.io https://secure.walletconnect.org https://secure.walletconnect.com https://verify.walletconnect.org https://verify.walletconnect.com",
              "frame-ancestors 'self' https://*.minipay.app https://minipay.app https://*.celo.org https://*.opera.com https://*.warpcast.com https://warpcast.com https://*.farcaster.xyz https://farcaster.xyz",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
