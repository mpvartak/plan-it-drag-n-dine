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

async function createInventoryItem(userId: string, item: {
  name: string;
  quantity?: number;
  unit?: string;
  location?: 'fridge' | 'freezer' | 'pantry';
  expiration_date?: string;
  ready_to_eat?: boolean;
  notes?: string;
}) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  return await supabase
    .from('inventory_items')
    .insert({
      user_id: userId,
      name: item.name,
      quantity: item.quantity ?? 1,
      unit: item.unit,
      location: item.location ?? 'pantry',
      expiration_date: item.expiration_date,
      ready_to_eat: item.ready_to_eat ?? true,
      notes: item.notes,
    })
    .select()
    .single();
}

async function updateInventoryItem(userId: string, itemId: string, updates: {
  name?: string;
  quantity?: number;
  unit?: string;
  location?: 'fridge' | 'freezer' | 'pantry';
  expiration_date?: string;
  ready_to_eat?: boolean;
  notes?: string;
}) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  return await supabase
    .from('inventory_items')
    .update(updates)
    .eq('id', itemId)
    .eq('user_id', userId)
    .select()
    .single();
}

async function deleteInventoryItem(userId: string, itemId: string) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  return await supabase
    .from('inventory_items')
    .delete()
    .eq('id', itemId)
    .eq('user_id', userId);
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

async function createMealPlanEntry(userId: string, entry: {
  date: string;
  meal_type: string;
  meal_items?: { id: string; name: string }[];
}) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  return await supabase
    .from('meal_plans')
    .insert({
      user_id: userId,
      date: entry.date,
      meal_type: entry.meal_type,
      meal_items: entry.meal_items ?? [],
    })
    .select()
    .single();
}

async function updateMealPlanEntry(userId: string, entryId: string, updates: {
  date?: string;
  meal_type?: string;
  meal_items?: { id: string; name: string }[];
}) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  return await supabase
    .from('meal_plans')
    .update(updates)
    .eq('id', entryId)
    .eq('user_id', userId)
    .select()
    .single();
}

async function deleteMealPlanEntry(userId: string, entryId: string) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  return await supabase
    .from('meal_plans')
    .delete()
    .eq('id', entryId)
    .eq('user_id', userId);
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

async function createRecipe(userId: string, recipe: {
  meal_item_id: string;
  title?: string;
  recipe_type: string;
  content: string;
}) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  return await supabase
    .from('recipes')
    .insert({
      user_id: userId,
      meal_item_id: recipe.meal_item_id,
      title: recipe.title,
      recipe_type: recipe.recipe_type,
      content: recipe.content,
    })
    .select()
    .single();
}

async function updateRecipe(userId: string, recipeId: string, updates: {
  title?: string;
  recipe_type?: string;
  content?: string;
}) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  return await supabase
    .from('recipes')
    .update(updates)
    .eq('id', recipeId)
    .eq('user_id', userId)
    .select()
    .single();
}

async function deleteRecipe(userId: string, recipeId: string) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  return await supabase
    .from('recipes')
    .delete()
    .eq('id', recipeId)
    .eq('user_id', userId);
}

async function getMealItems(userId: string) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  return await supabase
    .from('meal_items')
    .select('*')
    .eq('user_id', userId)
    .order('name');
}

async function createMealItem(userId: string, item: {
  name: string;
  category?: string;
  notes?: string;
}) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  return await supabase
    .from('meal_items')
    .insert({
      user_id: userId,
      name: item.name,
      category: item.category,
      notes: item.notes,
    })
    .select()
    .single();
}

async function updateMealItem(userId: string, itemId: string, updates: {
  name?: string;
  category?: string;
  notes?: string;
}) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  return await supabase
    .from('meal_items')
    .update(updates)
    .eq('id', itemId)
    .eq('user_id', userId)
    .select()
    .single();
}

async function deleteMealItem(userId: string, itemId: string) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  return await supabase
    .from('meal_items')
    .delete()
    .eq('id', itemId)
    .eq('user_id', userId);
}

// ============================================
// REST API HANDLER
// ============================================

