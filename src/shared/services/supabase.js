import { createClient } from "@supabase/supabase-js";

export const supabaseUrl = "https://qchtkwvdiguwmdvzihlz.supabase.co";
const supabaseKey = "sb_publishable_3fMcVJ1wOg_05kHz4rhBWg_LLgM-lne";

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
);