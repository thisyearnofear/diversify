import { LegalPage } from '../components/legal/LegalPage';

export default function Risk() {
  return (
    <LegalPage title="Risk disclosures">
      <section>
        <p>
          DiversiFi is software for moving your own funds between tokens. It
          does not remove the risks below — read them before using it.
        </p>
      </section>
      <section>
        <h2 className="font-semibold text-gray-900 dark:text-white">Self-custody</h2>
        <p className="mt-2">
          Your savings stay in your wallet. If you lose your keys or recovery
          phrase, nobody — including DiversiFi — can recover them.
        </p>
      </section>
      <section>
        <h2 className="font-semibold text-gray-900 dark:text-white">Stablecoins</h2>
        <p className="mt-2">
          Stablecoins can depeg and their issuers can fail, freeze, or delay
          redemptions. A &ldquo;dollar-pegged&rdquo; token is a claim on an issuer, not a
          bank deposit.
        </p>
      </section>
      <section>
        <h2 className="font-semibold text-gray-900 dark:text-white">Smart contracts</h2>
        <p className="mt-2">
          Swaps execute through third-party protocols (Mento, Uniswap,
          aggregators). Bugs, exploits, or paused venues can lose or lock
          funds. A confirmed transaction is final — it cannot be reversed.
        </p>
      </section>
      <section>
        <h2 className="font-semibold text-gray-900 dark:text-white">Currency and market risk</h2>
        <p className="mt-2">
          FX rates move both ways — a hedge can underperform holding your
          original currency. Local stablecoins can be thinly traded, and
          underlying markets (e.g. foreign exchange windows) may be closed
          when you act, widening spreads.
        </p>
      </section>
      <section>
        <h2 className="font-semibold text-gray-900 dark:text-white">Information limits</h2>
        <p className="mt-2">
          Historical data is not a forecast. The AI assistant (Guardian) can
          be wrong, and its recommendations are information, not investment
          advice. Guardian autonomy acts only within limits you grant through
          your wallet&rsquo;s permissions; you can revoke them.
        </p>
      </section>
      <section>
        <h2 className="font-semibold text-gray-900 dark:text-white">Regulation</h2>
        <p className="mt-2">
          Rules for crypto assets vary by country and change. Access may be
          restricted where required by law.
        </p>
      </section>
    </LegalPage>
  );
}
