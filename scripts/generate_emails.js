import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = process.env.SUPABASE_URL || 'https://jqpbgcmrlpfqnellznhz.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const imagesToUpload = [
  { name: 'welcome_poster.png', path: '/Users/chintukumar/.gemini/antigravity-ide/brain/465a54fd-5590-4d54-b1b0-a523e5e39838/welcome_poster_1780676300973.png' },
  { name: 'new_device_login_poster.png', path: '/Users/chintukumar/.gemini/antigravity-ide/brain/465a54fd-5590-4d54-b1b0-a523e5e39838/new_device_login_poster_1780676313100.png' },
  { name: 'subscription_activated_poster.png', path: '/Users/chintukumar/.gemini/antigravity-ide/brain/465a54fd-5590-4d54-b1b0-a523e5e39838/subscription_activated_poster_1780676326860.png' },
  { name: 'subscription_renewed_poster.png', path: '/Users/chintukumar/.gemini/antigravity-ide/brain/465a54fd-5590-4d54-b1b0-a523e5e39838/subscription_renewed_poster_1780676339962.png' },
  { name: 'payment_failed_poster.png', path: '/Users/chintukumar/.gemini/antigravity-ide/brain/465a54fd-5590-4d54-b1b0-a523e5e39838/payment_failed_poster_1780676354013.png' },
  { name: 'subscription_cancelled_poster.png', path: '/Users/chintukumar/.gemini/antigravity-ide/brain/465a54fd-5590-4d54-b1b0-a523e5e39838/subscription_cancelled_poster_1780676366644.png' }
];

async function uploadImages() {
  console.log('Uploading images to Supabase assets bucket...');
  const uploadedUrls = {};
  
  for (const img of imagesToUpload) {
    if (!fs.existsSync(img.path)) continue;
    
    const fileBuffer = fs.readFileSync(img.path);
    const { data, error } = await supabase.storage
      .from('assets')
      .upload(`emails/${img.name}`, fileBuffer, {
        contentType: 'image/png',
        upsert: true
      });
      
    if (error) {
      console.error(`Failed to upload ${img.name}:`, error);
    } else {
      const { data: publicUrlData } = supabase.storage.from('assets').getPublicUrl(`emails/${img.name}`);
      uploadedUrls[img.name.replace('.png', '')] = publicUrlData.publicUrl;
      console.log(`Uploaded ${img.name}: ${publicUrlData.publicUrl}`);
    }
  }
  
  return uploadedUrls;
}

const BRAND_GRADIENT = "linear-gradient(135deg, #1A1A2E 0%, #16213E 50%, #0F3460 100%)";
const LOGO_URL = "https://ceova.online/ceova_logo.png"; // Placeholder for the actual logo if hosted, but text is fine

