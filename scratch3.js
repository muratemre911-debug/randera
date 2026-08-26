const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");
const env = fs.readFileSync(".env.local", "utf8");
let supabaseUrl = "", serviceRoleKey = "";
env.split("\n").forEach(line => {
  if (line.startsWith("NEXT_PUBLIC_SUPABASE_URL=")) supabaseUrl = line.split("=")[1].trim();
  if (line.startsWith("SUPABASE_SERVICE_ROLE_KEY=")) serviceRoleKey = line.split("=")[1].trim();
});
const supabase = createClient(supabaseUrl, serviceRoleKey);
async function run() {
  const { data: subs } = await supabase.from("push_subscriptions").select("*");
  console.log("Subscribed tenant_ids:", subs.map(s => s.tenant_id));
  
  const { data: tenants } = await supabase.from("tenants").select("id, name");
  console.log("All tenants:", tenants);
}
run();
