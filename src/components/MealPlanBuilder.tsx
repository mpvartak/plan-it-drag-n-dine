import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, UtensilsCrossed, Settings, ChevronDown, ChevronUp, Cloud, X, ChevronLeft, ChevronRight, Copy, Printer, Calendar, ChefHat, ShoppingCart } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { MealCell } from './MealCell';
import { MealItemInventory } from './MealItemInventory';
import { CopyWeekModal } from './CopyWeekModal';
import { ChatInterface } from './ChatInterface';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { useMealPlanChat } from '@/hooks/useMealPlanChat';
export interface MealItem {
  id: string;
  text: string;
  isRecipe?: boolean;
  recipeId?: string;
  meal_item_id?: string;
  image_url?: string;
}
export interface MealPlan {
  [day: string]: {
    [mealType: string]: MealItem[];
  };
}
const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DEFAULT_MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'School Snacks', 'Prep'];

// Helper function to get ordered days based on first day of week
const getOrderedDays = (firstDayOfWeek: string) => {
  const startIndex = ALL_DAYS.indexOf(firstDayOfWeek);
  return [...ALL_DAYS.slice(startIndex), ...ALL_DAYS.slice(0, startIndex)];
};
interface WeatherData {
  temp: number;
  condition: string;
  icon: string;
}
interface DayNotes {
  [day: string]: string;
}
interface MealPlanBuilderProps {
  showRecipeInventory: boolean;
  setShowRecipeInventory: (show: boolean) => void;
  showChat: boolean;
  setShowChat: (show: boolean) => void;
}

