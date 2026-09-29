import { LegalPage, Counsel } from '../components/legal/LegalPage';
import Link from 'next/link';

export default function Terms() {
  return (
    <LegalPage title="Terms of use">
      <section>
        <h2 className="font-semibold text-gray-900 dark:text-white">Entity</h2>
        <p className="mt-2">
          These terms are between you and <Counsel note="legal entity + jurisdiction" />.
        </p>
      </section>

      <section>
        <h2 className="font-semibold text-gray-900 dark:text-white">Eligibility</h2>
        <p className="mt-2">
          You may not use DiversiFi if you are located in, or a resident of, a
          comprehensively sanctioned country or region, or if your wallet
          address appears on a sanctions list. DiversiFi blocks sanctioned
          locations at the edge and screens wallet addresses before swaps.{' '}
          <Counsel note="age / capacity / other eligibility requirements" />
        </p>
      </section>

      <section>
        <h2 className="font-semibold text-gray-900 dark:text-white">Non-custodial</h2>
        <p className="mt-2">
          DiversiFi is non-custodial. Your funds stay in your own wallet;
          transactions are signed by you (or, for Guardian autonomy, by a
          scoped permission you grant through your smart account). We never
          take possession of user funds.
        </p>
      </section>

      <section>
        <h2 className="font-semibold text-gray-900 dark:text-white">No investment advice</h2>
        <p className="mt-2">
          Content, plans, and Guardian recommendations are informational, not
          investment, legal, or tax advice. You are responsible for your own
          decisions. See <Link href="/risk" className="underline underline-offset-2">Risk disclosures</Link>.{' '}
          <Counsel note="confirm whether personalised Guardian proposals count as personal recommendations in target jurisdictions; adjust this clause accordingly" />
        </p>
      </section>

      <section>
        <h2 className="font-semibold text-gray-900 dark:text-white">Guardian limits</h2>
        <p className="mt-2">
          Guardian acts autonomously only within the spending limits and scopes
          you grant (ERC-7715/7710 permissions), and only on supported chains.
          You can revoke permissions in your wallet. When autonomy isn&rsquo;t
          available, Guardian proposes actions for you to approve instead.
        </p>
      </section>

      <section>
        <h2 className="font-semibold text-gray-900 dark:text-white">Fees</h2>
        <p className="mt-2">
          DiversiFi charges no fee on swaps today; network and venue costs
          apply and are shown in the quote before signing. See{' '}
          <Link href="/fees" className="underline underline-offset-2">Fees</Link>.
        </p>
      </section>

      <section>
        <h2 className="font-semibold text-gray-900 dark:text-white">Liability</h2>
        <p className="mt-2">
          <Counsel note="limitation of liability, warranties disclaimer" />
        </p>
      </section>

      <section>
        <h2 className="font-semibold text-gray-900 dark:text-white">Governing law</h2>
        <p className="mt-2">
          <Counsel note="governing law + dispute forum" />
        </p>
      </section>
    </LegalPage>
  );
}
