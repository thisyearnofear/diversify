import React from "react";
import { useGeoCountry } from "@/hooks/use-geo-country";
import { jurisdictionNoticeFor } from "@diversifi/shared/src/config/jurisdictions";

/**
 * The counsel-supplied notice owed to this visitor's country — a quiet
 * trust-tier line, not a banner. Renders nothing until counsel hands
 * verbatim copy for `JURISDICTION_NOTICES`; a notice that contradicts
 * what the product does is worse than none, so this component never
 * drafts its own.
 */
export function JurisdictionNotice() {
  const notice = jurisdictionNoticeFor(useGeoCountry());
  if (!notice) return null;
  return (
    <p className="px-1 text-2xs leading-relaxed text-gray-400 dark:text-gray-500">
      {notice}
    </p>
  );
}

export default JurisdictionNotice;
