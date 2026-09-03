import type { NextApiRequest, NextApiResponse } from "next";
import { getAgenticIdService, type AgenticIdBundle } from "@diversifi/shared";

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === "GET") {
        const user = typeof req.query.user === "string" ? req.query.user : undefined;
        if (!user || !ADDRESS_REGEX.test(user)) {
            return res.status(400).json({ error: "user address is required" });
        }

        try {
            const service = getAgenticIdService();
            const id = await service.getAgenticId(user);
            if (!id) {
                return res.status(200).json({ minted: false });
            }
            return res.status(200).json({ minted: true, ...id });
        } catch (err: any) {
            console.error("[agentic-id] GET failed:", err);
            return res.status(503).json({ error: err?.message ?? "Agentic ID service unavailable" });
        }
    }

    if (req.method === "POST") {
        const secret = req.headers["x-agentic-id-secret"];
        if (secret !== process.env.AGENTIC_ID_SECRET) {
            return res.status(401).json({ error: "unauthorized" });
        }

        const { user, agent, evidence } = (req.body ?? {}) as { user?: string; agent?: unknown; evidence?: unknown };
        if (!user || !ADDRESS_REGEX.test(user)) {
            return res.status(400).json({ error: "user address is required" });
        }
        if (typeof agent !== "object" || typeof evidence !== "object" || agent === null || evidence === null) {
            return res.status(400).json({ error: "agent and evidence bundles are required" });
        }

        const bundle: AgenticIdBundle = {
            agent: agent as Record<string, unknown>,
            evidence: evidence as Record<string, unknown>,
        };

        try {
            const service = getAgenticIdService();
            const result = await service.mintAgenticId(user, bundle);

            if (result.status === "failed") {
                return res.status(500).json(result);
            }

            return res.status(result.status === "minted" ? 201 : 202).json(result);
        } catch (err: any) {
            console.error("[agentic-id] POST failed:", err);
            return res.status(503).json({ error: err?.message ?? "Agentic ID service unavailable" });
        }
    }

    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).end();
}
