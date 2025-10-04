import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, weekStartDate, userId } = await req.json();
    console.log('Chat request:', { userId, weekStartDate, messageCount: messages.length });

    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
      }
    ];

    // Build system prompt with meal plan context
    const systemPrompt = `You are a helpful meal planning assistant. You help users plan their weekly meals by adding, removing, and suggesting meal items.

Current Week's Meal Plan:
${mealPlanContext}

When the user asks you to add or modify meals, use the appropriate tool to make the changes. Be conversational and helpful. Confirm actions after making changes.

Available meal types: Breakfast, Lunch, Dinner, School Snacks, Prep (and any custom types the user has added).

Guidelines:
- Be proactive in suggesting meals when asked
- Confirm changes after making them
- If a meal already exists, ask if they want to replace or add to it
- Suggest variety across the week
- Be concise but friendly`;

    // Call OpenAI API with streaming
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        tools,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    // Handle streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        const decoder = new TextDecoder();
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || trimmed === 'data: [DONE]') continue;
              if (!trimmed.startsWith('data: ')) continue;

              try {
                const jsonStr = trimmed.slice(6);
                const parsed = JSON.parse(jsonStr);

                // Handle tool calls
                if (parsed.choices?.[0]?.delta?.tool_calls) {
                  const toolCalls = parsed.choices[0].delta.tool_calls;
                  for (const toolCall of toolCalls) {
                    if (toolCall.function?.name) {
                      console.log('Tool call:', toolCall.function.name, toolCall.function.arguments);
                      
                      // Execute tool call
                      const result = await executeToolCall(
                        toolCall.function.name,
                        JSON.parse(toolCall.function.arguments || '{}'),
                        userId,
                        weekStartDate,
                        supabase
                      );

                      // Send tool result back to stream
                      controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify({
                          type: 'tool_result',
                          tool: toolCall.function.name,
                          result
                        })}\n\n`)
                      );
                    }
                  }
                }

                // Forward content delta
                if (parsed.choices?.[0]?.delta?.content) {
                  controller.enqueue(encoder.encode(`data: ${jsonStr}\n\n`));
                }
              } catch (e) {
                console.error('Error parsing SSE line:', e, trimmed);
              }
            }
          }
        } catch (error) {
          console.error('Stream error:', error);
        } finally {
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

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
  supabase: any
): Promise<any> {
  console.log('Executing tool:', toolName, args);

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

    case 'get_meal_plan': {
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

    case 'suggest_meals': {
      // This is handled by the AI itself, just acknowledge
      return {
        success: true,
        message: 'I can help you with meal suggestions!'
      };
    }

    default:
      return { success: false, error: 'Unknown tool' };
  }
}
