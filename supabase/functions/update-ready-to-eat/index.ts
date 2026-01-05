import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Items that need cooking (not ready to eat)
const needsCooking = [
  'chicken', 'shrimp', 'salmon', 'burger', 'sausage',
  'eggs', 'parathas', 'spring rolls', 'pizza',
  'french toast', 'broccoli', 'green beans', 'mixed vegetables',
  'chips', 'lasagna', 'noodles', 'oats', 'quick oats',
  'potatoes', 'mushrooms', 'brussels sprouts', 'bell peppers',
  'soup', 'fondue', 'curry', 'breadcrumbs', 'ginger'
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Create a client with the user's JWT to validate authentication
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Validate the user's JWT and get their user ID
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    
    if (authError || !user) {
      console.error("Auth error:", authError?.message);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Processing update-ready-to-eat for user: ${user.id}`);

    // Use service role client for database operations, but filter by user_id
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get only items belonging to the authenticated user
    const { data: items, error: fetchError } = await supabase
      .from("inventory_items")
      .select("id, name")
      .eq("user_id", user.id);

    if (fetchError) throw fetchError;

    const updates: { id: string; name: string; ready_to_eat: boolean }[] = [];

    for (const item of items || []) {
      const nameLower = item.name.toLowerCase();
      const needsCook = needsCooking.some(keyword => nameLower.includes(keyword));
      
      updates.push({
        id: item.id,
        name: item.name,
        ready_to_eat: !needsCook,
      });
    }

    // Update each item (all belong to the authenticated user)
    let updatedCount = 0;
    for (const update of updates) {
      const { error } = await supabase
        .from("inventory_items")
        .update({ ready_to_eat: update.ready_to_eat })
        .eq("id", update.id)
        .eq("user_id", user.id); // Extra safety check

      if (!error) updatedCount++;
    }

    console.log(`Updated ${updatedCount} items for user ${user.id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        updated: updatedCount,
        details: updates.map(u => ({ name: u.name, ready_to_eat: u.ready_to_eat }))
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "An error occurred processing your request" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
