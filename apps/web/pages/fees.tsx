import { LegalPage, Counsel } from '../components/legal/LegalPage';

export default function Fees() {
  return (
    <LegalPage title="Fees">
      <section>
        <h2 className="font-semibold text-gray-900 dark:text-white">Swap fees</h2>
        <p className="mt-2">
          DiversiFi currently charges no fee on swaps. You still pay costs that
          aren&rsquo;t ours:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Network gas, charged by the blockchain network.</li>
          <li>
            Venue costs built into the quote — Mento&rsquo;s rate spread, Uniswap
            pool fee tiers, or aggregator costs. These are reflected in the
            quote shown before you sign.
          </li>
        </ul>
        <p className="mt-2">
          Any future DiversiFi fee will be shown in the quote before you sign.
        </p>
      </section>
      <section>
        <h2 className="font-semibold text-gray-900 dark:text-white">
          Protection Reviews
        </h2>
        <p className="mt-2">
          The intended product model is a Protection Review — a single decision
          artifact — priced per review ($1 in the prototype). Ambient
          monitoring stays free; a review is funded only when there is
          something worth deciding, and the price appears in-app (&ldquo;Fund &amp;
          run · $1.00&rdquo;) before any wallet prompt. This balance model is product
          direction; its availability depends on deployment.{' '}
          <Counsel note="confirm wording once the Protection Balance ships" />
        </p>
      </section>
      <section>
        <h2 className="font-semibold text-gray-900 dark:text-white">
          Guardian autonomy
        </h2>
        <p className="mt-2">
          No management or performance fee is charged on Guardian actions.{' '}
          <Counsel note="confirm no other fee surfaces exist" />
        </p>
      </section>
    </LegalPage>
  );
}
