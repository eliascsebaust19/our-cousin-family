import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database.types";

let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null;

/**
 * Browser-side Supabase client singleton. Every query made with this client is
 * authorized by Row Level Security — never trust client-submitted ids
 * without an RLS policy behind them.
 */
export function createClient() {
  if (browserClient) return browserClient;
  browserClient = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return browserClient;
}
