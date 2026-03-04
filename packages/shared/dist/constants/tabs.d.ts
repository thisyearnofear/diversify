export declare const TAB_IDS: readonly ["overview", "protect", "swap", "trade", "info"];
export type TabId = (typeof TAB_IDS)[number];
export declare function isTabId(value: string): value is TabId;
export declare const LEGACY_TAB_MAP: Record<string, TabId>;
//# sourceMappingURL=tabs.d.ts.map