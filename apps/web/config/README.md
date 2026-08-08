# App config

UI/client network tables (`NETWORKS`, token menus, feature flags used by the Next app).

Canonical **service-layer** config (ledger routing, swap strategies, shared NETWORKS used by packages) lives in [`packages/shared/src/config`](../../../packages/shared/src/config).

When you add a chain or token:

1. Update `@diversifi/shared/src/config` if agents/API/scripts need it
2. Update this folder if the UI picker/menus need it
3. Prefer deep imports of shared leaves (`@diversifi/shared/src/config/celo-tokens`) from API routes instead of growing this file further
