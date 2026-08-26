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
  const { data: users } = await supabase.from("profiles").select("id, email, tenant_id").in("email", ["muratemre911@gmail.com", "muratemre912@gmail.com"]);
  console.log("Super Admin Profiles:", users);
}
run();
