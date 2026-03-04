"use strict";
// Single source of truth for main navigation tab IDs.
// Keep in sync with pages/index.tsx render switch + TabNavigation items.
Object.defineProperty(exports, "__esModule", { value: true });
exports.LEGACY_TAB_MAP = exports.TAB_IDS = void 0;
exports.isTabId = isTabId;
exports.TAB_IDS = ["overview", "protect", "swap", "trade", "info"];
function isTabId(value) {
    return exports.TAB_IDS.includes(value);
}
// Legacy tab IDs from older versions. Used only for storage migration/back-compat.
exports.LEGACY_TAB_MAP = {
    analytics: "overview",
    strategies: "overview",
    rewards: "overview",
    oracle: "protect",
};
//# sourceMappingURL=tabs.js.map