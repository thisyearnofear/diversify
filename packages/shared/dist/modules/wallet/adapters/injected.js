"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInjectedProvider = getInjectedProvider;
function getInjectedProvider() {
    if (typeof window === 'undefined')
        return null;
    const provider = window.ethereum;
    return provider?.request ? provider : null;
}
//# sourceMappingURL=injected.js.map