function generateEmailHtml(campaign, imageUrl) {
  const heroImageHtml = imageUrl 
    ? `<img src="${imageUrl}" alt="Poster" style="width: 100%; max-width: 600px; height: auto; border-radius: 12px; margin-bottom: 24px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">`
    : `<div style="width: 100%; height: 200px; border-radius: 12px; margin-bottom: 24px; background: linear-gradient(135deg, #0F3460, #E94560); display: flex; align-items: center; justify-content: center;"><h2 style="color: white; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-weight: 300; letter-spacing: 2px;">CEOVA AI</h2></div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${campaign.subject}</title>
<style>
  body { margin: 0; padding: 0; background-color: #0d0d12; color: #e2e8f0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
  .wrapper { width: 100%; table-layout: fixed; background-color: #0d0d12; padding-bottom: 40px; }
  .main { background-color: #12121a; margin: 0 auto; width: 100%; max-width: 600px; border-spacing: 0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.5); }
  .header { padding: 32px 40px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.05); }
  .header h1 { margin: 0; color: #fff; font-size: 24px; font-weight: 600; letter-spacing: 1px; }
  .content { padding: 40px; }
  .headline { font-size: 28px; font-weight: 700; color: #ffffff; margin-bottom: 16px; line-height: 1.3; }
  .text { font-size: 16px; line-height: 1.6; color: #cbd5e1; margin-bottom: 24px; }
  .card { background-color: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; padding: 24px; margin-bottom: 24px; }
  .card-title { font-size: 18px; font-weight: 600; color: #fff; margin-top: 0; margin-bottom: 12px; }
  .list-item { margin-bottom: 12px; display: flex; align-items: flex-start; }
  .cta-container { text-align: center; margin: 40px 0 20px; }
  .btn { display: inline-block; background: linear-gradient(135deg, #6366f1, #a855f7); color: #ffffff !important; text-decoration: none; font-weight: 600; padding: 14px 32px; border-radius: 100px; font-size: 16px; box-shadow: 0 4px 15px rgba(168, 85, 247, 0.4); }
  .footer { padding: 32px 40px; text-align: center; font-size: 13px; color: #64748b; background-color: #0a0a0f; }
  .footer a { color: #94a3b8; text-decoration: none; }
</style>
</head>
<body>
<center class="wrapper">
  <div style="height: 40px;"></div>
  <table class="main" width="100%">
    <tr>
      <td class="header">
        <h1>CEOVA</h1>
      </td>
    </tr>
    <tr>
      <td class="content">
        ${heroImageHtml}
        <h2 class="headline">${campaign.headline}</h2>
        <p class="text">${campaign.description}</p>
        
        <div class="card">
          <h3 class="card-title">${campaign.cardTitle}</h3>
          <p class="text" style="margin-bottom: 16px;">${campaign.cardDesc}</p>
          ${campaign.benefits.map(b => `<div class="list-item"><span style="color: #a855f7; margin-right: 8px;">✓</span> ${b}</div>`).join('')}
        </div>
        
        <div class="cta-container">
          <a href="${campaign.ctaLink}" class="btn">${campaign.ctaText}</a>
        </div>
      </td>
    </tr>
    <tr>
      <td class="footer">
        <p>&copy; 2026 Ceova Inc. All rights reserved.</p>
        <p>
          <a href="https://ceova.online">Website</a> &bull; 
          <a href="mailto:support@ceova.online">Support</a> &bull; 
          <a href="https://ceova.online/privacy">Privacy</a>
        </p>
        <p style="margin-top: 16px;">
          <a href="{{unsubscribe_url}}" style="text-decoration: underline;">Unsubscribe from marketing emails</a>
        </p>
      </td>
    </tr>
  </table>
</center>
</body>
</html>`;
}

