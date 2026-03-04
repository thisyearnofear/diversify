"use strict";
/**
 * Backward-compatible wallet provider exports.
 * Wallet internals now live in modules/wallet for cleaner separation of concerns.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupWalletEventListenersForProvider = exports.resetWalletProviderCache = exports.isWalletProviderAvailable = exports.isFarcasterProvider = exports.getWalletProvider = exports.getWalletEnvironment = void 0;
var provider_registry_1 = require("../modules/wallet/core/provider-registry");
Object.defineProperty(exports, "getWalletEnvironment", { enumerable: true, get: function () { return provider_registry_1.getWalletEnvironment; } });
Object.defineProperty(exports, "getWalletProvider", { enumerable: true, get: function () { return provider_registry_1.getWalletProvider; } });
Object.defineProperty(exports, "isFarcasterProvider", { enumerable: true, get: function () { return provider_registry_1.isFarcasterProvider; } });
Object.defineProperty(exports, "isWalletProviderAvailable", { enumerable: true, get: function () { return provider_registry_1.isWalletProviderAvailable; } });
Object.defineProperty(exports, "resetWalletProviderCache", { enumerable: true, get: function () { return provider_registry_1.resetWalletProviderCache; } });
Object.defineProperty(exports, "setupWalletEventListenersForProvider", { enumerable: true, get: function () { return provider_registry_1.setupWalletEventListenersForProvider; } });
//# sourceMappingURL=wallet-provider.js.map