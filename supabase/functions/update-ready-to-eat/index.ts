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
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all items
    const { data: items, error: fetchError } = await supabase
      .from("inventory_items")
      .select("id, name");

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

    // Update each item
    let updatedCount = 0;
    for (const update of updates) {
      const { error } = await supabase
        .from("inventory_items")
        .update({ ready_to_eat: update.ready_to_eat })
        .eq("id", update.id);

      if (!error) updatedCount++;
    }

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
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
