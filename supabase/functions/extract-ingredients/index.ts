import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MealItem {
  text: string;
  count?: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { mealItems } = await req.json();
    console.log('Processing meal items:', mealItems);

    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    if (!mealItems || !Array.isArray(mealItems) || mealItems.length === 0) {
      return new Response(JSON.stringify({ ingredients: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create a prompt to extract ingredients from meal items
    const mealList = mealItems.map((item: MealItem) => item.text).join(', ');
    const prompt = `Given this list of meals: "${mealList}"

For each meal, provide the key grocery ingredients needed to make it. Return ONLY a JSON array of ingredient objects with this exact format:
[
  {"name": "ingredient name", "quantity": "amount with unit", "category": "produce|meat|dairy|pantry|spices|frozen", "forDishes": ["dish1", "dish2"]},
  ...
]

Rules:
- Include only essential ingredients, not basic pantry items like salt, pepper, oil unless they're specialty items
- Use realistic quantities for a typical household
- Categorize ingredients properly
- If a meal mentions "out" or restaurant names, skip it
- For each ingredient, list ALL the dishes that need it in the "forDishes" array
- Combine similar ingredients and show which dishes use them
- Keep ingredient names simple and common grocery store terms
- Keep dish names short and clear in the forDishes array`;

    console.log('Sending request to OpenAI...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          { 
            role: 'system', 
            content: 'You are a helpful cooking assistant that extracts grocery ingredients from meal plans. Always respond with valid JSON only.' 
          },
          { role: 'user', content: prompt }
        ],
        max_tokens: 1500,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('OpenAI response received');
    
    const generatedContent = data.choices[0].message.content;
    console.log('Generated content:', generatedContent);

    // Parse the JSON response
    let ingredients = [];
    try {
      // Clean the response to extract JSON
      const jsonMatch = generatedContent.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        ingredients = JSON.parse(jsonMatch[0]);
      } else {
        console.warn('Could not extract JSON from response:', generatedContent);
        ingredients = [];
      }
    } catch (parseError) {
      console.error('Error parsing ingredients JSON:', parseError);
      console.error('Raw content:', generatedContent);
      ingredients = [];
    }

    console.log('Extracted ingredients:', ingredients);

    return new Response(JSON.stringify({ ingredients }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in extract-ingredients function:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      ingredients: [] 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});