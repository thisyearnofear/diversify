"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFarcasterProvider = getFarcasterProvider;
const miniapp_sdk_1 = __importDefault(require("@farcaster/miniapp-sdk"));
async function getFarcasterProvider() {
    try {
        if (!miniapp_sdk_1.default?.wallet?.getEthereumProvider) {
            return null;
        }
        const provider = await miniapp_sdk_1.default.wallet.getEthereumProvider();
        return provider?.request ? provider : null;
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=farcaster.js.map