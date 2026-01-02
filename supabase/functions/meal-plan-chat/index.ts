import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  computeExpirationOverrideFromUserText,
  normalizeExpirationDateInput,
} from "./expirationDate.ts";

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Extract JWT from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const jwt = authHeader.replace('Bearer ', '');
    
    // Create Supabase client with user's JWT (enforces RLS)
    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: {
        headers: { Authorization: authHeader }
      }
    });

    // Get authenticated user from JWT
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;
    const { messages, weekStartDate, clientToday, clientTzOffsetMinutes } = await req.json();
    console.log('Chat request:', { userId, weekStartDate, messageCount: messages.length, clientToday, clientTzOffsetMinutes });

    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    // Get current meal plan from database
    const startDate = weekStartDate;
    const endDate = new Date(new Date(weekStartDate).getTime() + 6 * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0];

    const { data: mealPlans, error: mealPlanError } = await supabase
      .from('meal_plans')
      .select('*')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate);

    if (mealPlanError) {
      console.error('Error fetching meal plan:', mealPlanError);
      throw mealPlanError;
    }

    // Format meal plan for context
    const mealPlanContext = formatMealPlanContext(mealPlans || [], weekStartDate);

    // Define tools for meal plan operations
    const tools = [
      {
        type: "function",
        function: {
          name: "add_meal_item",
          description: "Add a meal item to a specific day and meal type",
          parameters: {
            type: "object",
            properties: {
              day: {
                type: "string",
                enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
                description: "The day of the week"
              },
              mealType: {
                type: "string",
                description: "The meal type (e.g., Breakfast, Lunch, Dinner, School Snacks, Prep)"
              },
              itemName: {
                type: "string",
                description: "The name of the meal item to add"
              }
            },
            required: ["day", "mealType", "itemName"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "remove_meal_item",
          description: "Remove a meal item from a specific day and meal type",
          parameters: {
            type: "object",
            properties: {
              day: {
                type: "string",
                enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
              },
              mealType: {
                type: "string",
                description: "The meal type"
              },
              itemName: {
                type: "string",
                description: "The name of the meal item to remove"
              }
            },
            required: ["day", "mealType", "itemName"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_meal_plan",
          description: "Get the current week's meal plan",
          parameters: {
            type: "object",
            properties: {}
          }
        }
      },
      {
        type: "function",
        function: {
          name: "suggest_meals",
          description: "Suggest meal ideas based on preferences or dietary needs",
          parameters: {
            type: "object",
            properties: {
              mealType: {
                type: "string",
                description: "The meal type to suggest for (optional)"
              },
              dietaryPreferences: {
                type: "string",
                description: "Any dietary preferences or restrictions (optional)"
              }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_meal_items",
          description: "Get all meal items from the inventory",
          parameters: {
            type: "object",
            properties: {}
          }
        }
      },
      {
        type: "function",
        function: {
          name: "add_to_inventory",
          description: "Add a new meal item to the inventory, optionally with a recipe (URL or instructions)",
          parameters: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: "Name of the meal item"
              },
              category: {
                type: "string",
                description: "Category (e.g., breakfast, lunch, dinner, snack)"
              },
              recipeType: {
                type: "string",
                description: "Type of recipe: 'url' for a recipe URL, or 'instructions' for recipe text (optional)",
                enum: ["url", "instructions"]
              },
              recipeTitle: {
                type: "string",
                description: "Recipe title (optional)"
              },
              recipeContent: {
                type: "string",
                description: "Recipe URL or instructions text (optional)"
              }
            },
            required: ["name"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_recipes",
          description: "Get recipes, optionally filtered by meal item",
          parameters: {
            type: "object",
            properties: {
              mealItemName: {
                type: "string",
                description: "Filter recipes by meal item name (optional)"
              }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "create_recipe",
          description: "Create a new recipe for a meal item",
          parameters: {
            type: "object",
            properties: {
              mealItemId: {
                type: "string",
                description: "ID of the meal item"
              },
              title: {
                type: "string",
                description: "Recipe title"
              },
              content: {
                type: "string",
                description: "Recipe instructions and ingredients"
              },
              recipeType: {
                type: "string",
                description: "Type of recipe (e.g., main, side, dessert)"
              }
            },
            required: ["mealItemId", "content", "recipeType"]
          }
        }
      },
      // Kitchen Inventory Tools
      {
        type: "function",
        function: {
          name: "get_kitchen_inventory",
          description: "Get all items in the kitchen inventory (fridge, freezer, pantry)",
          parameters: {
            type: "object",
            properties: {
              location: {
                type: "string",
                enum: ["fridge", "freezer", "pantry"],
                description: "Filter by location (optional)"
              }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "add_kitchen_inventory_item",
          description: "Add a new item to the kitchen inventory (fridge, freezer, or pantry). If location is not specified, use common sense defaults based on the item type. For expiration dates, ALWAYS compute an actual YYYY-MM-DD date based on TODAY'S DATE from the system prompt (client local date).",
          parameters: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: "Name of the item (e.g., milk, chicken breast, rice)"
              },
              quantity: {
                type: "number",
                description: "Quantity of the item (default: 1)"
              },
              unit: {
                type: "string",
                description: "Unit of measurement (e.g., lbs, oz, items, gallons)"
              },
              location: {
                type: "string",
                enum: ["fridge", "freezer", "pantry"],
                description: "Where the item is stored. Use common sense if not specified: perishables like milk, eggs, meat, cheese go in fridge; frozen items go in freezer; dry goods like rice, pasta, canned goods, spices go in pantry."
              },
              expiration_date: {
                type: "string",
                description: "Expiration date in YYYY-MM-DD format (optional). IMPORTANT: Convert relative phrases using TODAY'S DATE in the system prompt (client local date). Examples: 'in 2 days' = TODAY + 2 days; 'tomorrow' = TODAY + 1 day; 'next week' = TODAY + 7 days; '1/10' without year = current year (or next year if already passed)."
              },
              notes: {
                type: "string",
                description: "Optional notes about the item"
              }
            },
            required: ["name"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "update_kitchen_inventory_item",
          description: "Update an existing kitchen inventory item (change quantity, location, expiration, etc.)",
          parameters: {
            type: "object",
            properties: {
              itemName: {
                type: "string",
                description: "Name of the item to update"
              },
              quantity: {
                type: "number",
                description: "New quantity"
              },
              unit: {
                type: "string",
                description: "New unit"
              },
              location: {
                type: "string",
                enum: ["fridge", "freezer", "pantry"],
                description: "New location"
              },
              expiration_date: {
                type: "string",
                description: "New expiration date in YYYY-MM-DD format"
              },
              notes: {
                type: "string",
                description: "New notes"
              }
            },
            required: ["itemName"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "delete_kitchen_inventory_item",
          description: "Remove an item from the kitchen inventory",
          parameters: {
            type: "object",
            properties: {
              itemName: {
                type: "string",
                description: "Name of the item to delete"
              }
            },
            required: ["itemName"]
          }
        }
      }
    ];

    const isYyyyMmDd = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

    // Use client-local "today" when provided; fall back to UTC date otherwise.
    const today = isYyyyMmDd(clientToday) ? clientToday : new Date().toISOString().split('T')[0];

    // Build system prompt with meal plan context
    const systemPrompt = `You are a helpful kitchen and meal planning assistant. You help users plan their weekly meals, manage their kitchen inventory (fridge, freezer, pantry), and organize recipes.

TODAY'S DATE (client local): ${today}

Current Week's Meal Plan:
${mealPlanContext}

When the user asks you to add or modify meals, use the appropriate tool to make the changes. Be conversational and helpful. Confirm actions after making changes.

Available meal types: Breakfast, Lunch, Dinner, School Snacks, Prep (and any custom types the user has added).

Capabilities:
- Add/remove meals from the weekly plan
- View and suggest meals
- Manage meal inventory (view items, add new items with recipes)
- Access and create recipes for meal items
- Kitchen Inventory: Track items in fridge, freezer, and pantry with quantities, units, and expiration dates

Kitchen Inventory Guidelines:
- When adding items without a specified location, use common sense defaults:
  * FRIDGE: milk, eggs, cheese, yogurt, butter, fresh meat, deli meats, fresh vegetables, fresh fruits, juice, condiments, leftovers
  * FREEZER: frozen meals, ice cream, frozen vegetables, frozen fruits, raw meat for long storage, bread (if freezing)
  * PANTRY: rice, pasta, canned goods, cereals, flour, sugar, oil, spices, crackers, chips, nuts, dried beans, coffee, tea
- Users can move items to different locations later using the update tool
- Alert users about items that are expired or expiring soon
- Suggest using items that are about to expire
- Help users find what they have in stock

CRITICAL - Expiration Date Handling:
- ALWAYS compute expiration dates as YYYY-MM-DD format before calling tools
- Use TODAY'S DATE (${today}) for all relative calculations
- "in 2 days" → add 2 days to TODAY'S DATE → compute actual date
- "in a week" → add 7 days to TODAY'S DATE
- "tomorrow" → add 1 day to TODAY'S DATE
- "1/10" or "January 10" without year → use current year (or next year if that date already passed)
- NEVER pass relative phrases like "in 2 days" to the tool - always convert to YYYY-MM-DD first

Guidelines:
- Be proactive in suggesting meals when asked
- Confirm changes after making them (mention the location you chose if user didn't specify)
- If a meal already exists, ask if they want to replace or add to it
- Suggest variety across the week
- Help organize their meal inventory
- Be concise but friendly`;

    // Call OpenAI API without streaming
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        tools,
        stream: false,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limits exceeded, please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required, please add funds to your Lovable AI workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: 'AI gateway error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const completion = await response.json();
    
    // Validate response structure
    if (!completion.choices || completion.choices.length === 0) {
      console.error('Invalid AI response:', completion);
      return new Response(
        JSON.stringify({ content: "I'm having trouble responding right now. Please try again.", mealPlanUpdated: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const assistantMessage = completion.choices[0].message;
    let mealPlanUpdated = false;
    let inventoryUpdated = false;

    // Handle tool calls if present
    if (assistantMessage.tool_calls) {
      const toolResponses = [];
      const lastUserText = [...messages].reverse().find((m: any) => m?.role === 'user')?.content ?? '';

      for (const toolCall of assistantMessage.tool_calls) {
        console.log('Executing tool:', toolCall.function.name, toolCall.function.arguments);

        const result = await executeToolCall(
          toolCall.function.name,
          JSON.parse(toolCall.function.arguments),
          userId,
          weekStartDate,
          supabase,
          { today, lastUserText }
        );

        // Only trigger reload for tools that actually modify the meal plan
        if (result.success && (
          toolCall.function.name === 'add_meal_item' || 
          toolCall.function.name === 'remove_meal_item'
        )) {
          mealPlanUpdated = true;
        }

        // Check if inventory was updated
        if (result.success && result.inventoryUpdated) {
          inventoryUpdated = true;
        }

        // Add tool response message (required by OpenAI)
        toolResponses.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result)
        });
      }

      // Get a follow-up response from AI with proper tool responses
      const followUpResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages,
            assistantMessage,
            ...toolResponses
          ],
          stream: false,
        }),
      });
      if (!followUpResponse.ok) {
        if (followUpResponse.status === 429) {
          return new Response(
            JSON.stringify({ error: 'Rate limits exceeded, please try again later.' }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        if (followUpResponse.status === 402) {
          return new Response(
            JSON.stringify({ error: 'Payment required, please add funds to your Lovable AI workspace.' }),
            { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        const t = await followUpResponse.text();
        console.error('AI gateway follow-up error:', followUpResponse.status, t);
        return new Response(
          JSON.stringify({ content: "I'm having trouble confirming the action. The change was applied though.", mealPlanUpdated, inventoryUpdated }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const followUpCompletion = await followUpResponse.json();
      
      // Validate follow-up response
      if (!followUpCompletion.choices || followUpCompletion.choices.length === 0) {
        console.error('Invalid follow-up response:', followUpCompletion);
        throw new Error('Invalid follow-up response from AI');
      }
      
      const content = followUpCompletion.choices[0].message.content;

      console.log('Returning response with mealPlanUpdated:', mealPlanUpdated, 'inventoryUpdated:', inventoryUpdated);

      return new Response(
        JSON.stringify({ content, mealPlanUpdated, inventoryUpdated }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Return regular response if no tools were called
    console.log('Returning response (no tools) with mealPlanUpdated:', mealPlanUpdated);
    
    return new Response(
      JSON.stringify({ 
        content: assistantMessage.content,
        mealPlanUpdated,
        inventoryUpdated
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Chat error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function formatMealPlanContext(mealPlans: any[], weekStartDate: string): string {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const planByDay: { [key: string]: { [mealType: string]: string[] } } = {};

  // Initialize structure
  days.forEach(day => {
    planByDay[day] = {};
  });

  // Calculate week dates
  const weekStart = new Date(weekStartDate);
  
  // Fill in meal plans
  mealPlans.forEach(plan => {
    const planDate = new Date(plan.date);
    const daysDiff = Math.floor((planDate.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff >= 0 && daysDiff < 7) {
      const day = days[daysDiff];
      const mealItems = (plan.meal_items as any[] || []).map((item: any) => item.text);
      
      if (!planByDay[day][plan.meal_type]) {
        planByDay[day][plan.meal_type] = [];
      }
      planByDay[day][plan.meal_type].push(...mealItems);
    }
  });

  // Format as text
  let context = '';
  days.forEach(day => {
    context += `\n${day}:\n`;
    const meals = planByDay[day];
    if (Object.keys(meals).length === 0) {
      context += '  (no meals planned)\n';
    } else {
      Object.entries(meals).forEach(([mealType, items]) => {
        if (items.length > 0) {
          context += `  ${mealType}: ${items.join(', ')}\n`;
        }
      });
    }
  });

  return context;
}

async function executeToolCall(
  toolName: string,
  args: any,
  userId: string,
  weekStartDate: string,
  supabase: any,
  context?: { today: string; lastUserText: string }
): Promise<any> {
  console.log('Executing tool:', toolName, args);

  // Handle suggest_meals separately (no day required)
  if (toolName === 'suggest_meals') {
    return {
      success: true,
      message: 'I can help you with meal suggestions!'
    };
  }

  // Handle get_meal_plan separately (no day required)
  if (toolName === 'get_meal_plan') {
    const startDate = weekStartDate;
    const endDate = new Date(new Date(weekStartDate).getTime() + 6 * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0];

    const { data: mealPlans } = await supabase
      .from('meal_plans')
      .select('*')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate);

    return {
      success: true,
      mealPlan: formatMealPlanContext(mealPlans || [], weekStartDate)
    };
  }

  // Handle get_meal_items
  if (toolName === 'get_meal_items') {
    const { data: mealItems, error } = await supabase
      .from('meal_items')
      .select('id, name, category, image_url')
      .eq('user_id', userId)
      .order('name');

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      items: mealItems || [],
      message: `Found ${mealItems?.length || 0} meal items in inventory`
    };
  }

  // Handle add_to_inventory
  if (toolName === 'add_to_inventory') {
    const { data: mealItem, error } = await supabase
      .from('meal_items')
      .insert({
        user_id: userId,
        name: args.name,
        category: args.category || null
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    // If recipe information is provided, create the recipe
    if (args.recipeContent && args.recipeType) {
      const { error: recipeError } = await supabase
        .from('recipes')
        .insert({
          user_id: userId,
          meal_item_id: mealItem.id,
          title: args.recipeTitle || null,
          content: args.recipeContent,
          recipe_type: args.recipeType
        });

      if (recipeError) {
        return { 
          success: true, 
          item: mealItem,
          message: `Added "${args.name}" to inventory, but failed to add recipe: ${recipeError.message}`
        };
      }

      return {
        success: true,
        item: mealItem,
        message: `Added "${args.name}" to inventory with recipe`
      };
    }

    return {
      success: true,
      item: mealItem,
      message: `Added "${args.name}" to inventory`
    };
  }

  // Handle get_recipes
  if (toolName === 'get_recipes') {
    let query = supabase
      .from('recipes')
      .select('id, title, content, recipe_type, meal_item_id, meal_items(name)')
      .eq('user_id', userId);

    // If filtering by meal item name
    if (args.mealItemName) {
      const { data: mealItem } = await supabase
        .from('meal_items')
        .select('id')
        .eq('user_id', userId)
        .ilike('name', args.mealItemName)
        .single();

      if (mealItem) {
        query = query.eq('meal_item_id', mealItem.id);
      }
    }

    const { data: recipes, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      recipes: recipes || [],
      message: `Found ${recipes?.length || 0} recipes`
    };
  }

  // Handle create_recipe
  if (toolName === 'create_recipe') {
    const { data, error } = await supabase
      .from('recipes')
      .insert({
        user_id: userId,
        meal_item_id: args.mealItemId,
        title: args.title || null,
        content: args.content,
        recipe_type: args.recipeType
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      recipe: data,
      message: `Created recipe "${args.title || 'Untitled'}"`
    };
  }

  // Handle kitchen inventory tools
  if (toolName === 'get_kitchen_inventory') {
    let query = supabase
      .from('inventory_items')
      .select('*')
      .eq('user_id', userId)
      .order('name');

    if (args.location) {
      query = query.eq('location', args.location);
    }

    const { data: items, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    // Format items for AI context
    const formattedItems = (items || []).map((item: any) => ({
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      location: item.location,
      expiration_date: item.expiration_date,
      notes: item.notes
    }));

    return {
      success: true,
      items: formattedItems,
      message: `Found ${items?.length || 0} items in kitchen inventory`
    };
  }

  if (toolName === 'add_kitchen_inventory_item') {
    // Infer location if not provided using common sense defaults
    let location = args.location;
    if (!location) {
      const nameLower = args.name.toLowerCase();
      
      // Freezer items
      const freezerItems = ['ice cream', 'frozen', 'ice'];
      if (freezerItems.some(item => nameLower.includes(item))) {
        location = 'freezer';
      }
      // Pantry items (dry goods, canned, etc.)
      else if (['rice', 'pasta', 'flour', 'sugar', 'salt', 'pepper', 'spice', 'cereal', 'oat', 'can', 'canned', 
                'oil', 'vinegar', 'honey', 'syrup', 'peanut butter', 'jam', 'jelly', 'bread', 'cracker', 
                'chip', 'cookie', 'nut', 'dried', 'bean', 'lentil', 'coffee', 'tea', 'cocoa', 'baking',
                'sauce', 'broth', 'stock'].some(item => nameLower.includes(item))) {
        location = 'pantry';
      }
      // Default to fridge for perishables (most common case)
      else {
        location = 'fridge';
      }
    }

    // Expiration date:
    // - If the user used a relative phrase (e.g. "expiring in 2 days"), compute it deterministically from TODAY (client local).
    // - Then normalize to YYYY-MM-DD.
    const todayForCalc = context?.today;
    const lastUserText = context?.lastUserText || '';
    const overrideExpiration = todayForCalc ? computeExpirationOverrideFromUserText(lastUserText, todayForCalc) : null;

    if (overrideExpiration) {
      console.log('Overriding expiration_date from user text:', {
        overrideExpiration,
        original: args.expiration_date,
        today: todayForCalc,
      });
    }

    const expirationDate = (() => {
      const raw = (overrideExpiration ?? args.expiration_date) as string | undefined;
      if (!raw) return null;
      return normalizeExpirationDateInput(raw);
    })();

    const { data: newItem, error } = await supabase
      .from('inventory_items')
      .insert({
        user_id: userId,
        name: args.name,
        quantity: args.quantity || 1,
        unit: args.unit || null,
        location: location,
        expiration_date: expirationDate,
        notes: args.notes || null
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      item: newItem,
      inventoryUpdated: true,
      message: `Added "${args.name}" to ${location}${!args.location ? ' (auto-assigned)' : ''}`
    };
  }

  if (toolName === 'update_kitchen_inventory_item') {
    // First find the item by name
    const { data: existingItem } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('user_id', userId)
      .ilike('name', args.itemName)
      .maybeSingle();

    if (!existingItem) {
      return { success: false, error: `Item "${args.itemName}" not found in inventory` };
    }

    const updates: any = {};
    if (args.quantity !== undefined) updates.quantity = args.quantity;
    if (args.unit !== undefined) updates.unit = args.unit;
    if (args.location !== undefined) updates.location = args.location;

    if (args.expiration_date !== undefined) {
      const todayForCalc = context?.today;
      const lastUserText = context?.lastUserText || '';
      const overrideExpiration = todayForCalc ? computeExpirationOverrideFromUserText(lastUserText, todayForCalc) : null;
      const raw = (overrideExpiration ?? args.expiration_date) as string | undefined;
      updates.expiration_date = raw ? normalizeExpirationDateInput(raw) : null;

      if (overrideExpiration) {
        console.log('Overriding expiration_date from user text (update):', {
          overrideExpiration,
          original: args.expiration_date,
          today: todayForCalc,
        });
      }
    }

    if (args.notes !== undefined) updates.notes = args.notes;

    const { error } = await supabase
      .from('inventory_items')
      .update(updates)
      .eq('id', existingItem.id);

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      inventoryUpdated: true,
      message: `Updated "${args.itemName}" in inventory`
    };
  }

  if (toolName === 'delete_kitchen_inventory_item') {
    // First find the item by name
    const { data: existingItem } = await supabase
      .from('inventory_items')
      .select('id')
      .eq('user_id', userId)
      .ilike('name', args.itemName)
      .maybeSingle();

    if (!existingItem) {
      return { success: false, error: `Item "${args.itemName}" not found in inventory` };
    }

    const { error } = await supabase
      .from('inventory_items')
      .delete()
      .eq('id', existingItem.id);

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      inventoryUpdated: true,
      message: `Removed "${args.itemName}" from inventory`
    };
  }

  // For add_meal_item and remove_meal_item, validate day
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const dayIndex = days.indexOf(args.day);
  if (dayIndex === -1) {
    return { success: false, error: 'Invalid day' };
  }

  const date = new Date(weekStartDate);
  date.setDate(date.getDate() + dayIndex);
  const dateString = date.toISOString().split('T')[0];

  switch (toolName) {
    case 'add_meal_item': {
      // Get existing meal plan for this day/meal type
      const { data: existing } = await supabase
        .from('meal_plans')
        .select('*')
        .eq('user_id', userId)
        .eq('date', dateString)
        .eq('meal_type', args.mealType)
        .maybeSingle();

      const newItem = {
        id: `${Date.now()}-${Math.random()}`,
        text: args.itemName
      };

      const updatedItems = existing?.meal_items
        ? [...(existing.meal_items as any[]), newItem]
        : [newItem];

      // Upsert the meal plan
      const { error } = await supabase
        .from('meal_plans')
        .upsert({
          user_id: userId,
          date: dateString,
          meal_type: args.mealType,
          meal_items: updatedItems
        }, {
          onConflict: 'user_id,date,meal_type'
        });

      if (error) {
        console.error('Error adding meal item:', error);
        return { success: false, error: error.message };
      }

      return { success: true, message: `Added "${args.itemName}" to ${args.day} ${args.mealType}` };
    }

    case 'remove_meal_item': {
      // Get existing meal plan
      const { data: existing } = await supabase
        .from('meal_plans')
        .select('*')
        .eq('user_id', userId)
        .eq('date', dateString)
        .eq('meal_type', args.mealType)
        .maybeSingle();

      if (!existing || !existing.meal_items) {
        return { success: false, error: 'No meal items found to remove' };
      }

      const updatedItems = (existing.meal_items as any[]).filter(
        (item: any) => item.text.toLowerCase() !== args.itemName.toLowerCase()
      );

      const { error } = await supabase
        .from('meal_plans')
        .update({ meal_items: updatedItems })
        .eq('user_id', userId)
        .eq('date', dateString)
        .eq('meal_type', args.mealType);

      if (error) {
        console.error('Error removing meal item:', error);
        return { success: false, error: error.message };
      }

      return { success: true, message: `Removed "${args.itemName}" from ${args.day} ${args.mealType}` };
    }

    default:
      return { success: false, error: 'Unknown tool' };
  }
}
