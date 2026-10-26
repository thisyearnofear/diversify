import { useCallback, useContext, useRef } from 'react';
import { DemoModeContext } from '../context/app/DemoModeContext';
import { useExperienceOptional } from '../context/app/ExperienceContext';
import { readExchangePair } from '../lib/exchange-view';
import { useNavigationOptional } from '../context/app/NavigationContext';
import { CURRENCY_BY_CODE } from '../constants/currency-risk';
import { TAB_LABELS } from '../constants/tabs';
import { IntentDiscoveryService } from '@diversifi/shared/src/services/ai/intent-discovery.service';
import { stellarTestnetEnabled } from '@diversifi/shared/src/config/stellar';
import { isInteractionRequest, validateInteraction, type GuardianInteraction } from '@diversifi/shared/src/services/ai/guardian-interaction';
import { fetchWithTimeout } from '@diversifi/shared/src/utils/promise-utils';
import { getDemoToken } from '../lib/demo-session';
import { reportAllowance } from './use-allowance';
import { trackFunnelEvent } from '../lib/analytics';

const currencies = Object.keys(CURRENCY_BY_CODE);
export type InteractionResult = { message: string; revealSurface: boolean };

/** UI callbacks only. Parsing and validation live in shared services. */
export function useGuardianInteraction() {
  const navigation = useNavigationOptional();
  const experience = useExperienceOptional();
  const isDemo = useContext(DemoModeContext)?.demoMode.isActive;
  const current = navigation?.currencyView ?? navigation?.currencyReading;
  const viewKey = JSON.stringify([navigation?.activeTab, navigation?.exchangeNetwork, current, navigation?.swapPrefill]);
  const latestView = useRef(viewKey);
  latestView.current = viewKey;
  const discover = useCallback((text: string) =>
    navigation ? IntentDiscoveryService.discoverInteraction(text, { currencies, currency: current, clarification: navigation.currencyClarification }) : null,
  [navigation, current]);
  const interpret = useCallback(async (text: string, apiBase: string): Promise<GuardianInteraction | null> => {
    if (!navigation || !isInteractionRequest(text)) return null;
    const snapshot = viewKey;
    try {
      const response = await fetchWithTimeout(`${apiBase}/api/agent/interaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          currency: current ? {
            currencyCode: current.currencyCode, benchmark: current.benchmark, horizon: current.horizon, story: current.story,
          } : null,
          demoToken: isDemo ? await getDemoToken() : undefined,
        }),
      }, 8000);
      const data = await response.json();
      if (latestView.current !== snapshot) {
        return { kind: 'clarify', message: 'The view changed while I was interpreting that request. Please ask again on the current screen.' };
      }
      const allowance = data.allowance ?? (data.error === 'daily_questions_exhausted' ? data : null);
      if (typeof allowance?.remaining === 'number' && typeof allowance?.limit === 'number' && typeof allowance?.resetsAt === 'string') {
        reportAllowance(allowance);
      }
      if (!response.ok) throw new Error('interpretation_unavailable');
      return validateInteraction(data.intent, { currencies, currency: current })
        ?? { kind: 'clarify', message: 'Which screen or currency would you like to explore?' };
    } catch {
      return { kind: 'clarify', message: 'I could not interpret that screen request. Try “Show me the naira’s story”, or use the screen controls.' };
    }
  }, [current, navigation, viewKey, isDemo]);

  const apply = useCallback((intent: GuardianInteraction): InteractionResult | null => {
    if (!navigation) return null;
    // The dispatcher repeats the boundary check; it never trusts a model
    // response solely because interpretation already validated it.
    if (intent.kind !== 'clarify') {
      const validated = validateInteraction(intent, { currencies, currency: current });
      if (!validated) return { message: 'That view is not supported. Please choose a screen or currency from the app.', revealSurface: false };
      intent = validated;
    }
    let result: InteractionResult;
    switch (intent.kind) {
      case 'currency':
        navigation.setCurrencyView(intent.view);
        navigation.setActiveTab('overview');
        result = {
          message: intent.view.story
            ? `Here is ${intent.view.currencyCode}'s story.`
            : `Showing ${intent.view.currencyCode} against ${intent.view.benchmark} over ${intent.view.horizon[0]} ${intent.view.horizon === '1yr' ? 'year' : 'years'}.`,
          revealSurface: true,
        };
        break;
      case 'navigate':
        if (intent.tab === 'agent') experience?.setExperienceMode('full');
        navigation.setActiveTab(intent.tab);
        result = { message: `${TAB_LABELS[intent.tab]} is open.`, revealSurface: true };
        break;
      case 'explain_current': {
        const reading = navigation.currencyReading;
        const matches = !navigation.currencyView || (reading
          && reading.currencyCode === navigation.currencyView.currencyCode
          && reading.benchmark === navigation.currencyView.benchmark
          && reading.horizon === navigation.currencyView.horizon);
        result = {
          message: navigation.activeTab === 'overview' && reading?.story
            ? 'Do you mean the comparison reading or a dated event in this story? Close the story to explain the comparison.'
            : navigation.activeTab === 'overview' && reading && matches
            ? reading.explanation
            : 'Open a currency reading on Home, then ask me to explain that number.',
          revealSurface: false,
        };
        break;
      }
      case 'cancel_draft':
        if (navigation.exchangeNetwork === 'stellar:testnet') {
          result = { message: 'Use Cancel in the Stellar review to discard that draft. A submitted transaction cannot be undone.', revealSurface: false };
        } else if (navigation.swapPrefill) {
          navigation.clearSwapPrefill();
          result = { message: 'Cleared the pending exchange proposal. No transaction was signed by this action.', revealSurface: false };
        } else {
          result = { message: 'Use Cancel in the transaction review to discard that draft. A submitted transaction cannot be undone.', revealSurface: false };
        }
        break;
      case 'open_stellar':
        if (stellarTestnetEnabled()) {
          navigation.setExchangeNetwork('stellar:testnet');
          navigation.setActiveTab('exchange');
          result = { message: 'Stellar testnet is open. Use test funds and review the exchange before approving it in Freighter.', revealSurface: true };
        } else {
          result = { message: 'Stellar testnet is not enabled in this build.', revealSurface: false };
        }
        break;
      case 'review_proposal':
        result = { message: 'Review the exact amount, asset, destination, and fees in Exchange. Signing requires the wallet approval control.', revealSurface: false };
        break;
      case 'clarify':
        navigation.setCurrencyClarification(intent.clarification ?? null);
        result = { message: intent.message, revealSurface: false };
        break;
    }
    if (!isDemo) trackFunnelEvent('guardian_interaction', { kind: intent.kind, result: intent.kind === 'clarify' ? 'clarification' : 'applied' });
    return result;
  }, [navigation, isDemo, experience, current]);

  const getView = useCallback(() => {
    if (!navigation) return undefined;
    const pair = navigation.activeTab === 'exchange' && navigation.exchangeNetwork !== 'stellar:testnet' ? readExchangePair() : null;
    return {
      tab: navigation.activeTab,
      ...(pair ? { pair: { from: pair.fromToken, to: pair.toToken } } : {}),
      ...(navigation.activeTab === 'overview' && current ? {
        currency: { currencyCode: current.currencyCode, benchmark: current.benchmark, horizon: current.horizon, story: current.story },
      } : {}),
    };
  }, [navigation, current]);
  const consumeClarification = useCallback(() => navigation?.setCurrencyClarification(null), [navigation]);
  return { discover, interpret, apply, getView, consumeClarification };
}