async function handleRestRequest(req: Request, url: URL, userId: string): Promise<Response> {
  const path = url.pathname.replace('/unified-api', '');
  const method = req.method;
  const pathParts = path.split('/').filter(Boolean);

  try {
    // ========== INVENTORY ==========
    // GET /inventory
    if (path === '/inventory' && method === 'GET') {
      const location = url.searchParams.get('location') || undefined;
      const { data, error } = await getInventory(userId, { location });
      
      if (error) throw error;
      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // POST /inventory
    if (path === '/inventory' && method === 'POST') {
      const body = await req.json();
      if (!body.name) {
        return new Response(JSON.stringify({ error: 'name is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const { data, error } = await createInventoryItem(userId, body);
      if (error) throw error;
      return new Response(JSON.stringify({ data }), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // PUT /inventory/:id
    if (pathParts[0] === 'inventory' && pathParts[1] && method === 'PUT') {
      const body = await req.json();
      const { data, error } = await updateInventoryItem(userId, pathParts[1], body);
      if (error) throw error;
      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // DELETE /inventory/:id
    if (pathParts[0] === 'inventory' && pathParts[1] && method === 'DELETE') {
      const { error } = await deleteInventoryItem(userId, pathParts[1]);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ========== MEAL PLAN ==========
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

    // POST /meal-plan
    if (path === '/meal-plan' && method === 'POST') {
      const body = await req.json();
      if (!body.date || !body.meal_type) {
        return new Response(JSON.stringify({ error: 'date and meal_type are required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const { data, error } = await createMealPlanEntry(userId, body);
      if (error) throw error;
      return new Response(JSON.stringify({ data }), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // PUT /meal-plan/:id
    if (pathParts[0] === 'meal-plan' && pathParts[1] && method === 'PUT') {
      const body = await req.json();
      const { data, error } = await updateMealPlanEntry(userId, pathParts[1], body);
      if (error) throw error;
      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // DELETE /meal-plan/:id
    if (pathParts[0] === 'meal-plan' && pathParts[1] && method === 'DELETE') {
      const { error } = await deleteMealPlanEntry(userId, pathParts[1]);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ========== RECIPES ==========
    // GET /recipes
    if (path === '/recipes' && method === 'GET') {
      const mealItemName = url.searchParams.get('meal_item') || undefined;
      const { data, error } = await getRecipes(userId, mealItemName);
      if (error) throw error;
      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // POST /recipes
    if (path === '/recipes' && method === 'POST') {
      const body = await req.json();
      if (!body.meal_item_id || !body.recipe_type || !body.content) {
        return new Response(JSON.stringify({ error: 'meal_item_id, recipe_type, and content are required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const { data, error } = await createRecipe(userId, body);
      if (error) throw error;
      return new Response(JSON.stringify({ data }), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // PUT /recipes/:id
    if (pathParts[0] === 'recipes' && pathParts[1] && method === 'PUT') {
      const body = await req.json();
      const { data, error } = await updateRecipe(userId, pathParts[1], body);
      if (error) throw error;
      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // DELETE /recipes/:id
    if (pathParts[0] === 'recipes' && pathParts[1] && method === 'DELETE') {
      const { error } = await deleteRecipe(userId, pathParts[1]);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ========== MEAL ITEMS ==========
    // GET /meal-items
    if (path === '/meal-items' && method === 'GET') {
      const { data, error } = await getMealItems(userId);
      if (error) throw error;
      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // POST /meal-items
    if (path === '/meal-items' && method === 'POST') {
      const body = await req.json();
      if (!body.name) {
        return new Response(JSON.stringify({ error: 'name is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const { data, error } = await createMealItem(userId, body);
      if (error) throw error;
      return new Response(JSON.stringify({ data }), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // PUT /meal-items/:id
    if (pathParts[0] === 'meal-items' && pathParts[1] && method === 'PUT') {
      const body = await req.json();
      const { data, error } = await updateMealItem(userId, pathParts[1], body);
      if (error) throw error;
      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // DELETE /meal-items/:id
    if (pathParts[0] === 'meal-items' && pathParts[1] && method === 'DELETE') {
      const { error } = await deleteMealItem(userId, pathParts[1]);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
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
