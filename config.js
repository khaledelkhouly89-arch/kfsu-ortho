/* ================================================================
   KFSU Ortho Registry — connection settings
   ----------------------------------------------------------------
   1. Create a free project at https://supabase.com
   2. Project Settings → API  → copy "Project URL" and the "anon public" key
   3. Paste them below (keep the quotes) and re-upload the site.

   While these are left empty the portal runs in DEMO MODE:
   records are kept only in this browser, for trying things out.
   The anon key is designed to be public — patient data is protected
   by the staff login + database security rules (supabase-setup.sql).
   ================================================================ */
window.KFSU_CONFIG = {
  SUPABASE_URL: "https://sgeuhvflieobjxcfukux.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNnZXVodmZsaWVvYmp4Y2Z1a3V4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQwNzcwMTIsImV4cCI6MjEwOTY1MzAxMn0.WLppQpmfIbLPILIlpbozGgZ6EeNWmcmuv4p9cTkkSCU",

  // Shown in the header and on printed slips / lists
  HOSPITAL_NAME: "Kafr El-Sheikh University Hospital",
  DEPARTMENT_NAME: "Orthopedic & Trauma Surgery Department",
  DEPARTMENT_NAME_AR: "قسم جراحة العظام والكسور",

  // Edit these lists to match your department
  THEATRES: ["OR 1", "OR 2", "OR 3", "Emergency OR"],
  SURGEONS: [] // e.g. ["Prof. A", "Dr. B"] — leave empty to type freely
};
