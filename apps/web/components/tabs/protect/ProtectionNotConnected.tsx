/**
 * ProtectionNotConnected — Shield's unconnected morph.
 *
 * §5 rail 5 (unconnected is a morph too): the philosophy picker is Shield's
 * object, and it works walletless — choosing a lens rewrites the ghost ring
 * and needs no funds. So the picker STAYS the object; the connect CTA
 * attaches to it; trust + demo live in the shared status tier. No hero
 * card, no proof card, no how-it-works stack.
 *
 * Persona morphs the object (rail 4): an APAC philosophy shows the APAC
 * honesty banner in the status tier; a Caribbean philosophy shows the
 * Caribbean one. The live proof ticker rides along as a status-tier line.
 */

import React from "react";
import WalletButton from "../../wallet/WalletButton";
import type { UserExperienceMode } from "@/context/app/types";
import { InstrumentShell } from "../../shared/InstrumentShell";
import { UnconnectedStatusTier } from "../../shared/UnconnectedStatusTier";
import { ProtectionPlanGallery } from "./ProtectionPlanGallery";
import { useStrategy } from "@/context/app/StrategyContext";
import { useProtectionProfile } from "@/hooks/use-protection-profile";
import { useUserRegion } from "@/hooks/use-user-region";
import { ApacRailHonestyBanner } from "../../shared/ApacRailHonestyBanner";
import { needsApacRailMessaging } from "@/constants/apac-rail";
import { CaribbeanRailHonestyBanner } from "../../shared/CaribbeanRailHonestyBanner";
import { needsCaribbeanRailMessaging } from "@/constants/caribbean-rail";
import { LiveProofTicker } from "../../shared/LiveProofCard";

interface Props {
  experienceMode: UserExperienceMode;
  onEnableDemo?: () => void;
}

export function ProtectionNotConnected({ experienceMode: _experienceMode, onEnableDemo }: Props) {
  const { financialStrategy } = useStrategy();
  const { config: profileConfig } = useProtectionProfile();
  const { region: detectedRegion } = useUserRegion();
  const showApacBanner = needsApacRailMessaging(
    financialStrategy ?? profileConfig.philosophy,
    profileConfig.userRegion ?? detectedRegion,
  );
  const showCaribbeanBanner = needsCaribbeanRailMessaging(
    financialStrategy ?? profileConfig.philosophy,
    profileConfig.userRegion ?? detectedRegion,
  );

  const object = (
    <div className="space-y-4" data-testid="shield-unconnected-object">
      <div data-testid="shield-picker">
        <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
          Choose a protection philosophy
        </p>
        <ProtectionPlanGallery />
      </div>

      {/* The one CTA — attaches to the object, no card wrapper. */}
      <WalletButton variant="primary" className="w-full" />
    </div>
  );

  const status = (
    <div className="space-y-2">
      {(showApacBanner || showCaribbeanBanner) && (
        <div className="mb-1">
          {showApacBanner && <ApacRailHonestyBanner />}
          {showCaribbeanBanner && <CaribbeanRailHonestyBanner />}
        </div>
      )}
      <LiveProofTicker limit={3} />
      {onEnableDemo && <UnconnectedStatusTier onEnableDemo={onEnableDemo} />}
    </div>
  );

  return <InstrumentShell object={object} status={status} />;
}
