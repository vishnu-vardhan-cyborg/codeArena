const { createClient } = require("@supabase/supabase-js");

const supabaseUrl =
  process.env.SUPABASE_URL || "https://qchtkwvdiguwmdvzihlz.supabase.co";

const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "sb_publishable_3fMcVJ1wOg_05kHz4rhBWg_LLgM-lne";

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = {
  supabase,
};
