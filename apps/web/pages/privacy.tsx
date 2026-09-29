import { LegalPage, Counsel } from '../components/legal/LegalPage';

export default function Privacy() {
  return (
    <LegalPage title="Privacy">
      <section>
        <h2 className="font-semibold text-gray-900 dark:text-white">
          Controller and legal basis
        </h2>
        <p className="mt-2">
          <Counsel note="controller entity + contact" />{' '}
          <Counsel note="legal basis per processing purpose" />
        </p>
      </section>

      <section>
        <h2 className="font-semibold text-gray-900 dark:text-white">
          What we collect
        </h2>
        <p className="mt-2">
          DiversiFi is non-custodial: we never hold your funds or keys. The
          data below is what the product stores or transmits today.
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong>Wallet address</strong> — used as your account identifier
            for streaks, Guardian state, permissions, vaults, and transaction
            records.
          </li>
          <li>
            <strong>Approximate location</strong> — your country (and region,
            where applicable) is read from a request header to apply
            sanctions restrictions. It is used in-flight only and not stored.
          </li>
          <li>
            <strong>Wallet address for sanctions screening</strong> — sent to
            Chainalysis before swaps so we can decline sanctioned wallets.
          </li>
          <li>
            <strong>Chat content</strong> — messages you send to Guardian are
            processed by third-party AI providers to generate answers.
          </li>
          <li>
            <strong>Product analytics</strong> — privacy-lean funnel events
            (an anonymous per-browser session id, event name, coarse props).
            No IP, no wallet address, no user agent; Do Not Track is honored.
          </li>
          <li>
            <strong>Email</strong> — only if you join a waitlist, with your
            region and the feature you asked about.
          </li>
          <li>
            <strong>Agent memory (opt-in)</strong> — if you enable Guardian
            memory, conversation memory is stored in Tablestore or Cognee —
            your choice — keyed by your signature-verified address. It is off
            by default.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="font-semibold text-gray-900 dark:text-white">
          Records we keep
        </h2>
        <p className="mt-2">
          Streak and activity totals, Guardian recommendations and run logs,
          permission grants you issue, vault transactions, FX netting intents
          and settlements, credit claims, usage counters, and AI-generated
          reasoning echoes (the readable explanation linked to an on-chain
          hash).
        </p>
      </section>

      <section>
        <h2 className="font-semibold text-gray-900 dark:text-white">
          Third parties that receive data
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>AI providers (e.g. Venice, Gemini and failover providers) — your chat content.</li>
          <li>Chainalysis — your wallet address, for sanctions screening.</li>
          <li>Blockscout and public RPC endpoints — on-chain reads keyed by address.</li>
          <li>Privy — authentication, if you sign in through it.</li>
          <li>Tablestore or Cognee — agent memory, only when you opt in.</li>
        </ul>
      </section>

      <section>
        <h2 className="font-semibold text-gray-900 dark:text-white">
          On your device
        </h2>
        <p className="mt-2">
          Preferences live in your browser&rsquo;s local storage (theme, experience
          mode, region, tab, balance-visibility, dismissed tours, an optional
          self-hosted model key). Clearing site data removes them.
        </p>
      </section>

      <section>
        <h2 className="font-semibold text-gray-900 dark:text-white">
          Your choices
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Balance visibility can be hidden in-app.</li>
          <li>Agent memory is opt-in and can be cleared.</li>
          <li>Do Not Track disables funnel analytics.</li>
          <li>
            <Counsel note="retention periods + deletion/contact process" />
          </li>
        </ul>
      </section>
    </LegalPage>
  );
}
