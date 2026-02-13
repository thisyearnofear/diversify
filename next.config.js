/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@stable-station/mento-utils",
    "@privy-io/react-auth",
    "@privy-io/wagmi",
  ],

  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push("pino-pretty", "lokijs", "encoding");
    }
    return config;
  },

  // Configure base path if needed
  // basePath: '/diversifi',

  // Configure asset prefix if needed
  // assetPrefix: '/diversifi',

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
              "font-src 'self' data: https://fonts.reown.com",
              "connect-src 'self' https://farcaster.xyz https://client.farcaster.xyz https://warpcast.com https://client.warpcast.com https://wrpcd.net https://*.wrpcd.net https://privy.farcaster.xyz https://privy.warpcast.com https://auth.privy.io https://*.rpc.privy.systems https://explorer-api.walletconnect.com https://rpc.walletconnect.org https://*.walletconnect.com https://*.walletconnect.org https://api.web3modal.org https://*.reown.com https://cca-lite.coinbase.com https://forno.celo.org https://alfajores-forno.celo-testnet.org https://arb1.arbitrum.io https://rpc.testnet.arc.network https://cloudflareinsights.com https://li.quest https://*.li.fi https://api.coingecko.com https://coins.llama.fi",
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
