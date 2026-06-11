/**
 * ProactiveAgentRunner
 *
 * Mounts the proactive agent monitoring loop exactly once at the app root,
 * decoupled from any specific UI surface (chat, advisor drawer, etc.).
 *
 * The hook itself is unchanged; this component exists only because React
 * does not allow calling hooks directly in `_app.tsx`. Renders nothing.
 */

import { useProactiveAgent } from "../../hooks/use-proactive-agent";

export function ProactiveAgentRunner(): null {
    useProactiveAgent();
    return null;
}
