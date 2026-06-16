/* =====================================================================
   Supabase config for the shared leaderboard.

   Fill these in to turn the leaderboard into a shared, cross-device board.
   Leave them blank to keep the leaderboard local to each device.

   Where to get them: Supabase dashboard → your project → Settings → API
     - url     = "Project URL"
     - anonKey = the "anon" / "public" API key
   The anon key is designed to be public (safe in client code); access is
   controlled by the table's Row Level Security policies.
   ===================================================================== */
window.SUPABASE_CONFIG = {
  url: "",
  anonKey: "",
};
