/**
 * API: POST /api/agent/self-register-challenge
 *
 * Server-side endpoint that uses @selfxyz/agent-sdk to:
 *   1. Sign a registration challenge with the agent private key
 *   2. Build the userDefinedData payload for the Self app QR code
 *
 * The agent-sdk uses node:crypto, so it can only run server-side.
 * The client component calls this endpoint and passes the result to
 * the SelfAppBuilder from @selfxyz/qrcode (which is client-safe).
 *
 * Request body:
 *   { agentPrivateKey: string, agentAddress: string, humanAddress: string, testnet: boolean }
 *
 * Response:
 *   { userDefinedData: string, disclosures: { minimumAge: 18, ofac: true } }
 */

import type { NextApiRequest, NextApiResponse } from "next";
import {
  signRegistrationChallenge,
  buildAdvancedRegisterUserDataAscii,
} from "@selfxyz/agent-sdk";

const REGISTRY_MAINNET = "0xaC3DF9ABf80d0F5c020C06B04Cced27763355944";
const REGISTRY_TESTNET = "0x043DaCac8b0771DD5b444bCC88f2f8BBDBEdd379";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { agentPrivateKey, agentAddress, humanAddress, testnet } = req.body;

    if (!agentPrivateKey || !agentAddress || !humanAddress) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const registry = testnet ? REGISTRY_TESTNET : REGISTRY_MAINNET;
    const chainId = testnet ? 11142220 : 42220;

    // Sign the registration challenge server-side (uses node:crypto)
    const sig = await signRegistrationChallenge(agentPrivateKey, {
      humanIdentifier: humanAddress,
      chainId,
      registryAddress: registry,
      nonce: 0,
    });

    // Build the userDefinedData payload
    const disclosures = { minimumAge: 18 as const, ofac: true };
    const userDefinedData = buildAdvancedRegisterUserDataAscii({
      agentAddress,
      signature: sig,
      disclosures,
    });

    return res.status(200).json({
      userDefinedData,
      disclosures,
      registry,
      endpointType: testnet ? "staging_celo" : "celo",
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: msg });
  }
}
