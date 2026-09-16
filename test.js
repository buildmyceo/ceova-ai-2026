const { createClient } = require('@supabase/supabase-js');
console.log(typeof createClient('http://localhost', 'anon').auth.linkIdentity);
