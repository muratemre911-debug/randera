const fs = require("fs");
const webpush = require("web-push");
const { createClient } = require("@supabase/supabase-js");

const env = fs.readFileSync(".env.local", "utf8");
let supabaseUrl = "", serviceRoleKey = "", vapidPublic = "", vapidPrivate = "";
env.split("\n").forEach(line => {
  if (line.startsWith("NEXT_PUBLIC_SUPABASE_URL=")) supabaseUrl = line.split("=")[1].trim();
  if (line.startsWith("SUPABASE_SERVICE_ROLE_KEY=")) serviceRoleKey = line.split("=")[1].trim();
  if (line.startsWith("NEXT_PUBLIC_VAPID_PUBLIC_KEY=")) vapidPublic = line.split("=")[1].trim();
  if (line.startsWith("VAPID_PRIVATE_KEY=")) vapidPrivate = line.split("=")[1].trim();
});

const supabase = createClient(supabaseUrl, serviceRoleKey);
webpush.setVapidDetails("mailto:test@example.com", vapidPublic, vapidPrivate);

async function run() {
  const { data: pushData } = await supabase.from("push_subscriptions").select("*");
  if (!pushData || pushData.length === 0) return console.log("No subscriptions");

  const sub = pushData[0];
  const pushSub = {
    endpoint: sub.endpoint,
    keys: { auth: sub.auth, p256dh: sub.p256dh }
  };

  try {
    const res = await webpush.sendNotification(pushSub, JSON.stringify({ title: "Test Ping", body: "Direct test" }));
    console.log("Push sent successfully:", res.statusCode);
  } catch (err) {
    console.error("Push error:", err);
  }
}
run();
