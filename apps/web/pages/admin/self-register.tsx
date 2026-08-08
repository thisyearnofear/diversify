/**
 * Admin: Self Protocol Mainnet Registration
 *
 * This page mounts the SelfAgentRegistration component in mainnet mode
 * so the agent owner can scan their real passport with the Self app
 * to mint the agent identity on Celo mainnet.
 *
 * Access: /admin/self-register
 * Requires: connected wallet (the agent owner's wallet)
 */

import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { SelfAgentRegistration } from "../../components/agent/SelfAgentRegistration";

export default function SelfRegisterAdmin() {
  const { user, authenticated } = usePrivy();
  const [registeredAgent, setRegisteredAgent] = useState<string | null>(null);
  const [agentKey, setAgentKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [useMainnet, setUseMainnet] = useState(true);

  const walletAddress = user?.wallet?.address;

  if (!authenticated || !walletAddress) {
    return (
      <div style={{ padding: "2rem", maxWidth: "600px", margin: "0 auto" }}>
        <h1>Self Protocol Mainnet Registration</h1>
        <p>Please connect your wallet to continue.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem", maxWidth: "600px", margin: "0 auto" }}>
      <h1>Self Protocol Agent Registration</h1>
      <p>
        Register the DiversiFi Guardian agent on Self Protocol&apos;s ERC-8004
        compliant registry with Proof-of-Human verification.
      </p>

      <div style={{ marginBottom: "1rem", padding: "1rem", background: "#f5f5f5", borderRadius: "8px" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={useMainnet}
            onChange={(e) => setUseMainnet(e.target.checked)}
          />
          <strong>Use Celo Mainnet</strong>
          <span style={{ color: "#666", fontSize: "0.875rem" }}>
            (uncheck for testnet with mock documents)
          </span>
        </label>
      </div>

      {useMainnet && (
        <div style={{ marginBottom: "1rem", padding: "1rem", background: "#fff3cd", borderRadius: "8px", border: "1px solid #ffc107" }}>
          <strong>⚠️ Mainnet registration requires a real passport scan.</strong>
          <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.875rem" }}>
            Open the Self app on your phone and scan the QR code below with your
            real passport. The ZK proof is generated locally on your device — no
            personal data leaves your phone.
          </p>
        </div>
      )}

      <div style={{ marginBottom: "1rem" }}>
        <strong>Connected wallet:</strong> {walletAddress}
      </div>

      <SelfAgentRegistration
        humanAddress={walletAddress}
        testnet={!useMainnet}
        onSuccess={(addr, key) => {
          setRegisteredAgent(addr);
          setAgentKey(key);
          setError(null);
        }}
        onError={(err) => {
          setError(err);
          setRegisteredAgent(null);
          setAgentKey(null);
        }}
      />

      {registeredAgent && (
        <div style={{ marginTop: "1rem", padding: "1rem", background: "#d4edda", borderRadius: "8px", border: "1px solid #28a745" }}>
          <h3 style={{ margin: "0 0 0.5rem 0" }}>✅ Registration Successful!</h3>
          <p><strong>Agent address:</strong> {registeredAgent}</p>
          <p><strong>Agent private key:</strong></p>
          <code style={{ display: "block", padding: "0.5rem", background: "#f8f9fa", borderRadius: "4px", wordBreak: "break-all" }}>
            {agentKey || "(not available)"}
          </code>
          <p style={{ marginTop: "0.5rem", color: "#721c24", fontWeight: "bold" }}>
            Save this private key! It cannot be recovered. Store it as
            <code> AGENT_PRIVATE_KEY</code> in your server environment.
          </p>
        </div>
      )}

      {error && (
        <div style={{ marginTop: "1rem", padding: "1rem", background: "#f8d7da", borderRadius: "8px", border: "1px solid #dc3545" }}>
          <h3 style={{ margin: "0 0 0.5rem 0" }}>❌ Registration Failed</h3>
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}
