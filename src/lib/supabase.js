import { createClient } from "@supabase/supabase-js";

// Read Supabase settings from Vite environment variables.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Warn during development when the app cannot connect to Supabase.
  console.warn("Supabase credentials not configured");
}

// Export one shared Supabase client so all pages use the same connection setup.
export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
