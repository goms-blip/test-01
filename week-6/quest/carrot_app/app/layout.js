import './globals.css';
import { createClient } from '@/lib/supabase/server';
import TopBar from '@/components/TopBar';
import BottomNav from '@/components/BottomNav';

export const metadata = {
  title: '🥕 당근마켓 클론',
  description: '내 동네 중고 거래',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({ children }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let profile = null;
  if (user) {
    const { data } = await supabase
      .from('carrot_profiles')
      .select('id, nickname, region, email')
      .eq('id', user.id)
      .maybeSingle();
    profile = data;
  }

  return (
    <html lang="ko">
      <body>
        <div className="min-h-full pb-20">
          <TopBar profile={profile} />
          <main className="max-w-3xl mx-auto px-4 pt-3">{children}</main>
          <BottomNav loggedIn={!!user} />
        </div>
      </body>
    </html>
  );
}
