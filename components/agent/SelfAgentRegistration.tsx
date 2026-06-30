/**
 * SelfAgentRegistration — QR code flow for registering the DiversiFi
 * Guardian agent on Self Protocol's ERC-8004 compliant registry.
 *
 * The user (agent owner) scans their passport with the Self app,
 * which submits a ZK proof on-chain. The registry mints a soulbound
 * NFT binding the agent key to a unique human nullifier.
 *
 * On testnet (Celo Sepolia), mock documents can be generated in the
 * Self app — no real passport needed.
 */

import { useEffect, useState, useCallback } from "react";
import { Wallet } from "ethers";
import {
  SelfAppBuilder,
  SelfQRcodeWrapper,
  type ISelfApp,
} from "@selfxyz/qrcode";
import {
  signRegistrationChallenge,
  buildAdvancedRegisterUserDataAscii,
} from "@selfxyz/agent-sdk";

const REGISTRY_MAINNET = "0xaC3DF9ABf80d0F5c020C06B04Cced27763355944";
const REGISTRY_TESTNET = "0x043DaCac8b0771DD5b444bCC88f2f8BBDBEdd379";

interface SelfAgentRegistrationProps {
  /** The connected wallet address of the agent owner (human). */
  humanAddress: string;
  /** Use testnet (Celo Sepolia) — mock documents, no real passport. */
  testnet?: boolean;
  /** Called when the agent NFT is successfully minted. */
  onSuccess?: (agentAddress: string, agentPrivateKey: string) => void;
  /** Called when verification fails. */
  onError?: (error: string) => void;
}

export function SelfAgentRegistration({
  humanAddress,
  testnet = process.env.NODE_ENV !== "production",
  onSuccess,
  onError,
}: SelfAgentRegistrationProps) {
  const [selfApp, setSelfApp] = useState<ISelfApp | null>(null);
  const [agentWallet] = useState(() => Wallet.createRandom());
  const [status, setStatus] = useState<"loading" | "ready" | "success" | "error">("loading");
  const [savedKey, setSavedKey] = useState(false);

  const registry = testnet ? REGISTRY_TESTNET : REGISTRY_MAINNET;
  const endpointType = testnet ? "staging_celo" : "celo";

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // The agent key signs a challenge proving it controls the key
        const sig = await signRegistrationChallenge(agentWallet.privateKey, {
          humanIdentifier: humanAddress,
          chainId: testnet ? 11142220 : 42220,
          registryAddress: registry,
          nonce: 0,
        });

        // Encode the registration payload
        const disclosures = { minimumAge: 18, ofac: true };
        const userDefinedData = buildAdvancedRegisterUserDataAscii({
          agentAddress: agentWallet.address,
          signature: sig,
          disclosures,
        });

        const app = new SelfAppBuilder({
          version: 2,
          appName: "DiversiFi Guardian",
          scope: "self-agent-id",
          endpoint: registry,
          endpointType,
          userId: humanAddress,
          userIdType: "hex",
          userDefinedData,
          disclosures,
        }).build();

        if (!cancelled) {
          setSelfApp(app);
          setStatus("ready");
        }
      } catch (err) {
        if (!cancelled) {
          setStatus("error");
          onError?.(err instanceof Error ? err.message : String(err));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [humanAddress, agentWallet, registry, endpointType, testnet, onError]);

  const handleSuccess = useCallback(() => {
    setStatus("success");
    // The agent private key must be saved — it's the agent's signing key.
    // In production, this should be stored securely (env var, secrets manager).
    onSuccess?.(agentWallet.address, agentWallet.privateKey);
  }, [agentWallet, onSuccess]);

  const handleError = useCallback(
    (err: unknown) => {
      setStatus("error");
      onError?.(err instanceof Error ? err.message : String(err));
    },
    [onError],
  );

  if (status === "loading") {
    return (
      <div style={{ textAlign: "center", padding: "2rem" }}>
        <p>Preparing Self Protocol registration…</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div style={{ textAlign: "center", padding: "2rem", color: "#ef4444" }}>
        <p>Registration setup failed. Check console for details.</p>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div style={{ textAlign: "center", padding: "2rem" }}>
        <h3>✅ Agent Registered on Self Protocol</h3>
        <p>
          Agent address: <code>{agentWallet.address}</code>
        </p>
        {!savedKey && (
          <div
            style={{
              margin: "1rem 0",
              padding: "1rem",
              background: "#fef3c7",
              borderRadius: "8px",
              border: "1px solid #f59e0b",
            }}
          >
            <p style={{ fontWeight: 600, margin: "0 0 0.5rem" }}>
              ⚠️ Save your agent private key — it cannot be recovered.
            </p>
            <p style={{ fontSize: "0.85rem", margin: 0 }}>
              Store this in your server&apos;s environment variables as
              <code> AGENT_PRIVATE_KEY</code>:
            </p>
            <code
              style={{
                display: "block",
                margin: "0.5rem 0",
                padding: "0.5rem",
                background: "#fff",
                borderRadius: "4px",
                fontSize: "0.75rem",
                wordBreak: "break-all",
              }}
            >
              {agentWallet.privateKey}
            </code>
            <button
              onClick={() => setSavedKey(true)}
              style={{
                padding: "0.5rem 1rem",
                background: "#f59e0b",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              I&apos;ve saved the key
            </button>
          </div>
        )}
        {savedKey && (
          <p style={{ color: "#22c55e" }}>
            Key saved. The DiversiFi Guardian can now sign requests as a
            verified agent.
          </p>
        )}
      </div>
    );
  }

  return (
    <div style={{ textAlign: "center", padding: "1rem" }}>
      <h3>Register DiversiFi Guardian on Self Protocol</h3>
      <p style={{ fontSize: "0.9rem", color: "#6b7280", marginBottom: "1rem" }}>
        Scan the QR code with the Self app to verify your identity. This mints
        a soulbound NFT that binds the Guardian agent to your verified human
        identity — sybil-resistant, ERC-8004 compliant.
        {testnet && " (Testnet: mock documents work — no real passport needed.)"}
      </p>
      {selfApp && (
        <SelfQRcodeWrapper
          selfApp={selfApp}
          onSuccess={handleSuccess}
          onError={handleError}
        />
      )}
      <p style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: "0.5rem" }}>
        Agent address: {agentWallet.address.slice(0, 8)}…{agentWallet.address.slice(-6)}
      </p>
    </div>
  );
}

export default SelfAgentRegistration;
