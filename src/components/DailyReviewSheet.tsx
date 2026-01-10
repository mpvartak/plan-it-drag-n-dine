import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, Check, X, RefreshCw, Plus, Trash2, ShoppingBag, UtensilsCrossed, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { MealPlan, MealItem } from './MealPlanBuilder';

interface FoodLogEntry {
  id: string;
  item_name: string;
  status: 'as_planned' | 'skipped' | 'substituted';
  substitute_name?: string;
  meal_type?: string;
}

interface GroceryPurchaseEntry {
  id: string;
  item_name: string;
  quantity: string;
  cost: string;
}

interface EatingOutEntry {
  id: string;
  description: string;
  cost: string;
}

interface WasteEntry {
  id: string;
  item_name: string;
  quantity: string;
  reason: 'expired' | 'spoiled' | 'didnt_like' | 'too_much';
}

interface DailyReviewSheetProps {
  mealPlan: MealPlan;
  weekDates: Date[];
  orderedDays: string[];
  allMealTypes: string[];
}

const WASTE_REASONS = [
  { value: 'expired', label: 'Expired' },
  { value: 'spoiled', label: 'Spoiled' },
  { value: 'didnt_like', label: "Didn't like it" },
  { value: 'too_much', label: 'Made too much' },
];

export const DailyReviewSheet = ({
  mealPlan,
  weekDates,
  orderedDays,
  allMealTypes,
}: DailyReviewSheetProps) => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [mealsOpen, setMealsOpen] = useState(true);
  const [purchasesOpen, setPurchasesOpen] = useState(true);
  const [wasteOpen, setWasteOpen] = useState(true);
  
  // Local state for food logs (UI only for now)
  const [mealLogs, setMealLogs] = useState<FoodLogEntry[]>([]);
  const [groceryPurchases, setGroceryPurchases] = useState<GroceryPurchaseEntry[]>([]);
  const [eatingOut, setEatingOut] = useState<EatingOutEntry[]>([]);
  const [waste, setWaste] = useState<WasteEntry[]>([]);
  
  // Input states for groceries
  const [newGroceryItem, setNewGroceryItem] = useState('');
  const [newGroceryQuantity, setNewGroceryQuantity] = useState('');
  const [newGroceryCost, setNewGroceryCost] = useState('');
  
  // Input states for eating out
  const [newEatingOutDesc, setNewEatingOutDesc] = useState('');
  const [newEatingOutCost, setNewEatingOutCost] = useState('');
  
  // Input states for waste
  const [newWasteItem, setNewWasteItem] = useState('');
  const [newWasteQuantity, setNewWasteQuantity] = useState('');
  const [newWasteReason, setNewWasteReason] = useState<WasteEntry['reason']>('expired');
  
  // Input states for unplanned meals
  const [unplannedMeal, setUnplannedMeal] = useState('');
  const [unplannedMealType, setUnplannedMealType] = useState('');
  
  // State for inline substitute input
  const [editingSubstituteId, setEditingSubstituteId] = useState<string | null>(null);
  const [substituteInput, setSubstituteInput] = useState('');

  // Get planned meals for selected date
  const plannedMeals = useMemo(() => {
    const dayIndex = weekDates.findIndex(
      (d) => d.toDateString() === selectedDate.toDateString()
    );
    
    if (dayIndex === -1) return [];
    
    const dayName = orderedDays[dayIndex];
    const meals: { mealType: string; items: MealItem[] }[] = [];
    
    allMealTypes.forEach((mealType) => {
      const items = mealPlan[dayName]?.[mealType] || [];
      if (items.length > 0) {
        meals.push({ mealType, items });
      }
    });
    
    return meals;
  }, [selectedDate, weekDates, orderedDays, mealPlan, allMealTypes]);

  // Get status for a meal item
  const getMealStatus = (itemId: string): FoodLogEntry | undefined => {
    return mealLogs.find((log) => log.id === itemId);
  };

  // Update meal status
  const updateMealStatus = (
    itemId: string,
    itemName: string,
    mealType: string,
    status: FoodLogEntry['status'],
    substituteName?: string
  ) => {
    setMealLogs((prev) => {
      const existing = prev.find((log) => log.id === itemId);
      if (existing) {
        return prev.map((log) =>
          log.id === itemId
            ? { ...log, status, substitute_name: substituteName }
            : log
        );
      }
      return [
        ...prev,
        {
          id: itemId,
          item_name: itemName,
          status,
          substitute_name: substituteName,
          meal_type: mealType,
        },
      ];
    });
  };

  // Handle substitute button click - show inline input
  const handleSubstituteClick = (itemId: string) => {
    if (editingSubstituteId === itemId) {
      // Already editing, cancel
      setEditingSubstituteId(null);
      setSubstituteInput('');
    } else {
      setEditingSubstituteId(itemId);
      setSubstituteInput('');
    }
  };

  // Confirm substitute
  const confirmSubstitute = (itemId: string, itemName: string, mealType: string) => {
    if (substituteInput.trim()) {
      updateMealStatus(itemId, itemName, mealType, 'substituted', substituteInput.trim());
    }
    setEditingSubstituteId(null);
    setSubstituteInput('');
  };

  // Add unplanned meal
  const addUnplannedMeal = () => {
    if (!unplannedMeal.trim() || !unplannedMealType) return;
    
    const newEntry: FoodLogEntry = {
      id: `unplanned-${Date.now()}`,
      item_name: unplannedMeal.trim(),
      status: 'as_planned',
      meal_type: unplannedMealType,
    };
    
    setMealLogs((prev) => [...prev, newEntry]);
    setUnplannedMeal('');
    setUnplannedMealType('');
  };

  // Add grocery purchase
  const addGroceryPurchase = () => {
    if (!newGroceryItem.trim()) return;
    
    const newEntry: GroceryPurchaseEntry = {
      id: `grocery-${Date.now()}`,
      item_name: newGroceryItem.trim(),
      quantity: newGroceryQuantity.trim(),
      cost: newGroceryCost.trim(),
    };
    
    setGroceryPurchases((prev) => [...prev, newEntry]);
    setNewGroceryItem('');
    setNewGroceryQuantity('');
    setNewGroceryCost('');
  };

  // Add eating out entry
  const addEatingOut = () => {
    if (!newEatingOutDesc.trim()) return;
    
    const newEntry: EatingOutEntry = {
      id: `eatingout-${Date.now()}`,
      description: newEatingOutDesc.trim(),
      cost: newEatingOutCost.trim(),
    };
    
    setEatingOut((prev) => [...prev, newEntry]);
    setNewEatingOutDesc('');
    setNewEatingOutCost('');
  };

  // Add waste
  const addWaste = () => {
    if (!newWasteItem.trim()) return;
    
    const newEntry: WasteEntry = {
      id: `waste-${Date.now()}`,
      item_name: newWasteItem.trim(),
      quantity: newWasteQuantity.trim(),
      reason: newWasteReason,
    };
    
    setWaste((prev) => [...prev, newEntry]);
    setNewWasteItem('');
    setNewWasteQuantity('');
  };

  // Remove entries
  const removeGroceryPurchase = (id: string) => {
    setGroceryPurchases((prev) => prev.filter((p) => p.id !== id));
  };

  const removeEatingOut = (id: string) => {
    setEatingOut((prev) => prev.filter((e) => e.id !== id));
  };

  const removeWaste = (id: string) => {
    setWaste((prev) => prev.filter((w) => w.id !== id));
  };

  // Get unplanned meals (entries that aren't in the planned meals)
  const unplannedMeals = mealLogs.filter(
    (log) => log.id.startsWith('unplanned-')
  );

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4" />
          <span className="hidden sm:inline">Log Day</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:w-[480px] h-screen flex flex-col overflow-hidden">
        <SheetHeader className="shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Daily Review
          </SheetTitle>
        </SheetHeader>

        {/* Date Picker */}
        <div className="py-3 shrink-0">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !selectedDate && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? format(selectedDate, 'EEEE, MMMM d, yyyy') : 'Pick a date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {/* Meals Section */}
          <Collapsible open={mealsOpen} onOpenChange={setMealsOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted"
              >
                <span className="flex items-center gap-2 font-medium">
                  🍽️ Meals
                </span>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 transition-transform',
                    mealsOpen && 'rotate-180'
                  )}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 space-y-4">
              {plannedMeals.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No meals planned for this day
                </p>
              ) : (
                plannedMeals.map(({ mealType, items }) => (
                  <div key={mealType} className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground">
                      {mealType}
                    </h4>
                    {items.map((item) => {
                      const status = getMealStatus(item.id);
                      const isEditingSubstitute = editingSubstituteId === item.id;
                      return (
                        <div key={item.id} className="space-y-2">
                          <div className="flex items-center gap-2 p-2 rounded-lg border bg-card">
                            <span className="flex-1 text-sm">{item.text}</span>
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant={status?.status === 'as_planned' ? 'default' : 'outline'}
                                className="h-8 w-8 p-0"
                                onClick={() =>
                                  updateMealStatus(item.id, item.text, mealType, 'as_planned')
                                }
                                title="Ate as planned"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant={status?.status === 'skipped' ? 'destructive' : 'outline'}
                                className="h-8 w-8 p-0"
                                onClick={() =>
                                  updateMealStatus(item.id, item.text, mealType, 'skipped')
                                }
                                title="Skipped"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant={status?.status === 'substituted' ? 'secondary' : 'outline'}
                                className="h-8 w-8 p-0"
                                onClick={() => handleSubstituteClick(item.id)}
                                title="Ate something else"
                              >
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          {/* Inline substitute input */}
                          {isEditingSubstitute && (
                            <div className="flex items-center gap-2 ml-2">
                              <Input
                                placeholder="What did you eat instead?"
                                value={substituteInput}
                                onChange={(e) => setSubstituteInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    confirmSubstitute(item.id, item.text, mealType);
                                  } else if (e.key === 'Escape') {
                                    setEditingSubstituteId(null);
                                    setSubstituteInput('');
                                  }
                                }}
                                className="flex-1"
                                autoFocus
                              />
                              <Button
                                size="sm"
                                onClick={() => confirmSubstitute(item.id, item.text, mealType)}
                                disabled={!substituteInput.trim()}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setEditingSubstituteId(null);
                                  setSubstituteInput('');
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                          {/* Show substitute name if set */}
                          {status?.status === 'substituted' && status.substitute_name && !isEditingSubstitute && (
                            <div className="ml-2 text-sm text-muted-foreground">
                              → {status.substitute_name}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))
              )}

              {/* Unplanned meals */}
              {unplannedMeals.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Unplanned
                  </h4>
                  {unplannedMeals.map((meal) => (
                    <div
                      key={meal.id}
                      className="flex items-center gap-2 p-2 rounded-lg border bg-card"
                    >
                      <Badge variant="outline" className="shrink-0">
                        {meal.meal_type}
                      </Badge>
                      <span className="flex-1 text-sm">{meal.item_name}</span>
                      <Check className="h-4 w-4 text-green-500" />
                    </div>
                  ))}
                </div>
              )}

              {/* Add unplanned meal */}
              <div className="flex items-center gap-2">
                <Select value={unplannedMealType} onValueChange={setUnplannedMealType}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Meal" />
                  </SelectTrigger>
                  <SelectContent>
                    {allMealTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Add unplanned item..."
                  value={unplannedMeal}
                  onChange={(e) => setUnplannedMeal(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addUnplannedMeal()}
                  className="flex-1"
                />
                <Button size="sm" onClick={addUnplannedMeal} disabled={!unplannedMeal.trim() || !unplannedMealType}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Purchases Section */}
          <Collapsible open={purchasesOpen} onOpenChange={setPurchasesOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted"
              >
                <span className="flex items-center gap-2 font-medium">
                  💰 Purchases
                </span>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 transition-transform',
                    purchasesOpen && 'rotate-180'
                  )}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 space-y-4">
              {/* Groceries subsection */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4" />
                  Groceries
                </h4>
                
                {groceryPurchases.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    No groceries logged yet
                  </p>
                ) : (
                  groceryPurchases.map((purchase) => (
                    <div
                      key={purchase.id}
                      className="flex items-center gap-2 p-2 rounded-lg border bg-card"
                    >
                      <span className="flex-1 text-sm">{purchase.item_name}</span>
                      {purchase.quantity && (
                        <Badge variant="outline" className="shrink-0">
                          {purchase.quantity}
                        </Badge>
                      )}
                      {purchase.cost && (
                        <Badge variant="secondary" className="shrink-0">
                          ${purchase.cost}
                        </Badge>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        onClick={() => removeGroceryPurchase(purchase.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}

                {/* Add grocery */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Item name"
                      value={newGroceryItem}
                      onChange={(e) => setNewGroceryItem(e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      placeholder="Qty"
                      value={newGroceryQuantity}
                      onChange={(e) => setNewGroceryQuantity(e.target.value)}
                      className="w-20"
                    />
                    <Input
                      placeholder="$"
                      value={newGroceryCost}
                      onChange={(e) => setNewGroceryCost(e.target.value)}
                      className="w-16"
                    />
                    <Button 
                      size="sm" 
                      onClick={addGroceryPurchase} 
                      disabled={!newGroceryItem.trim()}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Eating Out subsection */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <UtensilsCrossed className="h-4 w-4" />
                  Eating Out
                </h4>
                
                {eatingOut.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    No eating out logged yet
                  </p>
                ) : (
                  eatingOut.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center gap-2 p-2 rounded-lg border bg-card"
                    >
                      <span className="flex-1 text-sm">{entry.description}</span>
                      {entry.cost && (
                        <Badge variant="secondary" className="shrink-0">
                          ${entry.cost}
                        </Badge>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        onClick={() => removeEatingOut(entry.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}

                {/* Add eating out */}
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Where / what did you eat?"
                    value={newEatingOutDesc}
                    onChange={(e) => setNewEatingOutDesc(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addEatingOut()}
                    className="flex-1"
                  />
                  <Input
                    placeholder="$"
                    value={newEatingOutCost}
                    onChange={(e) => setNewEatingOutCost(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addEatingOut()}
                    className="w-16"
                  />
                  <Button size="sm" onClick={addEatingOut} disabled={!newEatingOutDesc.trim()}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Waste Section */}
          <Collapsible open={wasteOpen} onOpenChange={setWasteOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted"
              >
                <span className="flex items-center gap-2 font-medium">
                  🗑️ Waste
                </span>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 transition-transform',
                    wasteOpen && 'rotate-180'
                  )}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 space-y-3">
              {waste.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-2">
                  No waste logged yet
                </p>
              ) : (
                waste.map((wasteItem) => (
                  <div
                    key={wasteItem.id}
                    className="flex items-center gap-2 p-2 rounded-lg border bg-card"
                  >
                    <span className="flex-1 text-sm">{wasteItem.item_name}</span>
                    {wasteItem.quantity && (
                      <Badge variant="outline" className="shrink-0">
                        {wasteItem.quantity}
                      </Badge>
                    )}
                    <Badge variant="secondary">
                      {WASTE_REASONS.find((r) => r.value === wasteItem.reason)?.label}
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      onClick={() => removeWaste(wasteItem.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}

              {/* Add waste */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="What did you throw out?"
                    value={newWasteItem}
                    onChange={(e) => setNewWasteItem(e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    placeholder="How much?"
                    value={newWasteQuantity}
                    onChange={(e) => setNewWasteQuantity(e.target.value)}
                    className="w-24"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Select value={newWasteReason} onValueChange={(v) => setNewWasteReason(v as WasteEntry['reason'])}>
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WASTE_REASONS.map((reason) => (
                        <SelectItem key={reason.value} value={reason.value}>
                          {reason.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={addWaste} disabled={!newWasteItem.trim()}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Footer - Save button (placeholder for now) */}
        <div className="pt-4 border-t shrink-0">
          <Button className="w-full" disabled>
            Save Log (coming soon)
          </Button>
          <p className="text-xs text-muted-foreground text-center mt-2">
            Database persistence will be added next
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
};