export const MealPlanBuilder = ({ 
  showRecipeInventory, 
  setShowRecipeInventory,
  showChat,
  setShowChat
}: MealPlanBuilderProps) => {
  console.log('MealPlanBuilder component loaded');
  const {
    user
  } = useAuth();
  const {
    toast
  } = useToast();
  const isMobile = useIsMobile();

  // Load settings from localStorage (non-critical settings can stay local)
  const [firstDayOfWeek, setFirstDayOfWeek] = useState<string>(() => {
    return localStorage.getItem('mealPlan_firstDayOfWeek') || 'Monday';
  });

  const [mealPlans, setMealPlans] = useState<{
    [weekKey: string]: MealPlan;
  }>({});
  const [isLoading, setIsLoading] = useState(true);
  const calculateWeekStart = (date: Date, firstDay: string) => {
    const today = new Date(date);
    const firstDayIndex = ALL_DAYS.indexOf(firstDay);
    const todayDayIndex = (today.getDay() + 6) % 7; // Convert Sunday=0 to Monday=0 format

    // Calculate days since the most recent occurrence of firstDay (including today if it matches)
    let daysSinceFirstDay = (todayDayIndex - firstDayIndex + 7) % 7;
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - daysSinceFirstDay);
    weekStart.setHours(0, 0, 0, 0); // Ensure clean date
    return weekStart;
  };
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const calculated = calculateWeekStart(new Date(), firstDayOfWeek);
    console.log('🔄 Initial week calculation:', {
      today: new Date().toISOString().split('T')[0],
      firstDayOfWeek,
      calculatedWeekStart: calculated.toISOString().split('T')[0],
      todayDayOfWeek: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()]
    });
    return calculated;
  });

  // Get current week key for localStorage
  const getWeekKey = (weekStart: Date) => {
    return weekStart.toISOString().split('T')[0]; // YYYY-MM-DD format
  };
  const currentWeekKey = getWeekKey(currentWeekStart);
  const orderedDays = getOrderedDays(firstDayOfWeek);

  // Get current meal plan for the week
  const [mealPlan, setMealPlan] = useState<MealPlan>(() => {
    const weekKey = getWeekKey(currentWeekStart);
    if (mealPlans[weekKey]) {
      return mealPlans[weekKey];
    }
    const plan: MealPlan = {};
    ALL_DAYS.forEach(day => {
      plan[day] = {};
      DEFAULT_MEAL_TYPES.forEach(mealType => {
        plan[day][mealType] = [];
      });
    });
    return plan;
  });
  const [customMealTypes, setCustomMealTypes] = useState<string[]>(() => {
    const stored = localStorage.getItem('mealPlan_customMealTypes');
    return stored ? JSON.parse(stored) : [];
  });
  const [newMealType, setNewMealType] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [zipCode, setZipCode] = useState(() => {
    return localStorage.getItem('mealPlan_zipCode') || '';
  });
  const [weather, setWeather] = useState<{
    [day: string]: WeatherData;
  }>({});
  const [dayNotes, setDayNotes] = useState<DayNotes>({});
  const [notesOpen, setNotesOpen] = useState<{
    [day: string]: boolean;
  }>({});
  const [showCopyWeekModal, setShowCopyWeekModal] = useState(false);
  const [checkedItems, setCheckedItems] = useState<{
    [key: string]: boolean;
  }>({});
  const [aiGeneratedIngredients, setAiGeneratedIngredients] = useState<any[]>([]);
  const [isGeneratingIngredients, setIsGeneratingIngredients] = useState(false);
  const [removedIngredients, setRemovedIngredients] = useState<Set<string>>(new Set());
  const [savedGroceryListId, setSavedGroceryListId] = useState<string | null>(null);
  const [isSavingGroceryList, setIsSavingGroceryList] = useState(false);
  const [manualMealItems, setManualMealItems] = useState<Array<{ text: string; count: number }>>([]);
  const [manualGroceryItems, setManualGroceryItems] = useState<Array<{ name: string; quantity?: string; category: string }>>([]);
  const [newMealItem, setNewMealItem] = useState('');
  const [newGroceryItem, setNewGroceryItem] = useState('');
  const [newGroceryCategory, setNewGroceryCategory] = useState('other');
  const [shouldReloadMealPlans, setShouldReloadMealPlans] = useState(0);
  
  const handleAddToInventory = (itemName: string, mealType: string) => {
    // This will be handled by the MealItemInventory component via a custom event
    window.dispatchEvent(new CustomEvent('addToInventory', {
      detail: {
        itemName,
        mealType
      }
    }));
  };

  // Listen for changes to localStorage (when settings are updated from Settings page)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'mealPlan_firstDayOfWeek' && e.newValue) {
        setFirstDayOfWeek(e.newValue);
      }
      if (e.key === 'mealPlan_customMealTypes' && e.newValue) {
        try {
          setCustomMealTypes(JSON.parse(e.newValue));
        } catch (error) {
          console.error('Failed to parse custom meal types from localStorage:', error);
        }
      }
      if (e.key === 'mealPlan_zipCode' && e.newValue !== null) {
        setZipCode(e.newValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Also check for changes when component gains focus (when navigating back from settings)
    const handleFocus = () => {
      const storedFirstDay = localStorage.getItem('mealPlan_firstDayOfWeek') || 'Monday';
      const storedCustomMealTypes = localStorage.getItem('mealPlan_customMealTypes');
      const storedZipCode = localStorage.getItem('mealPlan_zipCode') || '';
      
      if (storedFirstDay !== firstDayOfWeek) {
        setFirstDayOfWeek(storedFirstDay);
      }
      if (storedCustomMealTypes) {
        try {
          const parsedTypes = JSON.parse(storedCustomMealTypes);
          if (JSON.stringify(parsedTypes) !== JSON.stringify(customMealTypes)) {
            setCustomMealTypes(parsedTypes);
          }
        } catch (error) {
          console.error('Failed to parse custom meal types:', error);
        }
      }
      if (storedZipCode !== zipCode) {
        setZipCode(storedZipCode);
      }
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [firstDayOfWeek, customMealTypes, zipCode]);
  const allMealTypes = [...DEFAULT_MEAL_TYPES, ...customMealTypes];

  // Aggregate grocery items from current meal plan
  const groceryList = useMemo(() => {
    const itemCounts: {
      [key: string]: number;
    } = {};

    // Collect all items from current week's meal plan
    orderedDays.forEach(day => {
      allMealTypes.forEach(mealType => {
        const items = mealPlan[day]?.[mealType] || [];
        items.forEach(item => {
          const normalizedText = item.text.toLowerCase().trim();
          itemCounts[normalizedText] = (itemCounts[normalizedText] || 0) + 1;
        });
      });
    });

    // Add manually added meal items
    manualMealItems.forEach(item => {
      const normalizedText = item.text.toLowerCase().trim();
      itemCounts[normalizedText] = (itemCounts[normalizedText] || 0) + item.count;
    });

    // Convert to array and sort alphabetically
    return Object.entries(itemCounts).map(([text, count]) => ({
      text: text.charAt(0).toUpperCase() + text.slice(1),
      // Capitalize first letter
      count
    })).sort((a, b) => a.text.localeCompare(b.text));
  }, [mealPlan, orderedDays, allMealTypes, manualMealItems]);

  // Copy grocery list to clipboard
  const copyGroceryList = async () => {
    const listText = groceryList.map(item => item.count > 1 ? `${item.text} x${item.count}` : item.text).join('\n');
    try {
      await navigator.clipboard.writeText(listText);
      toast({
        title: "Copied to clipboard",
        description: "Grocery list copied successfully!"
      });
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      toast({
        title: "Copy failed",
        description: "Unable to copy to clipboard. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Print grocery list
  const printGroceryList = () => {
    const printContent = `
      <html>
        <head>
          <title>Grocery List - Week of ${formatDate(weekDates[0])} to ${formatDate(weekDates[6])}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
            .item { margin: 8px 0; padding: 5px; border-left: 3px solid #007acc; padding-left: 10px; }
            .count { font-weight: bold; color: #666; }
          </style>
        </head>
        <body>
          <h1>Grocery List</h1>
          <p>Week of ${formatDate(weekDates[0])} - ${formatDate(weekDates[6])}</p>
          <p>Total items: ${groceryList.length}</p>
          ${groceryList.map(item => `
            <div class="item">
              ${item.text} ${item.count > 1 ? `<span class="count">x${item.count}</span>` : ''}
            </div>
          `).join('')}
        </body>
      </html>
    `;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  // Generate ingredients from meal items using AI
  const generateIngredients = async () => {
    setIsGeneratingIngredients(true);
    try {
      // Collect all meal items from current week
      const allMealItems: {
        text: string;
      }[] = [];
      orderedDays.forEach(day => {
        allMealTypes.forEach(mealType => {
          const items = mealPlan[day]?.[mealType] || [];
          items.forEach(item => {
            allMealItems.push({
              text: item.text
            });
          });
        });
      });
      if (allMealItems.length === 0) {
        toast({
          title: "No meals found",
          description: "Add some meals to your plan first.",
          variant: "destructive"
        });
        return;
      }
      console.log('Generating ingredients for meals:', allMealItems);
      const {
        data,
        error
      } = await supabase.functions.invoke('extract-ingredients', {
        body: {
          mealItems: allMealItems
        }
      });
      if (error) throw error;
      console.log('Generated ingredients:', data.ingredients);
      setAiGeneratedIngredients(data.ingredients || []);
      toast({
        title: "Ingredients generated!",
        description: `Found ${data.ingredients?.length || 0} ingredients for your meals.`
      });
    } catch (error) {
      console.error('Error generating ingredients:', error);
      toast({
        title: "Failed to generate ingredients",
        description: "Please try again later.",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingIngredients(false);
    }
  };

  // Remove ingredient from grocery list
  const removeIngredient = (ingredientName: string) => {
    setRemovedIngredients(prev => new Set([...prev, ingredientName]));
    toast({
      title: "Ingredient removed",
      description: `${ingredientName} has been removed from your grocery list.`
    });
  };

  // Get filtered and sorted ingredients by category
  const organizedIngredients = useMemo(() => {
    console.log('Recalculating organizedIngredients with:', { 
      aiCount: aiGeneratedIngredients.length, 
      manualCount: manualGroceryItems.length 
    });
    
    const filtered = aiGeneratedIngredients.filter(ingredient => !removedIngredients.has(ingredient.name));

    // Group by category
    const groups: {
      [key: string]: any[];
    } = {};
    const categoryOrder = ['produce', 'meat', 'dairy', 'pantry', 'spices', 'frozen'];
    
    // Add AI generated ingredients
    filtered.forEach(ingredient => {
      const category = ingredient.category || 'other';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(ingredient);
    });

    // Add manual grocery items
    manualGroceryItems.forEach(item => {
      const category = item.category || 'other';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push({
        name: item.name,
        category: item.category,
        forDishes: ['Manually added']
      });
    });

    // Sort ingredients within each category alphabetically
    Object.keys(groups).forEach(category => {
      groups[category].sort((a, b) => a.name.localeCompare(b.name));
    });

    // Return categories in preferred order
    const orderedCategories = [...categoryOrder.filter(cat => groups[cat]), ...Object.keys(groups).filter(cat => !categoryOrder.includes(cat))];
    const result = orderedCategories.map(category => ({
      name: category,
      displayName: category.charAt(0).toUpperCase() + category.slice(1),
      items: groups[category]
    }));
    
    console.log('organizedIngredients result:', result);
    return result;
  }, [aiGeneratedIngredients, removedIngredients, manualGroceryItems]);

  // Get available categories (existing categories + "other")
  const availableCategories = useMemo(() => {
    const existingCategories = new Set<string>();
    
    // Add categories from AI ingredients
    aiGeneratedIngredients.forEach(ingredient => {
      if (ingredient.category && !removedIngredients.has(ingredient.name)) {
        existingCategories.add(ingredient.category);
      }
    });
    
    // Add categories from manual items
    manualGroceryItems.forEach(item => {
      existingCategories.add(item.category);
    });
    
    // Always include "other" as an option
    existingCategories.add('other');
    
    const categoryDisplayNames: { [key: string]: string } = {
      'produce': 'Produce',
      'meat': 'Meat & Seafood',
      'dairy': 'Dairy & Eggs',
      'pantry': 'Pantry & Dry Goods',
      'frozen': 'Frozen Foods',
      'beverages': 'Beverages',
      'condiments': 'Condiments & Sauces',
      'bakery': 'Bakery',
      'spices': 'Spices & Seasonings',
      'other': 'Other'
    };
    
    return Array.from(existingCategories)
      .sort()
      .map(category => ({
        value: category,
        label: categoryDisplayNames[category] || category.charAt(0).toUpperCase() + category.slice(1)
      }));
  }, [aiGeneratedIngredients, manualGroceryItems, removedIngredients]);

  // Save grocery list to database
  const saveGroceryListToDatabase = async () => {
    if (!user || aiGeneratedIngredients.length === 0) return;
    setIsSavingGroceryList(true);
    try {
      const weekStartDate = currentWeekStart.toISOString().split('T')[0];
      const {
        data,
        error
      } = await supabase.from('grocery_lists').upsert({
        user_id: user.id,
        week_start_date: weekStartDate,
        ingredients: aiGeneratedIngredients.filter(ingredient => !removedIngredients.has(ingredient.name))
      }, {
        onConflict: 'user_id,week_start_date'
      }).select().single();
      if (error) throw error;
      setSavedGroceryListId(data.id);
      toast({
        title: "Grocery list saved!",
        description: "Your grocery list has been saved to the database."
      });
    } catch (error) {
      console.error('Error saving grocery list:', error);
      toast({
        title: "Failed to save grocery list",
        description: "Please try again later.",
        variant: "destructive"
      });
    } finally {
      setIsSavingGroceryList(false);
    }
  };

  // Load grocery list from database
  const loadGroceryListFromDatabase = async () => {
    if (!user) return;
    try {
      const weekStartDate = currentWeekStart.toISOString().split('T')[0];
      const {
        data,
        error
      } = await supabase.from('grocery_lists').select('*').eq('user_id', user.id).eq('week_start_date', weekStartDate).maybeSingle();
      if (error) throw error;
      if (data) {
        setAiGeneratedIngredients(data.ingredients as any[] || []);
        setSavedGroceryListId(data.id);
        setRemovedIngredients(new Set()); // Reset removed ingredients when loading
        console.log('Loaded grocery list from database:', (data.ingredients as any[])?.length || 0, 'ingredients');
      } else {
        // No saved grocery list for this week
        setAiGeneratedIngredients([]);
        setSavedGroceryListId(null);
        setRemovedIngredients(new Set());
      }
    } catch (error) {
      console.error('Error loading grocery list:', error);
    }
  };

  // Load grocery list when week changes
  useEffect(() => {
    if (user) {
      loadGroceryListFromDatabase();
    }
  }, [user, currentWeekStart]);

  // Save to localStorage whenever settings change
  useEffect(() => {
    localStorage.setItem('mealPlan_firstDayOfWeek', firstDayOfWeek);
    // Recalculate current week start when first day changes
    setCurrentWeekStart(calculateWeekStart(new Date(), firstDayOfWeek));
  }, [firstDayOfWeek]);
  useEffect(() => {
    localStorage.setItem('mealPlan_customMealTypes', JSON.stringify(customMealTypes));
  }, [customMealTypes]);
  useEffect(() => {
    localStorage.setItem('mealPlan_zipCode', zipCode);
  }, [zipCode]);

  // Load meal plans from database when user changes or week changes
  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    loadMealPlansFromDatabase();
  }, [user, currentWeekStart, firstDayOfWeek]);
  const loadMealPlansFromDatabase = async () => {
    if (!user) return;
    console.log('🔄 Loading meal plans from database...');
    setIsLoading(true);
    try {
      // Get date range for current week
      const weekDates = getWeekDates();
      const startDate = weekDates[0].toISOString().split('T')[0];
      const endDate = weekDates[weekDates.length - 1].toISOString().split('T')[0];
      console.log('🔄 Querying database for dates:', {
        startDate,
        endDate
      });
      const {
        data,
        error
      } = await supabase.from('meal_plans').select('*').eq('user_id', user.id).gte('date', startDate).lte('date', endDate);
      if (error) throw error;
      console.log('🔄 Database returned:', data?.length || 0, 'records');
      data?.forEach(record => {
        console.log('🔄 Record:', {
          date: record.date,
          meal_type: record.meal_type,
          item_count: record.meal_items ? (record.meal_items as any[]).length : 0
        });
      });

      // Convert database format to local MealPlan format
      const weekKey = getWeekKey(currentWeekStart);
      const plan: MealPlan = {};

      // Initialize empty plan
      ALL_DAYS.forEach(day => {
        plan[day] = {};
        [...DEFAULT_MEAL_TYPES, ...customMealTypes].forEach(mealType => {
          plan[day][mealType] = [];
        });
      });

      // Fill with database data  
      data?.forEach(record => {
        const date = new Date(record.date + 'T00:00:00'); // Force local timezone
        // Calculate which day of the ordered week this date represents
        const weekStartDate = new Date(currentWeekStart.getFullYear(), currentWeekStart.getMonth(), currentWeekStart.getDate());
        const recordDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const daysDiff = Math.floor((recordDate.getTime() - weekStartDate.getTime()) / (1000 * 60 * 60 * 24));
        console.log('🔄 Date calculation:', {
          recordDate: record.date,
          currentWeekStart: currentWeekStart.toISOString().split('T')[0],
          daysDiff,
          calculatedDay: orderedDays[daysDiff] || 'INVALID'
        });
        if (daysDiff >= 0 && daysDiff < 7) {
          const dayName = orderedDays[daysDiff];
          console.log('🔄 Processing record for', dayName, record.meal_type, '- Raw meal_items:', record.meal_items);
          if (plan[dayName] && record.meal_items && Array.isArray(record.meal_items)) {
            const items = record.meal_items as unknown as MealItem[];
            console.log('🔄 Items after casting:', items, 'Length:', items.length);
            plan[dayName][record.meal_type] = items;
            console.log('🔄 Loaded', items.length, 'items for', dayName, record.meal_type);
          } else {
            console.log('🔄 Skipping record for', dayName, record.meal_type, '- plan exists:', !!plan[dayName], 'meal_items exists:', !!record.meal_items, 'is array:', Array.isArray(record.meal_items), 'length:', record.meal_items ? (record.meal_items as any[]).length : 'N/A');
          }
        } else {
          console.log('🔄 Record outside week range:', {
            recordDate: record.date,
            daysDiff,
            weekStart: currentWeekStart.toISOString().split('T')[0],
            weekEnd: new Date(currentWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          });
        }
      });

      // Fetch meal items from inventory to enrich with images and IDs
      const { data: mealItemsData } = await supabase
        .from('meal_items')
        .select('id, name, image_url')
        .eq('user_id', user.id);

      // Create a map of meal item names to their data (case-insensitive)
      const mealItemMap = new Map<string, { id: string; image_url: string | null }>();
      mealItemsData?.forEach(item => {
        mealItemMap.set(item.name.toLowerCase(), {
          id: item.id,
          image_url: item.image_url
        });
      });

      // Enrich meal plan items with meal_item_id and image_url
      Object.keys(plan).forEach(day => {
        Object.keys(plan[day]).forEach(mealType => {
          plan[day][mealType] = plan[day][mealType].map(item => {
            const mealItemData = mealItemMap.get(item.text.toLowerCase());
            if (mealItemData) {
              return {
                ...item,
                meal_item_id: mealItemData.id,
                image_url: mealItemData.image_url || undefined
              };
            }
            return item;
          });
        });
      });

      setMealPlans(prev => ({
        ...prev,
        [weekKey]: plan
      }));
      setMealPlan(plan);
      console.log('🔄 Meal plan loading completed');
    } catch (error) {
      console.error('❌ Error loading meal plans:', error);
      toast({
        title: "Error loading meal plans",
        description: "Failed to load your meal plans from the database.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Chat hook - initialized after loadMealPlansFromDatabase is defined
  const { messages, isLoading: isChatLoading, sendMessage } = useMealPlanChat(
    currentWeekStart,
    () => setShouldReloadMealPlans(prev => prev + 1)
  );
  
  // Reload meal plans when chat updates them
  useEffect(() => {
    if (shouldReloadMealPlans > 0) {
      loadMealPlansFromDatabase();
    }
  }, [shouldReloadMealPlans]);
  
  const saveMealPlanToDatabase = async (day: string, mealType: string, items: MealItem[]) => {
    if (!user) return;
    console.log('💾 [SAVE START] Saving to database:', {
      day,
      mealType,
      itemCount: items.length,
      user: user.id
    });
    try {
      // Calculate the actual date for this day using consistent date logic
      const dayIndex = orderedDays.indexOf(day);
      const weekStartDate = new Date(currentWeekStart.getFullYear(), currentWeekStart.getMonth(), currentWeekStart.getDate());
      const targetDate = new Date(weekStartDate);
      targetDate.setDate(weekStartDate.getDate() + dayIndex);
      const dateString = targetDate.toISOString().split('T')[0];
      console.log('💾 [SAVE] Database save details:', {
        dateString,
        dayIndex,
        orderedDays,
        currentWeekStart: currentWeekStart.toISOString().split('T')[0],
        itemsToSave: items.map(item => ({
          id: item.id,
          text: item.text
        }))
      });
      const {
        data,
        error
      } = await supabase.from('meal_plans').upsert({
        user_id: user.id,
        date: dateString,
        meal_type: mealType,
        meal_items: items as unknown as any
      }, {
        onConflict: 'user_id,date,meal_type'
      }).select();
      if (error) throw error;
      console.log('✅ [SAVE SUCCESS] Successfully saved to database:', {
        day,
        mealType,
        itemCount: items.length,
        returnedData: data
      });
    } catch (error) {
      console.error('❌ [SAVE ERROR] Error saving meal plan:', error, {
        day,
        mealType,
        itemCount: items.length
      });
      toast({
        title: "Error saving meal plan",
        description: `Failed to save changes to ${day} ${mealType}.`,
        variant: "destructive"
      });
    }
  };

  // Update meal plan when week changes
  useEffect(() => {
    const weekKey = getWeekKey(currentWeekStart);
    if (mealPlans[weekKey]) {
      setMealPlan(mealPlans[weekKey]);
    } else {
      const plan: MealPlan = {};
      ALL_DAYS.forEach(day => {
        plan[day] = {};
        [...DEFAULT_MEAL_TYPES, ...customMealTypes].forEach(mealType => {
          plan[day][mealType] = [];
        });
      });
      setMealPlan(plan);
    }
  }, [currentWeekStart, customMealTypes, mealPlans]);

  // Get dates for the current week
  const getWeekDates = () => {
    return orderedDays.map((_, index) => {
      const date = new Date(currentWeekStart);
      date.setDate(currentWeekStart.getDate() + index);
      return date;
    });
  };
  const weekDates = getWeekDates();

  // Navigation functions
  const goToPreviousWeek = () => {
    const newWeekStart = new Date(currentWeekStart);
    newWeekStart.setDate(currentWeekStart.getDate() - 7);
    setCurrentWeekStart(newWeekStart);
  };
  const goToNextWeek = () => {
    const newWeekStart = new Date(currentWeekStart);
    newWeekStart.setDate(currentWeekStart.getDate() + 7);
    setCurrentWeekStart(newWeekStart);
  };

  // Copy meal plan from another week
  const copyWeekFrom = async (fromWeekStart: Date, replaceAll: boolean) => {
    if (!user) return;
    try {
      // Get dates for the source week
      const fromOrderedDays = getOrderedDays(firstDayOfWeek);
      const fromWeekDates = fromOrderedDays.map((_, index) => {
        const date = new Date(fromWeekStart);
        date.setDate(fromWeekStart.getDate() + index);
        return date;
      });
      const startDate = fromWeekDates[0].toISOString().split('T')[0];
      const endDate = fromWeekDates[fromWeekDates.length - 1].toISOString().split('T')[0];

      // Fetch meal plans from source week
      const {
        data,
        error
      } = await supabase.from('meal_plans').select('*').eq('user_id', user.id).gte('date', startDate).lte('date', endDate);
      if (error) throw error;
      if (!data || data.length === 0) {
        toast({
          title: "No meals found",
          description: "The selected week doesn't have any meal plans to copy.",
          variant: "destructive"
        });
        return;
      }

      // Convert database format to meal plan format
      const sourceMealPlan: MealPlan = {};
      ALL_DAYS.forEach(day => {
        sourceMealPlan[day] = {};
        [...DEFAULT_MEAL_TYPES, ...customMealTypes].forEach(mealType => {
          sourceMealPlan[day][mealType] = [];
        });
      });

      // Fill with database data
      data.forEach(record => {
        const date = new Date(record.date + 'T00:00:00');
        const fromWeekStartDate = new Date(fromWeekStart.getFullYear(), fromWeekStart.getMonth(), fromWeekStart.getDate());
        const recordDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const daysDiff = Math.floor((recordDate.getTime() - fromWeekStartDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff >= 0 && daysDiff < 7) {
          const dayName = fromOrderedDays[daysDiff];
          if (sourceMealPlan[dayName] && record.meal_items && Array.isArray(record.meal_items)) {
            const items = record.meal_items as unknown as MealItem[];
            sourceMealPlan[dayName][record.meal_type] = items;
          }
        }
      });

      // Apply to current week
      let updatedPlan: MealPlan;
      if (replaceAll) {
        // Replace entire week
        updatedPlan = {
          ...sourceMealPlan
        };
      } else {
        // Add to existing meals
        updatedPlan = {
          ...mealPlan
        };
        orderedDays.forEach(day => {
          allMealTypes.forEach(mealType => {
            const existingItems = updatedPlan[day][mealType] || [];
            const sourceItems = sourceMealPlan[day][mealType] || [];
            // Create new items with unique IDs to avoid conflicts
            const newItems = sourceItems.map(item => ({
              ...item,
              id: `${item.id}-copy-${Date.now()}-${Math.random()}`
            }));
            updatedPlan[day][mealType] = [...existingItems, ...newItems];
          });
        });
      }

      // Save to database and update state
      setMealPlan(updatedPlan);

      // Save each day/meal type to database
      const savePromises: Promise<any>[] = [];
      orderedDays.forEach(day => {
        allMealTypes.forEach(mealType => {
          const items = updatedPlan[day][mealType] || [];
          savePromises.push(saveMealPlanToDatabase(day, mealType, items));
        });
      });
      await Promise.all(savePromises);
      toast({
        title: "Week copied!",
        description: `Meal plan has been ${replaceAll ? 'copied' : 'merged'} from the selected week.`
      });
    } catch (error) {
      console.error('Error copying week:', error);
      toast({
        title: "Failed to copy week",
        description: "Please try again later.",
        variant: "destructive"
      });
    }
  };

  // Generate mock weather data based on zip code
  const generateMockWeather = (zip: string) => {
    if (!zip) return;

    // Use zip code as seed for consistent weather
    const seed = zip.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    const conditions = ['Sunny', 'Partly Cloudy', 'Cloudy', 'Light Rain', 'Clear'];
    const weatherData: {
      [day: string]: WeatherData;
    } = {};
    orderedDays.forEach((day, index) => {
      // Generate pseudo-random but consistent temperatures and conditions
      const dayIndex = (seed + index) % 100;
      const baseTemp = 65 + dayIndex % 30; // 65-95°F range
      const conditionIndex = (seed + index * 3) % conditions.length;
      weatherData[day] = {
        temp: baseTemp,
        condition: conditions[conditionIndex],
        icon: '' // Not using icons in mock data
      };
    });
    setWeather(weatherData);
    toast({
      title: "Weather Loaded",
      description: `Showing mock weather data for ${zip}`
    });
  };

  // Load weather when zipcode changes
  useEffect(() => {
    if (zipCode) {
      generateMockWeather(zipCode);
    }
  }, [zipCode]);
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };
  const updateDayNotes = (day: string, notes: string) => {
    setDayNotes(prev => ({
      ...prev,
      [day]: notes
    }));
  };
  const toggleNotesSection = (day: string) => {
    setNotesOpen(prev => ({
      ...prev,
      [day]: !prev[day]
    }));
  };

  // Add global drag event listeners for debugging
  React.useEffect(() => {
    const handleGlobalDragStart = (e: DragEvent) => {
      console.log('🚀 Global drag start detected:', e.target);
      setIsDragging(true);
    };
    const handleGlobalDragEnd = (e: DragEvent) => {
      console.log('🏁 Global drag end detected:', e.target);
      setIsDragging(false);
    };
    const handleGlobalDrop = (e: DragEvent) => {
      console.log('💧 Global drop detected:', e.target);
      setIsDragging(false);
    };
    document.addEventListener('dragstart', handleGlobalDragStart);
    document.addEventListener('dragend', handleGlobalDragEnd);
    document.addEventListener('drop', handleGlobalDrop);
    return () => {
      document.removeEventListener('dragstart', handleGlobalDragStart);
      document.removeEventListener('dragend', handleGlobalDragEnd);
      document.removeEventListener('drop', handleGlobalDrop);
    };
  }, []);
  const addCustomMealType = () => {
    if (newMealType.trim() && !allMealTypes.includes(newMealType.trim())) {
      const mealType = newMealType.trim();
      setCustomMealTypes(prev => [...prev, mealType]);

      // Add empty arrays for this meal type across all days
      setMealPlan(prev => {
        const updated = {
          ...prev
        };
        ALL_DAYS.forEach(day => {
          updated[day][mealType] = [];
        });
        return updated;
      });
      setNewMealType('');
      toast({
        title: "Meal type added",
        description: `${mealType} has been added to your meal plan.`
      });
    }
  };
  const removeCustomMealType = (mealTypeToRemove: string) => {
    setCustomMealTypes(prev => prev.filter(type => type !== mealTypeToRemove));

    // Remove this meal type from all days
    setMealPlan(prev => {
      const updated = {
        ...prev
      };
      ALL_DAYS.forEach(day => {
        delete updated[day][mealTypeToRemove];
      });
      return updated;
    });
    toast({
      title: "Meal type removed",
      description: `${mealTypeToRemove} has been removed from your meal plan.`
    });
  };

  const addManualMealItem = () => {
    console.log('addManualMealItem called');
    if (newMealItem.trim()) {
      setManualMealItems(prev => [...prev, { text: newMealItem.trim(), count: 1 }]);
      setNewMealItem('');
    }
  };

  const removeManualMealItem = (index: number) => {
    setManualMealItems(prev => prev.filter((_, i) => i !== index));
  };

  const addManualGroceryItem = () => {
    console.log('addManualGroceryItem called with:', newGroceryItem, 'category:', newGroceryCategory);
    if (newGroceryItem.trim()) {
      setManualGroceryItems(prev => {
        const updated = [...prev, { 
          name: newGroceryItem.trim(), 
          category: newGroceryCategory 
        }];
        console.log('Updated manualGroceryItems:', updated);
        return updated;
      });
      setNewGroceryItem('');
    }
  };

  const removeManualGroceryItem = (itemName: string) => {
    setManualGroceryItems(prev => prev.filter(item => item.name !== itemName));
  };

  const updateMealPlan = (day: string, mealType: string, items: MealItem[]) => {
    console.log('🔄 [UPDATE] updateMealPlan called:', {
      day,
      mealType,
      itemCount: items.length
    });
    console.log('🔄 [UPDATE] Current mealPlan before update:', JSON.stringify(mealPlan[day]?.[mealType]?.map(item => ({
      id: item.id,
      text: item.text
    })) || []));
    const updatedPlan = {
      ...mealPlan,
      [day]: {
        ...mealPlan[day],
        [mealType]: items
      }
    };
    console.log('🔄 [UPDATE] New items being set:', items.map(item => ({
      id: item.id,
      text: item.text
    })));
    setMealPlan(updatedPlan);

    // Save to database (async, doesn't block UI)
    saveMealPlanToDatabase(day, mealType, items);

    // Update local cache
    setMealPlans(prev => {
      const updated = {
        ...prev,
        [currentWeekKey]: updatedPlan
      };
      console.log('🔄 [UPDATE] Updated mealPlans cache for week:', currentWeekKey);
      return updated;
    });
  };
  const removeItemFromSource = (sourceCell: string, itemId: string) => {
    const [day, mealType] = sourceCell.split('-');
    if (day && mealType && mealPlan[day] && mealPlan[day][mealType]) {
      const updatedItems = mealPlan[day][mealType].filter(item => item.id !== itemId);
      updateMealPlan(day, mealType, updatedItems);
    }
  };
  const getMealTypeColor = (mealType: string) => {
    const normalizedType = mealType.toLowerCase();
    if (normalizedType.includes('breakfast')) return 'breakfast';
    if (normalizedType.includes('lunch')) return 'lunch';
    if (normalizedType.includes('dinner')) return 'dinner';
    if (normalizedType.includes('snack')) return 'snack';
    return 'muted';
  };

  // Show authentication message if not logged in
  if (!user) {
    return <div className="min-h-screen p-6 flex items-center justify-center">
        <Card className="p-8 max-w-md text-center space-y-4">
          <UtensilsCrossed className="h-12 w-12 text-primary mx-auto" />
          <h2 className="text-2xl font-bold">Authentication Required</h2>
          <p className="text-muted-foreground">
            Please sign in to access your meal plans and save them to the database.
          </p>
          <Button onClick={() => window.location.href = '/auth'}>
            Sign In
          </Button>
        </Card>
      </div>;
  }
  if (isLoading) {
    return <div className="min-h-screen p-6 flex items-center justify-center">
        <Card className="p-8 max-w-md text-center space-y-4">
          <UtensilsCrossed className="h-12 w-12 text-primary mx-auto animate-pulse" />
          <h2 className="text-2xl font-bold">Loading Meal Plans</h2>
          <p className="text-muted-foreground">
            Fetching your meal plans from the database...
          </p>
        </Card>
      </div>;
  }
  return <div className={`min-h-screen p-3 sm:p-6 space-y-4 sm:space-y-8 ${isDragging ? 'cursor-grabbing' : ''}`}>
      {/* Header */}
      <div className="text-center space-y-3 sm:space-y-6">
        <div className="flex items-center justify-center gap-2 sm:gap-3">
          <UtensilsCrossed className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
          <h1 className="text-2xl sm:text-4xl font-bold text-foreground">Meal Plan Builder</h1>
        </div>
        <p className="text-sm sm:text-lg text-muted-foreground px-4">"Plans are worthless, planning is everything" -- D. Eisenhower</p>
        {isDragging && <div className="text-xs sm:text-sm text-orange-600 font-medium">
            🎯 Dragging in progress - Drop on any meal cell
          </div>}
      </div>

      {/* Meal Item Inventory */}
      {showRecipeInventory && <MealItemInventory />}

      {/* Meal Plan with Optional Chat */}
      {!showRecipeInventory && (
        <>
          {/* Copy Week Modal */}
          <CopyWeekModal open={showCopyWeekModal} onOpenChange={setShowCopyWeekModal} onCopyWeek={copyWeekFrom} currentWeekStart={currentWeekStart} firstDayOfWeek={firstDayOfWeek} />
          
          {/* Desktop/Tablet: Resizable Panels when chat is open */}
          {!isMobile && showChat ? (
            <ResizablePanelGroup direction="horizontal" className="h-[calc(100vh-200px)] gap-2">
              <ResizablePanel defaultSize={65} minSize={40}>
                <Card className="p-3 sm:p-6 h-full overflow-auto">
          {/* Week Navigation */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowCopyWeekModal(true)} 
              className="flex items-center gap-2 justify-center"
            >
              <Copy className="h-4 w-4" />
              <span className="hidden sm:inline">Copy from week</span>
              <span className="sm:hidden">Copy Week</span>
            </Button>
            
            <div className="flex items-center gap-2 sm:gap-4 flex-1 justify-center">
              <Button variant="outline" size="sm" onClick={goToPreviousWeek} className="px-2 sm:px-3">
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline ml-1">Previous</span>
              </Button>
              <div className="text-sm sm:text-lg font-medium text-center whitespace-nowrap">
                {formatDate(weekDates[0])} - {formatDate(weekDates[6])}
              </div>
              <Button variant="outline" size="sm" onClick={goToNextWeek} className="px-2 sm:px-3">
                <span className="hidden sm:inline mr-1">Next</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="flex items-center gap-2">
              <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  <span className="hidden sm:inline">Grocery List</span>
                </Button>
              </SheetTrigger>
               <SheetContent side="right" className="w-96 h-screen flex flex-col">
                 <SheetHeader className="mb-4">
                   <SheetTitle>Grocery List</SheetTitle>
                   <div className="text-sm text-muted-foreground">
                     Week of {formatDate(weekDates[0])} - {formatDate(weekDates[6])}
                   </div>
                 </SheetHeader>
                 
                  <div className="flex-1 min-h-0 flex flex-col">
                  <Tabs defaultValue="meals" className="flex flex-col flex-1 min-h-0 overflow-hidden">
                    <TabsList className="grid w-full grid-cols-2 shrink-0">
                      <TabsTrigger value="meals">Meal List</TabsTrigger>
                      <TabsTrigger value="grocery">Grocery List</TabsTrigger>
                    </TabsList>
                    
                     <TabsContent value="meals" className="flex flex-col flex-1 min-h-0 overflow-hidden space-y-4">
                       <div className="text-xs text-muted-foreground shrink-0">
                         Total items: {groceryList.length}
                       </div>
                       
                        {/* Add manual item */}
                        <div className="flex gap-2 mb-4 p-3 bg-muted/50 rounded shrink-0">
                          <Input
                            placeholder="Add item to meal list..."
                            value={newMealItem}
                            onChange={(e) => setNewMealItem(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && addManualMealItem()}
                            className="flex-1"
                          />
                          <Button size="sm" onClick={addManualMealItem} disabled={!newMealItem.trim()}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-2 shrink-0">
                          <Button variant="outline" size="sm" onClick={copyGroceryList}>
                            <Copy className="h-4 w-4 mr-1" />
                            Copy
                          </Button>
                          <Button variant="outline" size="sm" onClick={printGroceryList}>
                            <Printer className="h-4 w-4 mr-1" />
                            Print
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => setCheckedItems({})} className="ml-auto">
                            Clear checks
                          </Button>
                        </div>

                       {/* Meal list */}
                       <div className="flex-1 min-h-0 overflow-y-auto space-y-2 border rounded p-2">
                        {groceryList.length === 0 ? (
                          <div className="text-center text-muted-foreground py-8">
                            <UtensilsCrossed className="h-12 w-12 mx-auto mb-3 opacity-50" />
                            <p>No items in your meal plan yet.</p>
                            <p className="text-xs">Add meals to see your meal list here.</p>
                          </div>
                        ) : (
                          groceryList.map((item, index) => {
                             const isManualItem = manualMealItems.some(manual => manual.text === item.text);
                             return (
                               <div key={index} className="flex items-center space-x-3 p-2 hover:bg-muted/50 rounded group">
                                 <Checkbox 
                                   checked={checkedItems[item.text] || false} 
                                   onCheckedChange={checked => setCheckedItems(prev => ({
                                     ...prev,
                                     [item.text]: checked as boolean
                                   }))} 
                                 />
                                 <div className="flex-1">
                                   <span className={`${checkedItems[item.text] ? 'line-through text-muted-foreground' : ''}`}>
                                     {item.text}
                                   </span>
                                   {isManualItem && (
                                     <div className="text-xs text-muted-foreground italic">
                                       Manually added
                                     </div>
                                   )}
                                 </div>
                                 {item.count > 1 && <Badge variant="secondary" className="text-xs">
                                     x{item.count}
                                   </Badge>}
                                 {isManualItem && (
                                   <Button 
                                     variant="ghost" 
                                     size="sm" 
                                     onClick={() => removeManualMealItem(manualMealItems.findIndex(manual => manual.text === item.text))}
                                     className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground"
                                   >
                                     <X className="h-3 w-3" />
                                   </Button>
                                 )}
                               </div>
                             );
                          })
                        )}
                      </div>
                     </TabsContent>
                    
                      <TabsContent value="grocery" className="flex flex-col flex-1 min-h-0 overflow-hidden space-y-4">
                        {/* Add manual item */}
                        <div className="p-3 bg-muted/50 rounded space-y-3 shrink-0">
                          <div className="flex gap-2">
                            <Input
                              placeholder="Add ingredient..."
                              value={newGroceryItem}
                              onChange={(e) => setNewGroceryItem(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && addManualGroceryItem()}
                              className="flex-1"
                            />
                            <Select value={newGroceryCategory} onValueChange={setNewGroceryCategory}>
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {availableCategories.map((category) => (
                                  <SelectItem key={category.value} value={category.value}>
                                    {category.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button size="sm" onClick={addManualGroceryItem} disabled={!newGroceryItem.trim()}>
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between shrink-0">
                          <div className="text-xs text-muted-foreground">
                            Total ingredients: {organizedIngredients.reduce((total, cat) => total + cat.items.length, 0)}
                            {savedGroceryListId && <span className="text-green-600 ml-2">✓ Saved</span>}
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={generateIngredients} disabled={isGeneratingIngredients}>
                              {isGeneratingIngredients ? 'Generating...' : 'Generate'}
                            </Button>
                            {organizedIngredients.length > 0 && <Button variant="default" size="sm" onClick={saveGroceryListToDatabase} disabled={isSavingGroceryList}>
                                {isSavingGroceryList ? 'Saving...' : savedGroceryListId ? 'Update' : 'Save'}
                              </Button>}
                          </div>
                        </div>
                       
                        {/* AI-generated grocery list organized by category */}
                        <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
                         {organizedIngredients.length === 0 ? <div className="text-center text-muted-foreground py-8">
                             <UtensilsCrossed className="h-12 w-12 mx-auto mb-3 opacity-50" />
                             <p>No grocery list generated yet.</p>
                             <p className="text-xs">Click "Generate" to create a shopping list from your meals.</p>
                           </div> : organizedIngredients.map(category => <div key={category.name} className="space-y-2">
                               {/* Category header */}
                               <div className="sticky top-0 bg-background border-b pb-1 mb-2">
                                 <h4 className="font-semibold text-sm text-primary capitalize">
                                   {category.displayName} ({category.items.length})
                                 </h4>
                               </div>
                               
                                {/* Category items */}
                                {category.items.map((ingredient, index) => {
                                  const isManualItem = ingredient.forDishes && ingredient.forDishes.includes('Manually added');
                                  return (
                                    <div key={index} className="flex items-center space-x-3 p-2 hover:bg-muted/50 rounded group">
                                      <Checkbox 
                                        checked={checkedItems[`ai-${ingredient.name}`] || false} 
                                        onCheckedChange={checked => setCheckedItems(prev => ({
                                          ...prev,
                                          [`ai-${ingredient.name}`]: checked as boolean
                                        }))} 
                                      />
                                      <div className="flex-1">
                                        <div className={`${checkedItems[`ai-${ingredient.name}`] ? 'line-through text-muted-foreground' : ''}`}>
                                          {ingredient.name}
                                        </div>
                                        {ingredient.quantity && <div className="text-xs text-muted-foreground">
                                            {ingredient.quantity}
                                          </div>}
                                        {ingredient.forDishes && ingredient.forDishes.length > 0 && <div className="text-xs text-muted-foreground italic">
                                            {isManualItem ? 'Manually added' : `For: ${ingredient.forDishes.join(", ")}`}
                                          </div>}
                                      </div>
                                      <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        onClick={() => isManualItem ? removeManualGroceryItem(ingredient.name) : removeIngredient(ingredient.name)}
                                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground"
                                      >
                                        <X className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  );
                                })}
                             </div>)}
                      </div>
                   </TabsContent>
                  </Tabs>
                </div>
               </SheetContent>
                  </Sheet>
                </div>
           </div>

           {/* Mobile: Scrollable grid with fixed left column */}
          <div className="relative -mx-3 sm:mx-0">
            <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] sm:max-h-[70vh]">
              <div className="inline-block min-w-full">
                <div className="grid grid-cols-[100px_repeat(7,minmax(140px,1fr))] sm:grid-cols-[160px_repeat(7,minmax(0,1fr))] gap-0 border border-border">
                  {/* Header row with dates and weather */}
                  <div className="sticky top-0 left-0 z-50 bg-background border-r border-b border-border p-2 sm:p-4 w-[100px] sm:w-[160px]">
                    <span className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide">Meal</span>
                  </div>
                  {orderedDays.map((day, index) => (
                    <div key={day} className="sticky top-0 z-40 bg-background border-r border-b border-border text-center p-2 sm:p-4 space-y-0.5 sm:space-y-1 min-w-[140px]">
                      <div className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        {day.substring(0, 3)}
                      </div>
                      <div className="text-xl sm:text-2xl font-normal text-foreground">
                        {new Date(weekDates[index]).getDate()}
                      </div>
                      {weather[day] && (
                        <div className="flex items-center justify-center gap-1 text-[10px] sm:text-xs text-muted-foreground">
                          <Cloud className="h-3 w-3" />
                          <span>{weather[day].temp}°F</span>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Meal type rows */}
                  {allMealTypes.map(mealType => (
                    <div key={mealType} className="contents">
                      <div className="sticky left-0 z-30 bg-background border-r border-b border-border p-2 sm:p-4 flex items-center justify-between w-[100px] sm:w-[160px]">
                        <span className="text-xs sm:text-sm text-muted-foreground truncate">{mealType}</span>
                        {customMealTypes.includes(mealType) && (
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => removeCustomMealType(mealType)} 
                            className="h-5 w-5 sm:h-6 sm:w-6 p-0 hover:bg-destructive/10 hover:text-destructive ml-1 flex-shrink-0"
                          >
                            <Trash2 className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                          </Button>
                        )}
                      </div>

                      {orderedDays.map(day => (
                        <MealCell 
                          key={`${day}-${mealType}`} 
                          day={day} 
                          mealType={mealType} 
                          items={mealPlan[day][mealType] || []} 
                          onItemsChange={items => updateMealPlan(day, mealType, items)} 
                          onRemoveFromSource={removeItemFromSource} 
                          onAddToInventory={itemName => handleAddToInventory(itemName, mealType)}
                          mealTypeColor={getMealTypeColor(mealType)}
                        />
                      ))}
                    </div>
                  ))}
                 </div>
              </div>
            </div>
          </div>
        </Card>
              </ResizablePanel>
              
              <ResizableHandle withHandle />
              
              <ResizablePanel defaultSize={35} minSize={25} maxSize={60}>
                <Card className="h-full flex flex-col overflow-hidden">
                  <div className="flex items-center justify-between p-4 border-b shrink-0">
                    <h2 className="text-lg font-semibold">Meal Planning Assistant</h2>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowChat(false)}
                      className="h-8 w-8"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex-1 min-h-0 overflow-hidden">
                    <ChatInterface 
                      messages={messages}
                      isLoading={isChatLoading}
                      onSendMessage={sendMessage}
                      weekStartDate={currentWeekStart.toISOString().split('T')[0]}
                    />
                  </div>
                </Card>
              </ResizablePanel>
            </ResizablePanelGroup>
          ) : (
            <Card className="p-3 sm:p-6">
              {/* Week Navigation */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowCopyWeekModal(true)} 
                  className="flex items-center gap-2 justify-center"
                >
                  <Copy className="h-4 w-4" />
                  <span className="hidden sm:inline">Copy from week</span>
                  <span className="sm:hidden">Copy Week</span>
                </Button>
                
                <div className="flex items-center gap-2 sm:gap-4 flex-1 justify-center">
                  <Button variant="outline" size="sm" onClick={goToPreviousWeek} className="px-2 sm:px-3">
                    <ChevronLeft className="h-4 w-4" />
                    <span className="hidden sm:inline ml-1">Previous</span>
                  </Button>
                  <div className="text-sm sm:text-lg font-medium text-center whitespace-nowrap">
                    {formatDate(weekDates[0])} - {formatDate(weekDates[6])}
                  </div>
                  <Button variant="outline" size="sm" onClick={goToNextWeek} className="px-2 sm:px-3">
                    <span className="hidden sm:inline mr-1">Next</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="flex items-center gap-2">
                  <Sheet>
                  <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4" />
                    <span className="hidden sm:inline">Grocery List</span>
                  </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-96 h-screen flex flex-col">
                    <SheetHeader className="mb-4">
                      <SheetTitle>Grocery List</SheetTitle>
                      <div className="text-sm text-muted-foreground">
                        Week of {formatDate(weekDates[0])} - {formatDate(weekDates[6])}
                      </div>
                    </SheetHeader>
                    
                    <div className="flex-1 min-h-0 flex flex-col">
                      <Tabs defaultValue="meals" className="flex flex-col flex-1 min-h-0 overflow-hidden">
                        <TabsList className="grid w-full grid-cols-2 shrink-0">
                          <TabsTrigger value="meals">Meal List</TabsTrigger>
                          <TabsTrigger value="grocery">Grocery List</TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="meals" className="flex flex-col flex-1 min-h-0 overflow-hidden space-y-4">
                          <div className="text-xs text-muted-foreground shrink-0">
                            Total items: {groceryList.length}
                          </div>
                          
                          <div className="flex gap-2 mb-4 p-3 bg-muted/50 rounded shrink-0">
                            <Input
                              placeholder="Add item to meal list..."
                              value={newMealItem}
                              onChange={(e) => setNewMealItem(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && addManualMealItem()}
                              className="flex-1"
                            />
                            <Button size="sm" onClick={addManualMealItem} disabled={!newMealItem.trim()}>
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="flex gap-2 shrink-0">
                            <Button variant="outline" size="sm" onClick={copyGroceryList}>
                              <Copy className="h-4 w-4 mr-1" />
                              Copy
                            </Button>
                            <Button variant="outline" size="sm" onClick={printGroceryList}>
                              <Printer className="h-4 w-4 mr-1" />
                              Print
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setCheckedItems({})} className="ml-auto">
                              Clear checks
                            </Button>
                          </div>

                          <div className="flex-1 min-h-0 overflow-y-auto space-y-2 border rounded p-2">
                            {groceryList.length === 0 ? (
                              <div className="text-center text-muted-foreground py-8">
                                <UtensilsCrossed className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                <p>No items in your meal plan yet.</p>
                                <p className="text-xs">Add meals to see your meal list here.</p>
                              </div>
                            ) : (
                              groceryList.map((item, index) => {
                                const isManualItem = manualMealItems.some(manual => manual.text === item.text);
                                return (
                                  <div key={index} className="flex items-center space-x-3 p-2 hover:bg-muted/50 rounded group">
                                    <Checkbox 
                                      checked={checkedItems[item.text] || false} 
                                      onCheckedChange={checked => setCheckedItems(prev => ({
                                        ...prev,
                                        [item.text]: checked as boolean
                                      }))} 
                                    />
                                    <div className="flex-1">
                                      <span className={`${checkedItems[item.text] ? 'line-through text-muted-foreground' : ''}`}>
                                        {item.text}
                                      </span>
                                      {isManualItem && (
                                        <div className="text-xs text-muted-foreground italic">
                                          Manually added
                                        </div>
                                      )}
                                    </div>
                                    {item.count > 1 && <Badge variant="secondary" className="text-xs">x{item.count}</Badge>}
                                    {isManualItem && (
                                      <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        onClick={() => removeManualMealItem(manualMealItems.findIndex(manual => manual.text === item.text))}
                                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground"
                                      >
                                        <X className="h-3 w-3" />
                                      </Button>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </TabsContent>
                        
                        <TabsContent value="grocery" className="flex flex-col flex-1 min-h-0 overflow-hidden space-y-4">
                          <div className="p-3 bg-muted/50 rounded space-y-3 shrink-0">
                            <div className="flex gap-2">
                              <Input
                                placeholder="Add ingredient..."
                                value={newGroceryItem}
                                onChange={(e) => setNewGroceryItem(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addManualGroceryItem()}
                                className="flex-1"
                              />
                              <Select value={newGroceryCategory} onValueChange={setNewGroceryCategory}>
                                <SelectTrigger className="w-32">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableCategories.map((category) => (
                                    <SelectItem key={category.value} value={category.value}>
                                      {category.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button size="sm" onClick={addManualGroceryItem} disabled={!newGroceryItem.trim()}>
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          <div className="flex items-center justify-between shrink-0">
                            <div className="text-xs text-muted-foreground">
                              Total ingredients: {organizedIngredients.reduce((total, cat) => total + cat.items.length, 0)}
                              {savedGroceryListId && <span className="text-green-600 ml-2">✓ Saved</span>}
                            </div>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" onClick={generateIngredients} disabled={isGeneratingIngredients}>
                                {isGeneratingIngredients ? 'Generating...' : 'Generate'}
                              </Button>
                              {organizedIngredients.length > 0 && (
                                <Button variant="default" size="sm" onClick={saveGroceryListToDatabase} disabled={isSavingGroceryList}>
                                  {isSavingGroceryList ? 'Saving...' : savedGroceryListId ? 'Update' : 'Save'}
                                </Button>
                              )}
                            </div>
                          </div>
                        
                          <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
                            {organizedIngredients.length === 0 ? (
                              <div className="text-center text-muted-foreground py-8">
                                <UtensilsCrossed className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                <p>No grocery list generated yet.</p>
                                <p className="text-xs">Click "Generate" to create a shopping list from your meals.</p>
                              </div>
                            ) : (
                              organizedIngredients.map(category => (
                                <div key={category.name} className="space-y-2">
                                  <div className="sticky top-0 bg-background border-b pb-1 mb-2">
                                    <h4 className="font-semibold text-sm text-primary capitalize">
                                      {category.displayName} ({category.items.length})
                                    </h4>
                                  </div>
                                  
                                  {category.items.map((ingredient, index) => {
                                    const isManualItem = ingredient.forDishes && ingredient.forDishes.includes('Manually added');
                                    return (
                                      <div key={index} className="flex items-center space-x-3 p-2 hover:bg-muted/50 rounded group">
                                        <Checkbox 
                                          checked={checkedItems[`ai-${ingredient.name}`] || false} 
                                          onCheckedChange={checked => setCheckedItems(prev => ({
                                            ...prev,
                                            [`ai-${ingredient.name}`]: checked as boolean
                                          }))} 
                                        />
                                        <div className="flex-1">
                                          <div className={`${checkedItems[`ai-${ingredient.name}`] ? 'line-through text-muted-foreground' : ''}`}>
                                            {ingredient.name}
                                          </div>
                                          {ingredient.quantity && (
                                            <div className="text-xs text-muted-foreground">
                                              {ingredient.quantity}
                                            </div>
                                          )}
                                          {ingredient.forDishes && ingredient.forDishes.length > 0 && (
                                            <div className="text-xs text-muted-foreground italic">
                                              {isManualItem ? 'Manually added' : `For: ${ingredient.forDishes.join(", ")}`}
                                            </div>
                                          )}
                                        </div>
                                        <Button 
                                          variant="ghost" 
                                          size="sm" 
                                          onClick={() => isManualItem ? removeManualGroceryItem(ingredient.name) : removeIngredient(ingredient.name)}
                                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground"
                                        >
                                          <X className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    );
                                  })}
                                </div>
                              ))
                            )}
                          </div>
                        </TabsContent>
                      </Tabs>
                    </div>
                  </SheetContent>
                    </Sheet>
                  </div>
                </div>

                {/* Mobile: Scrollable grid */}
              <div className="relative -mx-3 sm:mx-0">
                <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] sm:max-h-[70vh]">
                  <div className="inline-block min-w-full">
                    <div className="grid grid-cols-[100px_repeat(7,minmax(140px,1fr))] sm:grid-cols-[160px_repeat(7,minmax(0,1fr))] gap-0 border border-border">
                      {/* Header row */}
                      <div className="sticky top-0 left-0 z-50 bg-background border-r border-b border-border p-2 sm:p-4 w-[100px] sm:w-[160px]">
                        <span className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide">Meal</span>
                      </div>
                      {orderedDays.map((day, index) => (
                        <div key={day} className="sticky top-0 z-40 bg-background border-r border-b border-border text-center p-2 sm:p-4 space-y-0.5 sm:space-y-1 min-w-[140px]">
                          <div className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            {day.substring(0, 3)}
                          </div>
                          <div className="text-xl sm:text-2xl font-normal text-foreground">
                            {new Date(weekDates[index]).getDate()}
                          </div>
                          {weather[day] && (
                            <div className="flex items-center justify-center gap-1 text-[10px] sm:text-xs text-muted-foreground">
                              <Cloud className="h-3 w-3" />
                              <span>{weather[day].temp}°F</span>
                            </div>
                          )}
                        </div>
                      ))}

                      {/* Meal type rows */}
                      {allMealTypes.map(mealType => (
                        <div key={mealType} className="contents">
                          <div className="sticky left-0 z-30 bg-background border-r border-b border-border p-2 sm:p-4 flex items-center justify-between w-[100px] sm:w-[160px]">
                            <span className="text-xs sm:text-sm text-muted-foreground truncate">{mealType}</span>
                            {customMealTypes.includes(mealType) && (
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                onClick={() => removeCustomMealType(mealType)} 
                                className="h-5 w-5 sm:h-6 sm:w-6 p-0 hover:bg-destructive/10 hover:text-destructive ml-1 flex-shrink-0"
                              >
                                <Trash2 className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                              </Button>
                            )}
                          </div>

                          {orderedDays.map(day => (
                            <MealCell 
                              key={`${day}-${mealType}`} 
                              day={day} 
                              mealType={mealType} 
                              items={mealPlan[day][mealType] || []} 
                              onItemsChange={items => updateMealPlan(day, mealType, items)} 
                              onRemoveFromSource={removeItemFromSource} 
                              onAddToInventory={itemName => handleAddToInventory(itemName, mealType)}
                              mealTypeColor={getMealTypeColor(mealType)}
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          )}
          
          
          {/* Mobile: Bottom Sheet for Chat */}
          {isMobile && showChat && (
            <Sheet open={showChat} onOpenChange={setShowChat}>
              <SheetContent side="bottom" className="h-[80vh]">
                <ChatInterface 
                  messages={messages}
                  isLoading={isChatLoading}
                  onSendMessage={sendMessage}
                  weekStartDate={currentWeekStart.toISOString().split('T')[0]}
                />
              </SheetContent>
            </Sheet>
          )}
        </>
      )}
    </div>;
};