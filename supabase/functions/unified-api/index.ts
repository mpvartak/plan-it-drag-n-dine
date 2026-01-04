import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

interface AuthResult {
  userId: string | null;
  error: string | null;
  authMethod: 'api_key' | 'jwt' | null;
}

/**
 * Unified authentication handler that supports:
 * 1. API Key (x-api-key header) - for ChatGPT Actions
 * 2. Supabase JWT (authorization header) - for MCP/App
 */
async function authenticateRequest(req: Request): Promise<AuthResult> {
  // Method 1: Check for API Key (ChatGPT Actions)
  const apiKey = req.headers.get('x-api-key');
  if (apiKey) {
    return await validateApiKey(apiKey);
  }

  // Method 2: Check for Supabase JWT (MCP/App)
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '');
    return await validateJwt(token);
  }

  return { userId: null, error: 'No authentication provided', authMethod: null };
}

/**
 * Validate API key against user_api_keys table
 * Uses service role to bypass RLS for lookup
 */
async function validateApiKey(apiKey: string): Promise<AuthResult> {
  try {
    // Hash the API key for comparison
    const encoder = new TextEncoder();
    const data = encoder.encode(apiKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const keyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Use service role to query the table (bypasses RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: keyData, error } = await supabase
      .from('user_api_keys')
      .select('user_id, is_active, expires_at')
      .eq('key_hash', keyHash)
      .single();

    if (error || !keyData) {
      console.log('API key lookup failed:', error?.message);
      return { userId: null, error: 'Invalid API key', authMethod: null };
    }

    if (!keyData.is_active) {
      return { userId: null, error: 'API key is deactivated', authMethod: null };
    }

    if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
      return { userId: null, error: 'API key has expired', authMethod: null };
    }

    // Update last_used_at
    await supabase
      .from('user_api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('key_hash', keyHash);

    return { userId: keyData.user_id, error: null, authMethod: 'api_key' };
  } catch (err) {
    console.error('API key validation error:', err);
    return { userId: null, error: 'Authentication error', authMethod: null };
  }
}

/**
 * Validate Supabase JWT token
 */
async function validateJwt(token: string): Promise<AuthResult> {
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      console.log('JWT validation failed:', error?.message);
      return { userId: null, error: 'Invalid or expired token', authMethod: null };
    }

    return { userId: user.id, error: null, authMethod: 'jwt' };
  } catch (err) {
    console.error('JWT validation error:', err);
    return { userId: null, error: 'Authentication error', authMethod: null };
  }
}

// ============================================
// SHARED BUSINESS LOGIC
// ============================================

async function getInventory(userId: string, filters?: { location?: string }) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  let query = supabase
    .from('inventory_items')
    .select('*')
    .eq('user_id', userId)
    .order('expiration_date', { ascending: true });

  if (filters?.location) {
    query = query.eq('location', filters.location);
  }

  return await query;
}

async function getMealPlan(userId: string, weekStartDate: string) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  // Get 7 days from week start
  const startDate = new Date(weekStartDate);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 6);

  return await supabase
    .from('meal_plans')
    .select('*')
    .eq('user_id', userId)
    .gte('date', weekStartDate)
    .lte('date', endDate.toISOString().split('T')[0])
    .order('date');
}

async function getRecipes(userId: string, mealItemName?: string) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  let query = supabase
    .from('recipes')
    .select('*, meal_items!inner(name)')
    .eq('user_id', userId);

  if (mealItemName) {
    query = query.ilike('meal_items.name', `%${mealItemName}%`);
  }

  return await query;
}

async function getMealItems(userId: string) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  return await supabase
    .from('meal_items')
    .select('*')
    .eq('user_id', userId)
    .order('name');
}

// ============================================
// REST API HANDLER
// ============================================

async function handleRestRequest(req: Request, url: URL, userId: string): Promise<Response> {
  const path = url.pathname.replace('/unified-api', '');
  const method = req.method;

  try {
    // GET /inventory
    if (path === '/inventory' && method === 'GET') {
      const location = url.searchParams.get('location') || undefined;
      const { data, error } = await getInventory(userId, { location });
      
      if (error) throw error;
      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // GET /meal-plan
    if (path === '/meal-plan' && method === 'GET') {
      const weekStart = url.searchParams.get('week_start');
      if (!weekStart) {
        return new Response(JSON.stringify({ error: 'week_start parameter required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      const { data, error } = await getMealPlan(userId, weekStart);
      if (error) throw error;
      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // GET /recipes
    if (path === '/recipes' && method === 'GET') {
      const mealItemName = url.searchParams.get('meal_item') || undefined;
      const { data, error } = await getRecipes(userId, mealItemName);
      if (error) throw error;
      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // GET /meal-items
    if (path === '/meal-items' && method === 'GET') {
      const { data, error } = await getMealItems(userId);
      if (error) throw error;
      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('REST handler error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// ============================================
// MCP HANDLER (Tool-based)
// ============================================

async function handleMcpRequest(req: Request, userId: string): Promise<Response> {
  try {
    const { tool, args } = await req.json();

    let result: any;

    switch (tool) {
      case 'list_inventory':
        result = await getInventory(userId, args);
        break;
      case 'get_meal_plan':
        result = await getMealPlan(userId, args.week_start);
        break;
      case 'list_recipes':
        result = await getRecipes(userId, args?.meal_item);
        break;
      case 'list_meal_items':
        result = await getMealItems(userId);
        break;
      default:
        return new Response(JSON.stringify({ error: `Unknown tool: ${tool}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    if (result.error) throw result.error;

    return new Response(JSON.stringify({ result: result.data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('MCP handler error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// ============================================
// MAIN ROUTER
// ============================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace('/unified-api', '');

  // Authenticate the request
  const auth = await authenticateRequest(req);

  if (!auth.userId) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  console.log(`Authenticated via ${auth.authMethod} for user ${auth.userId}`);

  // Route to appropriate handler
  if (path === '/mcp' && req.method === 'POST') {
    return await handleMcpRequest(req, auth.userId);
  }

  // All other paths go to REST handler
  return await handleRestRequest(req, url, auth.userId);
});
