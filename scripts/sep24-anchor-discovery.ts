/**
 * Read-only SEP-24 anchor discovery.
 *
 * Resolves an anchor's stellar.toml → TRANSFER_SERVER_SEP0024 → /info and
 * reports which assets advertise interactive deposit/withdraw rails. This is
 * *discovery only*: a listed asset proves the anchor exposes a rail, not that
 * a given user can complete KYC or redeem to a bank account.
 *
 * Run: pnpm sep24-discovery [--domain testanchor.stellar.org] [--asset USDC]
 */

const DEFAULT_DOMAIN = "testanchor.stellar.org";
const TIMEOUT_MS = 15_000;

interface Sep24Info {
  deposit?: Record<string, { enabled?: boolean; min_amount?: number; max_amount?: number }>;
  withdraw?: Record<string, { enabled?: boolean; min_amount?: number; max_amount?: number }>;
  features?: { account_creation?: boolean; claimable_balances?: boolean };
}

export interface AnchorDiscovery {
  domain: string;
  transferServer: string | null;
  webAuthEndpoint: string | null;
  depositAssets: string[];
  withdrawAssets: string[];
  features: Sep24Info["features"] | null;
  error?: string;
}

function parseTomlValue(toml: string, key: string): string | null {
  // Deliberately minimal: match `KEY = "value"` lines only. Good enough for a
  // discovery probe; not a general TOML parser.
  const match = toml.match(new RegExp(`^${key}\\s*=\\s*"([^"]+)"`, "m"));
  return match?.[1] ?? null;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.text();
}

export async function discoverAnchor(domain = DEFAULT_DOMAIN): Promise<AnchorDiscovery> {
  const base = `https://${domain}`;
  const result: AnchorDiscovery = {
    domain,
    transferServer: null,
    webAuthEndpoint: null,
    depositAssets: [],
    withdrawAssets: [],
    features: null,
  };
  try {
    const toml = await fetchText(`${base}/.well-known/stellar.toml`);
    result.transferServer = parseTomlValue(toml, "TRANSFER_SERVER_SEP0024");
    result.webAuthEndpoint = parseTomlValue(toml, "WEB_AUTH_ENDPOINT");
    if (!result.transferServer) {
      result.error = "no TRANSFER_SERVER_SEP0024 in stellar.toml";
      return result;
    }
    const info = JSON.parse(await fetchText(`${result.transferServer}/info`)) as Sep24Info;
    result.depositAssets = Object.keys(info.deposit ?? {});
    result.withdrawAssets = Object.keys(info.withdraw ?? {});
    result.features = info.features ?? null;
    return result;
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    return result;
  }
}

if (process.argv[1]?.endsWith("sep24-anchor-discovery.ts")) {
  const args = process.argv.slice(2);
  const flagValue = (flag: string): string | undefined => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const domain = flagValue("--domain") || DEFAULT_DOMAIN;
  const asset = flagValue("--asset");
  discoverAnchor(domain)
    .then((r) => {
      console.log(JSON.stringify(r, null, 2));
      if (r.error) {
        process.exitCode = 1;
      } else if (asset && !r.depositAssets.includes(asset) && !r.withdrawAssets.includes(asset)) {
        console.error(`${asset} not advertised by ${domain}`);
        process.exitCode = 1;
      }
    })
    .catch((e: unknown) => {
      console.error(e instanceof Error ? e.message : e);
      process.exitCode = 1;
    });
}
