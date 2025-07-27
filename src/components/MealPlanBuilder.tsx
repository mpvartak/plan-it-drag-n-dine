
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, UtensilsCrossed, Settings, ChevronDown, ChevronUp, Cloud, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { MealCell } from './MealCell';
import { RecipeInventory } from './RecipeInventory';

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

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DEFAULT_MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'School Snacks', 'Prep'];

interface WeatherData {
  temp: number;
  condition: string;
  icon: string;
}

interface DayNotes {
  [day: string]: string;
}

export const MealPlanBuilder = () => {
  const [mealPlan, setMealPlan] = useState<MealPlan>(() => {
    const plan: MealPlan = {};
    DAYS.forEach(day => {
      plan[day] = {};
      DEFAULT_MEAL_TYPES.forEach(mealType => {
        plan[day][mealType] = [];
      });
    });
    return plan;
  });

  const [customMealTypes, setCustomMealTypes] = useState<string[]>([]);
  const [newMealType, setNewMealType] = useState('');
  const [showRecipeInventory, setShowRecipeInventory] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);
    return monday;
  });
  const [zipCode, setZipCode] = useState('');
  const [weather, setWeather] = useState<{[day: string]: WeatherData}>({});
  const [dayNotes, setDayNotes] = useState<DayNotes>({});
  const [notesOpen, setNotesOpen] = useState<{[day: string]: boolean}>({});
  const [showSettings, setShowSettings] = useState(false);
  const { toast } = useToast();

  const handleAddToInventory = (itemName: string, mealType: string) => {
    // This will be handled by the RecipeInventory component via a custom event
    window.dispatchEvent(new CustomEvent('addToInventory', { detail: { itemName, mealType } }));
  };

  const allMealTypes = [...DEFAULT_MEAL_TYPES, ...customMealTypes];

  // Get dates for the current week
  const getWeekDates = () => {
    return DAYS.map((_, index) => {
      const date = new Date(currentWeekStart);
      date.setDate(currentWeekStart.getDate() + index);
      return date;
    });
  };

  const weekDates = getWeekDates();

  // Generate mock weather data based on zip code
  const generateMockWeather = (zip: string) => {
    if (!zip) return;
    
    // Use zip code as seed for consistent weather
    const seed = zip.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    
    const conditions = ['Sunny', 'Partly Cloudy', 'Cloudy', 'Light Rain', 'Clear'];
    const weatherData: {[day: string]: WeatherData} = {};
    
    DAYS.forEach((day, index) => {
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
        DAYS.forEach(day => {
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
      DAYS.forEach(day => {
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
    setMealPlan(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [mealType]: items
      }
    }));
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

  return (
    <div className={`min-h-screen bg-background p-4 space-y-6 ${isDragging ? 'cursor-grabbing' : ''}`}>
      {/* Header */}
      <div className="text-center space-y-4">
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
      <Card className="p-4">
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
          <div className="grid grid-cols-8 gap-2">
            {/* Header row with dates and weather */}
            <div className="font-semibold text-center p-3 text-foreground">
              Meal Type
            </div>
            {DAYS.map((day, index) => (
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
              {DAYS.map(day => (
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

                {DAYS.map(day => (
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
