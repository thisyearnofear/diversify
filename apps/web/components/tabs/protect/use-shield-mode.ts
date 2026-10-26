/**
 * Shield mode — the one state machine for what owns the instrument's
 * surface. Mode collisions (compare + floor draft, slice + tilt, …) are
 * impossible by construction: every flag the tab used to juggle is a
 * field on exactly one variant.
 */
import { useReducer } from "react";
import type { FinancialStrategy } from "@/context/app/types";
import type { CustomPlan, RiskTolerance } from "@/components/protection-cards/plan-preview";
import { SLEEVE_ID, VAULT_SLICE_PREFIX } from "./ring-ids";

export type PhilosophyFocus = { id: FinancialStrategy | null; details: boolean };

export type ShieldMode =
  | { kind: "rest"; focus: PhilosophyFocus }
  | { kind: "slice"; token: string }
  | { kind: "floor"; draft: RiskTolerance | null; token?: string | null }
  | { kind: "compare"; focus: PhilosophyFocus; token: string | null }
  | { kind: "tilt" }
  | {
      kind: "custom";
      draft: CustomPlan;
      seed: CustomPlan;
      seedLabel: string | null;
      seededFromWallet: boolean;
      resume: string | null;
      addingSlice: boolean;
      token: string | null;
    }
  | { kind: "cycle"; report: "next" | "last" };

export type ShieldAction =
  | { type: "reset" }
  | { type: "selectSlice"; token: string | null }
  | { type: "openFloor" }
  | { type: "closeFloor" }
  | { type: "previewFloor"; risk: RiskTolerance }
  | { type: "toggleCompare" }
  | { type: "exitCompare" }
  | { type: "focusPhilosophy"; id: FinancialStrategy }
  | { type: "closePhilosophyDetails" }
  | { type: "clearPhilosophy" }
  | { type: "showTilt" }
  | { type: "hideTilt" }
  | {
      type: "startCustom";
      draft: CustomPlan;
      seed: CustomPlan;
      seedLabel: string | null;
      seededFromWallet: boolean;
      resume: string | null;
    }
  | { type: "updateDraft"; draft: CustomPlan }
  | { type: "setAddingSlice"; adding: boolean }
  | { type: "cancelCustom" }
  | { type: "openCycle"; report: "next" | "last" }
  | { type: "closeCycle" };

export const REST: ShieldMode = { kind: "rest", focus: { id: null, details: false } };

const NO_FOCUS: PhilosophyFocus = { id: null, details: false };

export function shieldModeReducer(mode: ShieldMode, action: ShieldAction): ShieldMode {
  switch (action.type) {
    case "reset":
      return REST;

    case "selectSlice": {
      const token = action.token;
      if (mode.kind === "cycle") return mode;
      if (mode.kind === "compare") {
        return { ...mode, token: token !== null && token === mode.token ? null : token };
      }
      if (mode.kind === "custom") {
        return { ...mode, token, addingSlice: false };
      }
      // Floor with a live draft: the preview owns the surface — the tap
      // marks the slice in the ring but the inspector stays closed (the
      // old focusedToken + isPreviewing combination). No draft yet → the
      // slice inspector opens outright.
      if (mode.kind === "floor") {
        if (mode.draft === null && token !== null) {
          return { kind: "slice", token };
        }
        return { ...mode, token };
      }
      // rest / tilt / slice — a slice tap replaces whatever owned the surface.
      if (token === null) {
        return mode.kind === "slice" && mode.token.startsWith(VAULT_SLICE_PREFIX)
          ? { kind: "slice", token: SLEEVE_ID }
          : REST;
      }
      return { kind: "slice", token };
    }

    case "openFloor":
      return mode.kind === "rest" ? { kind: "floor", draft: null } : mode;

    case "closeFloor":
      return mode.kind === "floor" ? REST : mode;

    case "previewFloor":
      // From rest the dial opens already armed with a draft; from floor
      // it replaces the draft; from slice the preview supersedes the
      // selection. Never reachable from compare/tilt/custom/cycle.
      if (mode.kind === "rest" || mode.kind === "floor" || mode.kind === "slice") {
        return { kind: "floor", draft: action.risk };
      }
      return mode;

    case "toggleCompare":
      if (mode.kind === "compare") return REST;
      if (mode.kind === "custom" || mode.kind === "cycle") return mode;
      return { kind: "compare", focus: NO_FOCUS, token: null };

    case "exitCompare":
      return mode.kind === "compare" ? REST : mode;

    case "focusPhilosophy": {
      if (mode.kind !== "rest" && mode.kind !== "compare") return mode;
      // First tap previews; a second tap on the same coin opens details.
      const details = mode.focus.id === action.id ? true : false;
      return mode.kind === "compare"
        ? { ...mode, token: null, focus: { id: action.id, details } }
        : { ...mode, focus: { id: action.id, details } };
    }

    case "closePhilosophyDetails":
      if (mode.kind !== "rest" && mode.kind !== "compare") return mode;
      return mode.focus.details ? { ...mode, focus: { ...mode.focus, details: false } } : mode;

    case "clearPhilosophy":
      if (mode.kind !== "rest" && mode.kind !== "compare") return mode;
      return mode.focus.id === null && !mode.focus.details
        ? mode
        : { ...mode, focus: NO_FOCUS };

    case "showTilt":
      return mode.kind === "rest" || mode.kind === "slice" || mode.kind === "floor"
        ? { kind: "tilt" }
        : mode;

    case "hideTilt":
      return mode.kind === "tilt" ? REST : mode;

    case "startCustom":
      if (mode.kind === "cycle") return mode;
      return {
        kind: "custom",
        draft: action.draft,
        seed: action.seed,
        seedLabel: action.seedLabel,
        seededFromWallet: action.seededFromWallet,
        resume: action.resume,
        addingSlice: false,
        token: null,
      };

    case "updateDraft":
      return mode.kind === "custom" ? { ...mode, draft: action.draft } : mode;

    case "setAddingSlice":
      return mode.kind === "custom" ? { ...mode, addingSlice: action.adding } : mode;

    case "cancelCustom":
      // Cancel returns to the coin the editor was opened from (the
      // walletless picker reads it as resumeFocus on remount); a
      // standalone "Build my own plan" resumes nowhere.
      return mode.kind === "custom"
        ? {
            kind: "rest",
            focus: { id: (mode.resume as FinancialStrategy | null) ?? null, details: false },
          }
        : mode;

    case "openCycle":
      // A balance draft is never silently discarded by the cycle intent.
      if (mode.kind === "floor" && mode.draft !== null) return mode;
      return { kind: "cycle", report: action.report };

    case "closeCycle":
      return mode.kind === "cycle" ? REST : mode;

    default:
      return mode;
  }
}

export function useShieldMode(): { mode: ShieldMode; dispatch: React.Dispatch<ShieldAction> } {
  const [mode, dispatch] = useReducer(shieldModeReducer, REST);
  return { mode, dispatch };
}
