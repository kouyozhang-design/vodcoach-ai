import HomeScreen from "@/components/home-screen";
import { sessionIsPresent } from "@/lib/sign-out";
import { createSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Page() {
  const signedIn = await sessionIsPresent(await createSupabaseServer());
  return <HomeScreen signedIn={signedIn} />;
}
