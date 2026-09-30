// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";

vi.mock("../GuardianJournalTab", () => ({
  GuardianJournalTab: () => <div data-testid="journal-tab" />,
}));
vi.mock("../LoopResultSummary", () => ({
  LoopResultSummary: () => null,
}));
vi.mock("../../shared/LiveProofCard", () => ({
  GuardianCadenceLine: () => <div data-testid="guardian-cadence-line" />,
}));

import { GuardianJournalSheet } from "../GuardianJournalSheet";

describe("GuardianJournalSheet — cadence behind the tap", () => {
  it("renders the Guardian cadence line inside the journal body", () => {
    render(
      <GuardianJournalSheet
        sessionInfo={null}
        events={[]}
        anchorByTxHash={new Map()}
        hasValidPermission={false}
        isLowOnFunds={false}
        isRunningLoop={false}
        loopResult={null}
        onPreview={() => {}}
      />,
    );
    expect(screen.getByTestId("guardian-cadence-line")).toBeInTheDocument();
  });
});
