import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user via JWT
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { name, expires_in_days } = await req.json();

    if (!name) {
      return new Response(JSON.stringify({ error: 'Name is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Generate a secure random API key
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    const apiKey = 'mpp_' + Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');

    // Hash the key for storage
    const encoder = new TextEncoder();
    const data = encoder.encode(apiKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const keyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Calculate expiration date if specified
    let expiresAt: string | null = null;
    if (expires_in_days && expires_in_days > 0) {
      const expDate = new Date();
      expDate.setDate(expDate.getDate() + expires_in_days);
      expiresAt = expDate.toISOString();
    }

    // Store in database using service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { error: insertError } = await supabase
      .from('user_api_keys')
      .insert({
        user_id: user.id,
        name,
        key_hash: keyHash,
        key_prefix: apiKey.substring(0, 12) + '...', // "mpp_abc12345..."
        expires_at: expiresAt
      });

    if (insertError) {
      console.error('Failed to insert API key:', insertError);
      return new Response(JSON.stringify({ error: 'Failed to create API key' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Return the full API key (only time it's visible!)
    return new Response(JSON.stringify({
      api_key: apiKey,
      name,
      expires_at: expiresAt,
      message: 'Save this key - it will not be shown again!'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('Generate API key error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
