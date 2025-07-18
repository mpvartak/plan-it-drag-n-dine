import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, UtensilsCrossed } from 'lucide-react';
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
const DEFAULT_MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'School Snacks'];

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
  const { toast } = useToast();

  const allMealTypes = [...DEFAULT_MEAL_TYPES, ...customMealTypes];

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

  const getMealTypeColor = (mealType: string) => {
    const normalizedType = mealType.toLowerCase();
    if (normalizedType.includes('breakfast')) return 'breakfast';
    if (normalizedType.includes('lunch')) return 'lunch';
    if (normalizedType.includes('dinner')) return 'dinner';
    if (normalizedType.includes('snack')) return 'snack';
    return 'muted';
  };

  return (
    <div className="min-h-screen bg-background p-4 space-y-6">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-3">
          <UtensilsCrossed className="h-8 w-8 text-primary" />
          <h1 className="text-4xl font-bold text-foreground">Meal Plan Builder</h1>
        </div>
        <p className="text-lg text-muted-foreground">
          Plan your weekly meals with drag & drop functionality
        </p>
      </div>

      {/* Controls */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-48">
            <label className="text-sm font-medium text-foreground mb-2 block">
              Add Custom Meal Type
            </label>
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
          </div>
          
          <Button 
            onClick={() => setShowRecipeInventory(!showRecipeInventory)}
            variant="outline"
          >
            {showRecipeInventory ? 'Hide' : 'Show'} Recipe Inventory
          </Button>
        </div>
      </Card>

      {/* Recipe Inventory */}
      {showRecipeInventory && <RecipeInventory />}

      {/* Meal Plan Table */}
      <Card className="p-6 overflow-x-auto">
        <div className="min-w-[800px]">
          <div className="grid grid-cols-8 gap-2">
            {/* Header row */}
            <div className="font-semibold text-center p-3 text-foreground">
              Meal Type
            </div>
            {DAYS.map(day => (
              <div key={day} className="font-semibold text-center p-3 text-foreground">
                {day}
              </div>
            ))}

            {/* Meal type rows */}
            {allMealTypes.map(mealType => (
              <React.Fragment key={mealType}>
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
                  />
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
};