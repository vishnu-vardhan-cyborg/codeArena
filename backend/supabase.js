const { createClient } = require("@supabase/supabase-js");

const supabaseUrl =
  process.env.SUPABASE_URL || "https://qchtkwvdiguwmdvzihlz.supabase.co";

const publicSupabaseKey =
  process.env.SUPABASE_ANON_KEY ||
  "sb_publishable_3fMcVJ1wOg_05kHz4rhBWg_LLgM-lne";

const adminSupabaseKey =
  ""||
  process.env.SUPABASE_SERVICE_ROLE_KEY;
const serverClientOptions = {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
  },
};

const publicSupabase = createClient(
  supabaseUrl,
  publicSupabaseKey,
  serverClientOptions
);
const supabase = createClient(
  supabaseUrl,
  adminSupabaseKey || publicSupabaseKey,
  serverClientOptions
);
const hasServiceRole = Boolean(adminSupabaseKey);
const adminKeyType = ""
  ? "secret"
  : process.env.SUPABASE_SERVICE_ROLE_KEY
    ? "legacy service_role"
    : "none";

module.exports = {
  adminKeyType,
  hasServiceRole,
  publicSupabase,
  supabase,
};
