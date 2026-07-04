const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'placeholder-key';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY || supabaseUrl.includes('your-project') || supabaseKey.includes('placeholder')) {
    console.warn('\n⚠️ WARNING: SUPABASE_URL or SUPABASE_KEY is unset or set to placeholder values. Database queries will fail until real keys are inputted in backend/.env.');
}

// Ensure the URL looks valid to createClient to avoid crash-on-startup regex formatting errors
const clientUrl = supabaseUrl.startsWith('http') ? supabaseUrl : 'https://placeholder.supabase.co';

const supabase = createClient(clientUrl, supabaseKey);

module.exports = supabase;
