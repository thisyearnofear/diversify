/**
 * Retired. This page rendered "Top X% of users" scores from unverifiable
 * query params — anyone could mint any number. Nothing generates these
 * links anymore; old ones redirect home.
 */
import type { GetServerSideProps } from 'next';

export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: { destination: '/', permanent: false },
});

export default function SharePage() {
  return null;
}
