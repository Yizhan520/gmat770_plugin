import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/env";

let client: SupabaseClient | null = null;

export function getSupabaseAdminClient() {
  if (client) {
    return client;
  }

  const { url, serviceRoleKey } = getSupabaseConfig();
  client = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return client;
}
