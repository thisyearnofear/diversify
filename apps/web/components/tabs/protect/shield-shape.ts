/**
 * Shield tab shapes — the same screen, four jobs.
 * Persona morphs which inspector body appears; it does not reorder modules.
 */

export type ShieldShape = "picker" | "fund" | "gap" | "quiet";

export function deriveShieldShape({
  hasPlan,
  hasFunds,
  alignmentScore,
  guardianMonitoring,
}: {
  hasPlan: boolean;
  hasFunds: boolean;
  alignmentScore: number;
  guardianMonitoring: boolean;
}): ShieldShape {
  if (!hasPlan) return "picker";
  if (!hasFunds) return "fund";
  if (guardianMonitoring && alignmentScore >= 80) return "quiet";
  return "gap";
}
