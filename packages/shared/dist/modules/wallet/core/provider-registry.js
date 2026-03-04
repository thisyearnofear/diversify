"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetWalletProviderCache = resetWalletProviderCache;
exports.isFarcasterProvider = isFarcasterProvider;
exports.getWalletProvider = getWalletProvider;
exports.getWalletEnvironment = getWalletEnvironment;
exports.isWalletProviderAvailable = isWalletProviderAvailable;
exports.setupWalletEventListenersForProvider = setupWalletEventListenersForProvider;
const environment_1 = require("./environment");
const farcaster_1 = require("../adapters/farcaster");
const injected_1 = require("../adapters/injected");
let cache = null;
let envCache = null;
function resetWalletProviderCache() {
    cache = null;
    envCache = null;
}
function isFarcasterProvider() {
    return envCache?.isFarcaster ?? cache?.environment.isFarcaster ?? false;
}
async function resolveEnvironment() {
    if (envCache)
        return envCache;
    envCache = await (0, environment_1.detectWalletEnvironment)();
    return envCache;
}
async function resolveProvider(prefer) {
    const environment = await resolveEnvironment();
    // 1. Handle explicit preferences first
    if (prefer === "farcaster" || environment.isFarcaster) {
        const farcasterProvider = await (0, farcaster_1.getFarcasterProvider)();
        if (farcasterProvider) {
            console.log("[Wallet] Using Farcaster provider");
            return { provider: farcasterProvider, environment };
        }
    }
    if (prefer === "injected") {
        const injected = (0, injected_1.getInjectedProvider)();
        console.log("[Wallet] Explicitly requested injected provider");
        return { provider: injected, environment };
    }
    // 2. MiniPay always uses injected provider
    if (environment.isMiniPay) {
        const injected = (0, injected_1.getInjectedProvider)();
        if (injected) {
            console.log("[Wallet] Using MiniPay injected provider");
            return { provider: injected, environment };
        }
    }
    // 3. PRIORITY: Check for injected wallet FIRST (MetaMask, Coinbase, etc.)
    // This is best practice - respect user's installed wallet choice
    const injected = (0, injected_1.getInjectedProvider)();
    if (injected) {
        console.log("[Wallet] Detected injected wallet (MetaMask/Coinbase/etc), using it as primary provider");
        return { provider: injected, environment };
    }
    // 4. No provider available - Privy will handle social login in the connect() function
    console.log("[Wallet] No injected wallet detected - Privy will be used for social login");
    return { provider: null, environment };
}
async function getWalletProvider(opts) {
    const prefer = opts?.prefer ?? "auto";
    if (cache?.provider) {
        return cache.provider;
    }
    const result = await resolveProvider(prefer);
    if (result.provider) {
        cache = result;
        return result.provider;
    }
    return null;
}
async function getWalletEnvironment() {
    return resolveEnvironment();
}
async function isWalletProviderAvailable() {
    const provider = await getWalletProvider();
    return !!provider;
}
function setupWalletEventListenersForProvider(provider, onChainChanged, onAccountsChanged) {
    if (!provider?.on) {
        return () => { };
    }
    provider.on("chainChanged", onChainChanged);
    provider.on("accountsChanged", onAccountsChanged);
    return () => {
        provider.removeListener?.("chainChanged", onChainChanged);
        provider.removeListener?.("accountsChanged", onAccountsChanged);
    };
}
//# sourceMappingURL=provider-registry.js.map