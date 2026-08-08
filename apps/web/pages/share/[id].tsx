import { GetServerSideProps } from 'next';
import Head from 'next/head';

interface SharePageProps {
  id: string;
  regions: string;
  diversification: string;
  inflation: string;
  rwa: string;
  score: string;
  percentile: string;
}

export const getServerSideProps: GetServerSideProps<SharePageProps> = async ({ params, query }) => {
  const id = params?.id as string || 'default';
  
  return {
    props: {
      id,
      regions: (query.r as string) || '3',
      diversification: (query.d as string) || 'B',
      inflation: (query.i as string) || 'A',
      rwa: (query.rwa as string) || '15',
      score: (query.s as string) || '65',
      percentile: (query.p as string) || '75',
    },
  };
};

export default function SharePage({ id, regions, diversification, inflation, rwa, score, percentile }: SharePageProps) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://diversifiapp.vercel.app';
  
  // Build dynamic OG image URL with user stats
  const ogImageUrl = `${baseUrl}/api/og/share-card?regions=${regions}&div=${diversification}&inf=${inflation}&rwa=${rwa}&score=${score}&percentile=${percentile}&id=${id}`;
  
  // Build the share page URL (this page)
  const sharePageUrl = `${baseUrl}/share/${id}?r=${regions}&d=${diversification}&i=${inflation}&rwa=${rwa}&s=${score}&p=${percentile}`;
  
  // Build Mini App embed metadata for Farcaster
  const miniAppEmbed = {
    version: "1",
    imageUrl: ogImageUrl,
    button: {
      title: "Check Your Protection",
      action: {
        type: "launch_miniapp",
        url: baseUrl,
        name: "DiversiFi",
        splashImageUrl: `${baseUrl}/splash.png`,
        splashBackgroundColor: "#8B5CF6"
      }
    }
  };

  const miniAppEmbedJson = JSON.stringify(miniAppEmbed);

  return (
    <>
      <Head>
        <title>My Protection Score | DiversiFi</title>
        <meta name="description" content={`Savings protected across ${regions} regions with ${diversification} diversification rating`} />
        
        {/* Open Graph for general social */}
        <meta property="og:title" content={`I'm in the top ${percentile}% of DiversiFi users`} />
        <meta property="og:description" content={`${regions} regions protected • Diversification ${diversification} • Inflation Hedge ${inflation}`} />
        <meta property="og:image" content={ogImageUrl} />
        <meta property="og:url" content={sharePageUrl} />
        <meta property="og:type" content="website" />
        
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`I'm in the top ${percentile}% of DiversiFi users`} />
        <meta name="twitter:description" content={`${regions} regions protected • Diversification ${diversification} • Inflation Hedge ${inflation}`} />
        <meta name="twitter:image" content={ogImageUrl} />
        
        {/* Farcaster Mini App Embed - THE KEY FOR VIRALITY */}
        <meta name="fc:miniapp" content={miniAppEmbedJson} />
        {/* Backward compatibility */}
        <meta name="fc:frame" content={miniAppEmbedJson} />
      </Head>
      
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-3xl font-black">D</span>
          </div>
          
          <h1 className="text-2xl font-bold text-white mb-2">Protection Analysis</h1>
          <p className="text-purple-200 mb-6">Top {percentile}% of DiversiFi users</p>
          
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-white/10 rounded-xl p-4">
              <p className="text-xs text-gray-400 uppercase tracking-wider">Regions</p>
              <p className="text-2xl font-bold text-green-400">{regions}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-4">
              <p className="text-xs text-gray-400 uppercase tracking-wider">Diversification</p>
              <p className="text-2xl font-bold text-green-400">{diversification}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-4">
              <p className="text-xs text-gray-400 uppercase tracking-wider">Hedge</p>
              <p className="text-2xl font-bold text-green-400">{inflation}</p>
            </div>
          </div>
          
          <a 
            href={baseUrl}
            className="inline-block w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-4 px-8 rounded-xl transition-colors"
          >
            Check Your Protection Score
          </a>
          
          <p className="text-gray-400 text-sm mt-4">
            Protect your savings against currency debasement
          </p>
        </div>
      </div>
    </>
  );
}