const campaignsData = [
  {
    slug: 'welcome',
    subject: 'Welcome to Ceova — Your AI is ready 🚀',
    headline: 'Your AI journey starts here.',
    description: 'Welcome to Ceova. You now have access to a world-class AI orchestration platform designed for speed, privacy, and limitless capability.',
    cardTitle: 'What you can do right now:',
    cardDesc: 'Ceova is built to integrate seamlessly into your workflow.',
    benefits: ['Chat with advanced models', 'Connect your custom APIs', 'Run local models for total privacy'],
    ctaText: 'Open Ceova Workspace →',
    ctaLink: 'https://ceova.online/workspace'
  },
  {
    slug: 'new_device_login',
    subject: '🔐 New sign-in to your Ceova account',
    headline: 'Account Security Alert',
    description: 'We noticed a new login to your Ceova account from a new device. If this was you, no action is needed.',
    cardTitle: 'Login Details:',
    cardDesc: 'Please verify the following information:',
    benefits: ['Device: {{device_name}}', 'Location: {{location}}', 'Time: {{login_time}}'],
    ctaText: 'Secure My Account →',
    ctaLink: 'https://ceova.online/settings/security'
  },
  {
    slug: 'subscription_activated',
    subject: '🎉 Your {{plan_name}} subscription is now active!',
    headline: 'Welcome to Pro.',
    description: 'Your Ceova {{plan_name}} subscription is officially active. You have just unlocked the full potential of our AI ecosystem.',
    cardTitle: 'Your new capabilities:',
    cardDesc: 'Here is what you can now access with your upgraded plan:',
    benefits: ['Unlimited messaging', 'Priority model access', 'Advanced API integrations', 'Premium support'],
    ctaText: 'Explore Pro Features →',
    ctaLink: 'https://ceova.online/dashboard'
  },
  {
    slug: 'subscription_renewed',
    subject: '✅ Your Ceova {{plan_name}} has been renewed',
    headline: 'Your AI power continues.',
    description: 'Your Ceova {{plan_name}} subscription has been successfully renewed. Your workflow will continue uninterrupted.',
    cardTitle: 'Subscription Details:',
    cardDesc: 'Your account is in good standing.',
    benefits: ['Plan: {{plan_name}}', 'Status: Active', 'Next Billing: {{next_billing_date}}'],
    ctaText: 'View Invoice →',
    ctaLink: 'https://ceova.online/settings/billing'
  },
  {
    slug: 'payment_failed',
    subject: '⚠️ Action Required: Ceova payment failed',
    headline: 'Action Required',
    description: 'We were unable to process your recent payment for your Ceova subscription. To prevent interruption of your services, please update your payment details.',
    cardTitle: 'How to fix this:',
    cardDesc: 'Updating your payment method takes less than a minute.',
    benefits: ['Click the secure link below', 'Enter your new card details', 'Your service will resume instantly'],
    ctaText: 'Update Payment Method →',
    ctaLink: 'https://ceova.online/settings/billing'
  },
  {
    slug: 'subscription_cancelled',
    subject: 'Your Ceova subscription has been cancelled',
    headline: 'Sorry to see you go.',
    description: 'Your Ceova Pro subscription has been cancelled. You will continue to have access until the end of your billing cycle.',
    cardTitle: 'What happens next?',
    cardDesc: 'Your account will transition to the free tier.',
    benefits: ['Your data is kept safe', 'You can resubscribe at any time', 'Local Ollama models remain free to use'],
    ctaText: 'Reactivate Subscription →',
    ctaLink: 'https://ceova.online/settings/billing'
  },
  {
    slug: 'inactive_2_days',
    subject: 'Did you forget about Ceova? 👀',
    headline: 'We miss you.',
    description: 'It’s been a couple of days since you last used Ceova. Your AI assistant is patiently waiting at your workspace, ready to help you tackle your next big project.',
    cardTitle: 'Jump back in:',
    cardDesc: 'Here are a few things you can ask Ceova right now:',
    benefits: ['"Summarize my recent notes"', '"Help me write a professional email"', '"Brainstorm ideas for my new project"'],
    ctaText: 'Resume Your AI Journey →',
    ctaLink: 'https://ceova.online'
  },
  {
    slug: 'inactive_7_days',
    subject: '🤔 A week away from Ceova — here\'s what you\'re missing',
    headline: 'Your work is waiting.',
    description: 'It has been a week since your last login. While you were away, we have been optimizing our models to run faster and smarter.',
    cardTitle: 'Unlock your productivity:',
    cardDesc: 'Reconnecting with Ceova can save you hours of work each week.',
    benefits: ['Automate repetitive tasks', 'Get instant answers to complex queries', 'Generate code and content effortlessly'],
    ctaText: 'Continue Your Projects →',
    ctaLink: 'https://ceova.online'
  },
  {
    slug: 'inactive_30_days',
    subject: '💔 We haven\'t seen you in a month — is everything okay?',
    headline: 'Come back and unlock more.',
    description: 'It has been a month since you last visited Ceova. Your AI command center is ready to be powered back up whenever you need it.',
    cardTitle: 'What is new?',
    cardDesc: 'We are constantly adding new features. Log in to discover the latest capabilities.',
    benefits: ['Improved model accuracy', 'New API integrations', 'Faster local inference'],
    ctaText: 'Log In to Ceova →',
    ctaLink: 'https://ceova.online'
  },
  {
    slug: 'educational_drip_1',
    subject: '💡 Ceova Tip 1: Build a 3-step AI pipeline',
    headline: 'Mastering AI Workflows',
    description: 'Ceova is more than just a chat interface. It is a powerful orchestration tool that allows you to chain commands and automate entire workflows.',
    cardTitle: 'Create your first pipeline:',
    cardDesc: 'You can automate complex tasks by connecting simple steps.',
    benefits: ['Step 1: Fetch data from an API', 'Step 2: Ask the AI to summarize it', 'Step 3: Output the result as a PDF'],
    ctaText: 'Build a Workflow →',
    ctaLink: 'https://ceova.online/docs/workflows'
  },
  {
    slug: 'educational_drip_2',
    subject: '💡 Ceova Tip 2: Teach Ceova your context',
    headline: 'A Digital AI Brain',
    description: 'Tired of repeating yourself? Ceova can remember your preferences, project details, and coding style to provide perfectly tailored responses every time.',
    cardTitle: 'How to use Memory:',
    cardDesc: 'Teach your AI what it needs to know.',
    benefits: ['Add context to your profile settings', 'Upload project documentation', 'Enjoy highly relevant, personalized answers'],
    ctaText: 'Configure Memory →',
    ctaLink: 'https://ceova.online/settings/memory'
  },
  {
    slug: 'educational_drip_3',
    subject: '💡 Ceova Tip 3: Connect any API',
    headline: 'Connect Multiple Systems',
    description: 'The true power of Ceova lies in its ability to interact with the outside world. You can connect Ceova to your own APIs, databases, and third-party services.',
    cardTitle: 'Endless possibilities:',
    cardDesc: 'Ceova can act as the brain for your entire infrastructure.',
    benefits: ['Query your secure databases directly', 'Trigger actions in external tools', 'Build custom intelligent dashboards'],
    ctaText: 'Explore API Docs →',
    ctaLink: 'https://ceova.online/docs/api'
  },
  {
    slug: 'educational_drip_4',
    subject: '💡 Ceova Tip 4: Run models locally with Ollama',
    headline: 'Run Powerful AI Models Directly On Your Computer',
    description: 'Most AI tools send your data to cloud servers. With Ceova + Ollama you can run AI models locally on your own device.',
    cardTitle: 'Why run locally?',
    cardDesc: 'Local models offer unparalleled advantages for privacy-conscious users.',
    benefits: ['Complete Privacy: Your data never leaves your machine', 'No API Costs: Generate unlimited text for free', 'Works Without Internet: Code on airplanes or off-grid'],
    ctaText: 'Connect Ollama →',
    ctaLink: 'https://ceova.online/docs/ollama'
  },
  {
    slug: 'educational_drip_5',
    subject: '💡 Ceova Tip 5: Your daily AI toolkit',
    headline: 'Your Daily Productivity Engine',
    description: 'Ceova is designed to be the first app you open in the morning and the last one you close at night. It is your ultimate toolkit for getting things done.',
    cardTitle: 'Real-world examples:',
    cardDesc: 'Here is how professionals use Ceova every day:',
    benefits: ['Developers debug complex issues instantly', 'Writers draft high-quality content in minutes', 'Managers summarize long threads effortlessly'],
    ctaText: 'Start Your Day with Ceova →',
    ctaLink: 'https://ceova.online'
  }
];

async function updateDatabase() {
  const urls = await uploadImages();
  
  console.log('Generating HTML and updating database...');
  for (const campaign of campaignsData) {
    const imageUrl = urls[campaign.slug] || null; // Will be null for the ones we couldn't generate
    const htmlBody = generateEmailHtml(campaign, imageUrl);
    
    const { data, error } = await supabase
      .from('email_campaigns')
      .update({ html_body: htmlBody, subject: campaign.subject })
      .eq('slug', campaign.slug);
      
    if (error) {
      console.error(`Error updating ${campaign.slug}:`, error);
    } else {
      console.log(`Updated ${campaign.slug}`);
    }
  }
  console.log('All email templates successfully redesigned and updated in the database!');
}

updateDatabase();
