const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");

const env = fs.readFileSync(".env.local", "utf8");
let supabaseUrl = "";
let serviceRoleKey = "";
env.split("\n").forEach(line => {
  if (line.startsWith("NEXT_PUBLIC_SUPABASE_URL=")) supabaseUrl = line.split("=")[1].trim();
  if (line.startsWith("SUPABASE_SERVICE_ROLE_KEY=")) serviceRoleKey = line.split("=")[1].trim();
});

const supabase = createClient(supabaseUrl, serviceRoleKey);
async function run() {
  const { data: authUsers } = await supabase.auth.admin.listUsers();
  console.log("Users:", authUsers.users.map(u => u.email));
}
run();
