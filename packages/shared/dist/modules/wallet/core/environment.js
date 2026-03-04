"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectWalletEnvironment = detectWalletEnvironment;
const miniapp_sdk_1 = __importDefault(require("@farcaster/miniapp-sdk"));
const environment_1 = require("../../../utils/environment");
async function withTimeout(p, timeoutMs) {
    return await Promise.race([
        p,
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs)),
    ]);
}
async function detectWalletEnvironment() {
    if (typeof window === 'undefined') {
        return { isMiniPay: false, isFarcaster: false, farcasterContext: null };
    }
    const isMiniPay = (0, environment_1.isMiniPayEnvironment)();
    try {
        if (miniapp_sdk_1.default?.actions?.ready) {
            miniapp_sdk_1.default.actions.ready();
        }
        const farcasterContext = await withTimeout(miniapp_sdk_1.default.context, 1000);
        if (farcasterContext) {
            return {
                isMiniPay,
                isFarcaster: true,
                farcasterContext,
            };
        }
    }
    catch {
        // Not Farcaster context.
    }
    return {
        isMiniPay,
        isFarcaster: false,
        farcasterContext: null,
    };
}
//# sourceMappingURL=environment.js.map