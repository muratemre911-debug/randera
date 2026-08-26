const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");

const env = fs.readFileSync(".env.local", "utf8");
let supabaseUrl = "", anonKey = "";
env.split("\n").forEach(line => {
  if (line.startsWith("NEXT_PUBLIC_SUPABASE_URL=")) supabaseUrl = line.split("=")[1].trim();
  if (line.startsWith("NEXT_PUBLIC_SUPABASE_ANON_KEY=")) anonKey = line.split("=")[1].trim();
});

const supabase = createClient(supabaseUrl, anonKey);
async function run() {
  const { data, error } = await supabase.from("notifications").select("*").limit(1);
  console.log("Anon select test:", data, error);
}
run();
