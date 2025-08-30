
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, UtensilsCrossed, Settings, ChevronDown, ChevronUp, Cloud, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { MealCell } from './MealCell';
import { RecipeInventory } from './RecipeInventory';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface MealItem {
  id: string;
  text: string;
  isRecipe?: boolean;
  recipeId?: string;
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

export const MealPlanBuilder = () => {
  console.log('MealPlanBuilder component loaded');
  const { user } = useAuth();
  const { toast } = useToast();

  // Load settings from localStorage (non-critical settings can stay local)
  const [firstDayOfWeek, setFirstDayOfWeek] = useState<string>(() => {
    return localStorage.getItem('mealPlan_firstDayOfWeek') || 'Monday';
  });

  const [mealPlans, setMealPlans] = useState<{[weekKey: string]: MealPlan}>({});
  const [isLoading, setIsLoading] = useState(true);

  const calculateWeekStart = (date: Date, firstDay: string) => {
    const firstDayIndex = ALL_DAYS.indexOf(firstDay);
    const currentDayIndex = (date.getDay() + 6) % 7; // Convert Sunday=0 to Monday=0 format
    const dayOffset = (currentDayIndex - firstDayIndex + 7) % 7;
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - dayOffset);
    return weekStart;
  };

  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    return calculateWeekStart(new Date(), firstDayOfWeek);
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
  const [showRecipeInventory, setShowRecipeInventory] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [zipCode, setZipCode] = useState(() => {
    return localStorage.getItem('mealPlan_zipCode') || '';
  });
  const [weather, setWeather] = useState<{[day: string]: WeatherData}>({});
  const [dayNotes, setDayNotes] = useState<DayNotes>({});
  const [notesOpen, setNotesOpen] = useState<{[day: string]: boolean}>({});
  const [showSettings, setShowSettings] = useState(false);

  const handleAddToInventory = (itemName: string, mealType: string) => {
    // This will be handled by the RecipeInventory component via a custom event
    window.dispatchEvent(new CustomEvent('addToInventory', { detail: { itemName, mealType } }));
  };

  const allMealTypes = [...DEFAULT_MEAL_TYPES, ...customMealTypes];

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
      
      console.log('🔄 Querying database for dates:', { startDate, endDate });

      const { data, error } = await supabase
        .from('meal_plans')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate);

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
          if (plan[dayName] && record.meal_items && Array.isArray(record.meal_items) && record.meal_items.length > 0) {
            const items = (record.meal_items as unknown) as MealItem[];
            console.log('🔄 Items after casting:', items, 'Length:', items.length);
            plan[dayName][record.meal_type] = items;
            console.log('🔄 Loaded', items.length, 'items for', dayName, record.meal_type);
          } else {
            console.log('🔄 Skipping record for', dayName, record.meal_type, '- plan exists:', !!plan[dayName], 'meal_items exists:', !!record.meal_items, 'is array:', Array.isArray(record.meal_items), 'length:', record.meal_items ? (record.meal_items as any[]).length : 'N/A');
          }
        }
      });

      setMealPlans(prev => ({ ...prev, [weekKey]: plan }));
      setMealPlan(plan);
      console.log('🔄 Meal plan loading completed');
    } catch (error) {
      console.error('❌ Error loading meal plans:', error);
      toast({
        title: "Error loading meal plans",
        description: "Failed to load your meal plans from the database.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const saveMealPlanToDatabase = async (day: string, mealType: string, items: MealItem[]) => {
    if (!user) return;

    console.log('💾 [SAVE START] Saving to database:', { day, mealType, itemCount: items.length, user: user.id });
    
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
        itemsToSave: items.map(item => ({ id: item.id, text: item.text }))
      });

      const { data, error } = await supabase
        .from('meal_plans')
        .upsert({
          user_id: user.id,
          date: dateString,
          meal_type: mealType,
          meal_items: items as unknown as any,
        }, {
          onConflict: 'user_id,date,meal_type'
        })
        .select();

      if (error) throw error;
      console.log('✅ [SAVE SUCCESS] Successfully saved to database:', { 
        day, 
        mealType, 
        itemCount: items.length,
        returnedData: data 
      });
      
    } catch (error) {
      console.error('❌ [SAVE ERROR] Error saving meal plan:', error, { day, mealType, itemCount: items.length });
      toast({
        title: "Error saving meal plan",
        description: `Failed to save changes to ${day} ${mealType}.`,
        variant: "destructive",
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

  // Generate mock weather data based on zip code
  const generateMockWeather = (zip: string) => {
    if (!zip) return;
    
    // Use zip code as seed for consistent weather
    const seed = zip.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    
    const conditions = ['Sunny', 'Partly Cloudy', 'Cloudy', 'Light Rain', 'Clear'];
    const weatherData: {[day: string]: WeatherData} = {};
    
    orderedDays.forEach((day, index) => {
      // Generate pseudo-random but consistent temperatures and conditions
      const dayIndex = (seed + index) % 100;
      const baseTemp = 65 + (dayIndex % 30); // 65-95°F range
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
      description: `Showing mock weather data for ${zip}`,
    });
  };

  // Load weather when zipcode changes
  useEffect(() => {
    if (zipCode) {
      generateMockWeather(zipCode);
    }
  }, [zipCode]);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const updateDayNotes = (day: string, notes: string) => {
    setDayNotes(prev => ({ ...prev, [day]: notes }));
  };

  const toggleNotesSection = (day: string) => {
    setNotesOpen(prev => ({ ...prev, [day]: !prev[day] }));
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
        const updated = { ...prev };
        ALL_DAYS.forEach(day => {
          updated[day][mealType] = [];
        });
        return updated;
      });
      
      setNewMealType('');
      toast({
        title: "Meal type added",
        description: `${mealType} has been added to your meal plan.`,
      });
    }
  };

  const removeCustomMealType = (mealTypeToRemove: string) => {
    setCustomMealTypes(prev => prev.filter(type => type !== mealTypeToRemove));
    
    // Remove this meal type from all days
    setMealPlan(prev => {
      const updated = { ...prev };
      ALL_DAYS.forEach(day => {
        delete updated[day][mealTypeToRemove];
      });
      return updated;
    });
    
    toast({
      title: "Meal type removed",
      description: `${mealTypeToRemove} has been removed from your meal plan.`,
    });
  };

  const updateMealPlan = (day: string, mealType: string, items: MealItem[]) => {
    console.log('🔄 [UPDATE] updateMealPlan called:', { day, mealType, itemCount: items.length });
    console.log('🔄 [UPDATE] Current mealPlan before update:', JSON.stringify(mealPlan[day]?.[mealType]?.map(item => ({ id: item.id, text: item.text })) || []));
    
    const updatedPlan = {
      ...mealPlan,
      [day]: {
        ...mealPlan[day],
        [mealType]: items
      }
    };
    
    console.log('🔄 [UPDATE] New items being set:', items.map(item => ({ id: item.id, text: item.text })));
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
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
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
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <Card className="p-8 max-w-md text-center space-y-4">
          <UtensilsCrossed className="h-12 w-12 text-primary mx-auto animate-pulse" />
          <h2 className="text-2xl font-bold">Loading Meal Plans</h2>
          <p className="text-muted-foreground">
            Fetching your meal plans from the database...
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-background p-6 space-y-8 ${isDragging ? 'cursor-grabbing' : ''}`}>
      {/* Header */}
      <div className="text-center space-y-6">
        <div className="flex items-center justify-center gap-3">
          <UtensilsCrossed className="h-8 w-8 text-primary" />
          <h1 className="text-4xl font-bold text-foreground">Meal Plan Builder</h1>
        </div>
        <p className="text-lg text-muted-foreground">
          Plan your weekly meals with drag & drop functionality
        </p>
        {isDragging && (
          <div className="text-sm text-orange-600 font-medium">
            🎯 Dragging in progress - Drop on any meal cell
          </div>
        )}
      </div>

      {/* Controls */}
      <Card className="p-6 shadow-card">
        <div className="flex flex-wrap gap-4 items-end">
          <Button 
            onClick={() => setShowRecipeInventory(!showRecipeInventory)}
            variant="outline"
          >
            {showRecipeInventory ? 'Hide' : 'Show'} Recipe Inventory
          </Button>

          <Dialog open={showSettings} onOpenChange={setShowSettings}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Settings</DialogTitle>
              </DialogHeader>
              <div className="space-y-6">
                {/* Weather Settings */}
                <div>
                  <h3 className="text-lg font-medium mb-3">Weather</h3>
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">
                      Zip Code
                    </label>
                    <Input
                      value={zipCode}
                      onChange={(e) => setZipCode(e.target.value)}
                      placeholder="Enter zip code"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Enter your zip code to see weather information for each day
                    </p>
                  </div>
                </div>

                 {/* Week Settings */}
                 <div>
                   <h3 className="text-lg font-medium mb-3">Week Settings</h3>
                   <div>
                     <label className="text-sm font-medium text-foreground mb-2 block">
                       First Day of Week
                     </label>
                     <Select value={firstDayOfWeek} onValueChange={setFirstDayOfWeek}>
                       <SelectTrigger>
                         <SelectValue />
                       </SelectTrigger>
                       <SelectContent>
                         {ALL_DAYS.map(day => (
                           <SelectItem key={day} value={day}>{day}</SelectItem>
                         ))}
                       </SelectContent>
                     </Select>
                     <p className="text-xs text-muted-foreground mt-1">
                       Choose which day your meal planning week should start with
                     </p>
                   </div>
                 </div>

                 {/* Custom Meal Types */}
                <div>
                  <h3 className="text-lg font-medium mb-3">Custom Meal Types</h3>
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Input
                        value={newMealType}
                        onChange={(e) => setNewMealType(e.target.value)}
                        placeholder="e.g., Afternoon Snack, Pre-workout"
                        onKeyPress={(e) => e.key === 'Enter' && addCustomMealType()}
                      />
                      <Button onClick={addCustomMealType} size="sm">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    {customMealTypes.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Custom meal types:</p>
                        <div className="flex flex-wrap gap-2">
                          {customMealTypes.map(mealType => (
                            <Badge key={mealType} variant="secondary" className="flex items-center gap-1">
                              {mealType}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => removeCustomMealType(mealType)}
                                className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                              >
                                <X className="h-2 w-2" />
                              </Button>
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Keyboard Shortcuts */}
                <div>
                  <h3 className="text-lg font-medium mb-3">Keyboard Shortcuts</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Copy items from cell</span>
                      <kbd className="px-2 py-1 bg-muted rounded text-xs">Ctrl+C</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span>Paste items to cell</span>
                      <kbd className="px-2 py-1 bg-muted rounded text-xs">Ctrl+V</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span>Add new item</span>
                      <kbd className="px-2 py-1 bg-muted rounded text-xs">Enter</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span>Cancel adding</span>
                      <kbd className="px-2 py-1 bg-muted rounded text-xs">Escape</kbd>
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">
                      💡 Hover over any meal cell to activate keyboard shortcuts for that cell.
                    </p>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </Card>


      {/* Recipe Inventory */}
      {showRecipeInventory && <RecipeInventory />}

      {/* Meal Plan Table */}
      <Card className="p-6 overflow-x-auto">
        <div className="min-w-[800px]">
          {/* Week Navigation */}
          <div className="flex items-center justify-center mb-6 relative">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" onClick={goToPreviousWeek}>
                <ChevronLeft className="h-4 w-4" />
                Previous Week
              </Button>
              <div className="text-lg font-medium">
                {formatDate(weekDates[0])} - {formatDate(weekDates[6])}
              </div>
              <Button variant="outline" size="sm" onClick={goToNextWeek}>
                Next Week
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button variant="default" className="absolute right-0">
              Get grocery list
            </Button>
          </div>

          <div className="grid grid-cols-8 gap-4">
            {/* Header row with dates and weather */}
            <div className="font-semibold text-center p-3 text-foreground">
              Meal Type
            </div>
            {orderedDays.map((day, index) => (
              <div key={day} className="text-center p-3 space-y-1">
                <div className="font-semibold text-foreground">{day}</div>
                <div className="text-sm text-muted-foreground">
                  {formatDate(weekDates[index])}
                </div>
                {weather[day] && (
                  <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                    <Cloud className="h-3 w-3" />
                    <span>{weather[day].temp}°F</span>
                  </div>
                )}
              </div>
            ))}

            {/* Collapsible Notes row */}
            <div className="contents">
              <div className="p-3 rounded-lg bg-muted text-muted-foreground">
                <span className="font-medium">Notes</span>
              </div>
              {orderedDays.map(day => (
                <div key={`notes-${day}`} className="p-2">
                  <Collapsible 
                    open={notesOpen[day]} 
                    onOpenChange={() => toggleNotesSection(day)}
                  >
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="w-full justify-between p-2">
                        <span className="text-xs">Daily Notes</span>
                        {notesOpen[day] ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <Textarea
                        value={dayNotes[day] || ''}
                        onChange={(e) => updateDayNotes(day, e.target.value)}
                        placeholder={`Notes for ${day}...`}
                        className="mt-2 min-h-[60px] text-xs"
                      />
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              ))}
            </div>

            {/* Meal type rows */}
            {allMealTypes.map(mealType => (
              <div key={mealType} className="contents">
                <div className={`p-3 rounded-lg flex items-center justify-between bg-${getMealTypeColor(mealType)} text-${getMealTypeColor(mealType)}-foreground`}>
                  <span className="font-medium">{mealType}</span>
                  {customMealTypes.includes(mealType) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeCustomMealType(mealType)}
                      className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>

                {orderedDays.map(day => (
                  <MealCell
                    key={`${day}-${mealType}`}
                    day={day}
                    mealType={mealType}
                    items={mealPlan[day][mealType] || []}
                    onItemsChange={(items) => updateMealPlan(day, mealType, items)}
                    onRemoveFromSource={removeItemFromSource}
                    onAddToInventory={(itemName) => handleAddToInventory(itemName, mealType)}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
};
