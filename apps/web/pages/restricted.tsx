import Head from 'next/head';
import Link from 'next/link';

/**
 * Shown when the edge proxy rewrites a sanctioned location here (451).
 * Quiet and honest: no blame, no workaround instructions.
 */
export default function Restricted() {
  return (
    <>
      <Head>
        <title>DiversiFi — not available in your region</title>
        <meta name="robots" content="noindex" />
      </Head>
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-6 dark:bg-black">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            DiversiFi isn&rsquo;t available in your region
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
            Access is restricted because of sanctions law. This applies to the
            product and its API.
          </p>
          <p className="mt-6 text-sm">
            <Link
              href="/terms"
              className="text-gray-900 underline underline-offset-4 dark:text-white"
            >
              Read the terms
            </Link>
          </p>
        </div>
      </main>
    </>
  );
}
