require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
);

async function run() {
  const { data, error } = await supabase
    .from('user_subscriptions')
    .select('id, user_id, status, current_period_end, cancel_at_period_end, razorpay_subscription_id, plan_id')
    .lt('current_period_end', new Date().toISOString());

  console.log("Expired Subs:", data);
  if (error) console.error(error);
}
run();
