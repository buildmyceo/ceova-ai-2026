import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://jqpbgcmrlpfqnellznhz.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const campaigns = [
  'welcome',
  'subscription_activated',
  'subscription_renewed',
  'subscription_cancelled',
  'payment_failed',
  'new_device_login',
  'inactive_2_days',
  'inactive_7_days',
  'inactive_30_days',
  'educational_drip_1',
  'educational_drip_2',
  'educational_drip_3',
  'educational_drip_4',
  'educational_drip_5'
];

async function sendTestEmails() {
  console.log('Queueing test emails for buildmyceo@gmail.com...');
  
  for (const slug of campaigns) {
    const { error } = await supabase
      .from('email_queue')
      .insert({
        to_email: 'buildmyceo@gmail.com',
        to_name: 'BuildMyCEO Team',
        campaign_slug: slug,
        status: 'pending',
        variables: {
          plan_name: 'Ceova Pro',
          device_name: 'MacBook Pro (M3 Max)',
          location: 'San Francisco, CA',
          login_time: new Date().toLocaleString(),
          next_billing_date: 'July 1st, 2026'
        }
      });
      
    if (error) {
      console.error(`Failed to queue ${slug}:`, error);
    } else {
      console.log(`Queued ${slug}`);
    }
  }
  
  console.log('Triggering process-email-queue edge function to send them immediately...');
  
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/process-email-queue`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ source: 'manual_test' })
    });
    
    const result = await response.json();
    console.log('Process queue result:', result);
    
    if (response.ok) {
      console.log('All 14 test emails have been successfully sent to buildmyceo@gmail.com!');
    } else {
      console.error('Queue processing failed:', result);
    }
  } catch (err) {
    console.error('Error triggering edge function:', err);
  }
}

sendTestEmails();
