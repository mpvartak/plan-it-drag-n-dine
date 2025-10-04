import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, X, ChefHat, Search, Edit2, ExternalLink, FileText, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import poheImage from '@/assets/pohe.png';

export interface Recipe {
  id: string;
  meal_item_id: string;
  recipe_type: 'url' | 'instructions';
  title: string | null;
  content: string;
  created_at?: string;
}

export interface MealItem {
  id: string;
  name: string;
  category: string | null;
  notes: string | null;
  recipes?: Recipe[];
  created_at?: string;
}

export const MealItemInventory: React.FC = () => {
  const [mealItems, setMealItems] = useState<MealItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newMealItem, setNewMealItem] = useState({ name: '', category: 'Breakfast' });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [draggedItem, setDraggedItem] = useState<MealItem | null>(null);
  const [selectedMealItem, setSelectedMealItem] = useState<MealItem | null>(null);
  const [newRecipe, setNewRecipe] = useState({ type: 'url' as 'url' | 'instructions', title: '', content: '' });
  const { user } = useAuth();
  const { toast } = useToast();

  const categories = ['All', 'Breakfast', 'Lunch', 'Dinner', 'Snacks', 'Prep'];

  // Load meal items from database
  const loadMealItems = async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      const { data: itemsData, error: itemsError } = await supabase
        .from('meal_items')
        .select('*')
        .eq('user_id', user.id)
        .order('name');

      if (itemsError) throw itemsError;

      // Load recipes for each meal item
      const { data: recipesData, error: recipesError } = await supabase
        .from('recipes')
        .select('*')
        .eq('user_id', user.id);

      if (recipesError) throw recipesError;

      // Combine items with their recipes
      const itemsWithRecipes: MealItem[] = (itemsData || []).map(item => ({
        id: item.id,
        name: item.name,
        category: item.category,
        notes: item.notes,
        created_at: item.created_at,
        recipes: (recipesData || [])
          .filter(recipe => recipe.meal_item_id === item.id)
          .map(recipe => ({
            id: recipe.id,
            meal_item_id: recipe.meal_item_id,
            recipe_type: recipe.recipe_type as 'url' | 'instructions',
            title: recipe.title,
            content: recipe.content,
            created_at: recipe.created_at
          }))
      }));

      setMealItems(itemsWithRecipes);
    } catch (error) {
      console.error('Error loading meal items:', error);
      toast({
        title: "Failed to load meal items",
        description: "Please try again later.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMealItems();
  }, [user]);

  // Listen for add to inventory events from meal plan
  useEffect(() => {
    const handleAddToInventory = async (event: CustomEvent) => {
      const { itemName, mealType } = event.detail;
      if (!user || !itemName || typeof itemName !== 'string') return;

      // Check if meal item already exists
      const existing = mealItems.find(item => item.name.toLowerCase() === itemName.toLowerCase());
      if (existing) return;

      try {
        const { data, error } = await supabase
          .from('meal_items')
          .insert({
            user_id: user.id,
            name: itemName.trim(),
            category: mealType || 'Other'
          })
          .select()
          .single();

        if (error) throw error;

        setMealItems(prev => [...prev, { ...data, recipes: [] }]);
        toast({
          title: "Added to inventory",
          description: `"${itemName}" has been added to your meal item inventory.`,
        });
      } catch (error: any) {
        if (error.code === '23505') {
          // Unique constraint violation - item already exists
          return;
        }
        console.error('Error adding to inventory:', error);
      }
    };

    window.addEventListener('addToInventory', handleAddToInventory as EventListener);
    return () => {
      window.removeEventListener('addToInventory', handleAddToInventory as EventListener);
    };
  }, [mealItems, user, toast]);

  const addMealItem = async () => {
    if (!user || !newMealItem.name.trim()) return;

    try {
      const { data, error } = await supabase
        .from('meal_items')
        .insert({
          user_id: user.id,
          name: newMealItem.name.trim(),
          category: newMealItem.category
        })
        .select()
        .single();

      if (error) throw error;

      setMealItems(prev => [...prev, { ...data, recipes: [] }]);
      setNewMealItem({ name: '', category: 'Breakfast' });
      toast({
        title: "Meal item added",
        description: `"${data.name}" has been added to your inventory.`,
      });
    } catch (error: any) {
      console.error('Error adding meal item:', error);
      if (error.code === '23505') {
        toast({
          title: "Item already exists",
          description: "This meal item is already in your inventory.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Failed to add meal item",
          description: "Please try again later.",
          variant: "destructive"
        });
      }
    }
  };

  const deleteMealItem = async (itemId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('meal_items')
        .delete()
        .eq('id', itemId)
        .eq('user_id', user.id);

      if (error) throw error;

      setMealItems(prev => prev.filter(item => item.id !== itemId));
      if (selectedMealItem?.id === itemId) {
        setSelectedMealItem(null);
      }
      toast({
        title: "Meal item deleted",
        description: "The meal item has been removed from your inventory.",
      });
    } catch (error) {
      console.error('Error deleting meal item:', error);
      toast({
        title: "Failed to delete meal item",
        description: "Please try again later.",
        variant: "destructive"
      });
    }
  };

  const addRecipe = async () => {
    if (!user || !selectedMealItem || !newRecipe.content.trim()) return;

    try {
      const { data, error } = await supabase
        .from('recipes')
        .insert({
          user_id: user.id,
          meal_item_id: selectedMealItem.id,
          recipe_type: newRecipe.type,
          title: newRecipe.title.trim() || null,
          content: newRecipe.content.trim()
        })
        .select()
        .single();

      if (error) throw error;

      // Update local state
      setMealItems(prev => prev.map(item => 
        item.id === selectedMealItem.id
          ? { 
              ...item, 
              recipes: [
                ...(item.recipes || []), 
                {
                  id: data.id,
                  meal_item_id: data.meal_item_id,
                  recipe_type: data.recipe_type as 'url' | 'instructions',
                  title: data.title,
                  content: data.content,
                  created_at: data.created_at
                }
              ] 
            }
          : item
      ));
      
      setSelectedMealItem(prev => 
        prev ? { 
          ...prev, 
          recipes: [
            ...(prev.recipes || []), 
            {
              id: data.id,
              meal_item_id: data.meal_item_id,
              recipe_type: data.recipe_type as 'url' | 'instructions',
              title: data.title,
              content: data.content,
              created_at: data.created_at
            }
          ] 
        } : null
      );

      setNewRecipe({ type: 'url', title: '', content: '' });
      toast({
        title: "Recipe added",
        description: "The recipe has been added to this meal item.",
      });
    } catch (error) {
      console.error('Error adding recipe:', error);
      toast({
        title: "Failed to add recipe",
        description: "Please try again later.",
        variant: "destructive"
      });
    }
  };

  const deleteRecipe = async (recipeId: string) => {
    if (!user || !selectedMealItem) return;

    try {
      const { error } = await supabase
        .from('recipes')
        .delete()
        .eq('id', recipeId)
        .eq('user_id', user.id);

      if (error) throw error;

      // Update local state
      setMealItems(prev => prev.map(item => 
        item.id === selectedMealItem.id
          ? { ...item, recipes: item.recipes?.filter(r => r.id !== recipeId) || [] }
          : item
      ));
      
      setSelectedMealItem(prev => 
        prev ? { ...prev, recipes: prev.recipes?.filter(r => r.id !== recipeId) || [] } : null
      );

      toast({
        title: "Recipe deleted",
        description: "The recipe has been removed.",
      });
    } catch (error) {
      console.error('Error deleting recipe:', error);
      toast({
        title: "Failed to delete recipe",
        description: "Please try again later.",
        variant: "destructive"
      });
    }
  };

  const filteredMealItems = mealItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleDragStart = (e: React.DragEvent, item: MealItem) => {
    setDraggedItem(item);
    
    const mealItem = {
      id: `meal-item-${item.id}-${Date.now()}`,
      text: item.name,
      isRecipe: true,
      recipeId: item.id,
    };
    
    e.dataTransfer.setData('text/plain', JSON.stringify(mealItem));
    e.dataTransfer.setData('application/x-recipe-item', 'true');
    e.dataTransfer.effectAllowed = 'copy';
    
    (e.currentTarget as HTMLElement).style.opacity = '0.5';
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedItem(null);
    (e.currentTarget as HTMLElement).style.opacity = '1';
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="text-center py-8">
          <p className="text-muted-foreground">Loading meal items...</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-3 sm:p-6">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <ChefHat className="h-6 w-6 text-primary" />
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">Meal Item Inventory</h2>
          {draggedItem && (
            <Badge variant="outline" className="animate-pulse">
              Dragging: {draggedItem.name}
            </Badge>
          )}
        </div>
        
        <p className="text-sm sm:text-base text-muted-foreground">
          Drag meal items to your meal plan, or click to manage recipes.
        </p>

        {/* Add new meal item */}
        <div className="grid gap-2 p-3 sm:p-4 bg-muted/30 rounded-lg">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1">
              <Input
                value={newMealItem.name}
                onChange={(e) => setNewMealItem(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter meal item name..."
                onKeyPress={(e) => e.key === 'Enter' && addMealItem()}
                className="text-sm"
              />
            </div>
            <select
              value={newMealItem.category}
              onChange={(e) => setNewMealItem(prev => ({ ...prev, category: e.target.value }))}
              className="px-3 py-2 border border-input bg-background rounded-md text-sm"
            >
              {categories.slice(1).map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            <Button onClick={addMealItem} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-1 sm:mr-0" />
              <span className="sm:hidden">Add Item</span>
            </Button>
          </div>
        </div>

        <Separator />

        {/* Search and filter */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search meal items..."
              className="pl-10 text-sm"
            />
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 border border-input bg-background rounded-md text-sm"
          >
            {categories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </div>

        {/* Meal items grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredMealItems.map(item => (
            <Dialog key={item.id} onOpenChange={(open) => { 
              if (open) setSelectedMealItem(item); 
              else { setSelectedMealItem(null); setNewRecipe({ type: 'url', title: '', content: '' }); }
            }}>
              <DialogTrigger asChild>
                <div
                  draggable
                  onDragStart={(e) => handleDragStart(e, item)}
                  onDragEnd={handleDragEnd}
                  className={`group p-3 border border-border rounded-lg cursor-move hover:border-primary hover:shadow-lg transition-all duration-200 bg-card ${
                    draggedItem?.id === item.id ? 'opacity-50 scale-95' : 'hover:scale-105'
                  }`}
                  title="Drag to meal plan or click to manage recipes"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-card-foreground truncate text-sm sm:text-base">{item.name}</h4>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {item.category && (
                          <Badge variant="outline" className="text-xs">
                            {item.category}
                          </Badge>
                        )}
                        {item.recipes && item.recipes.length > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {item.recipes.length} {item.recipes.length === 1 ? 'recipe' : 'recipes'}
                          </Badge>
                        )}
                      </div>
                    </div>
                    {item.name.toLowerCase() === 'pohe' && (
                      <img 
                        src={poheImage} 
                        alt="Pohe" 
                        className="w-16 h-16 object-cover rounded-md"
                      />
                    )}
                  </div>
                </div>
              </DialogTrigger>
              
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center justify-between">
                    <span>{item.name}</span>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        if (confirm('Are you sure you want to delete this meal item and all its recipes?')) {
                          deleteMealItem(item.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4">
                  {item.name.toLowerCase() === 'pohe' && (
                    <div className="flex justify-center">
                      <img 
                        src={poheImage} 
                        alt="Pohe" 
                        className="w-48 h-48 object-cover rounded-lg"
                      />
                    </div>
                  )}
                  
                  {/* Existing recipes */}
                  <div>
                    <h4 className="font-semibold mb-2">Recipes ({item.recipes?.length || 0})</h4>
                    {item.recipes && item.recipes.length > 0 ? (
                      <div className="space-y-2">
                        {item.recipes.map(recipe => (
                          <div key={recipe.id} className="p-3 border rounded-lg flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              {recipe.title && (
                                <p className="font-medium text-sm">{recipe.title}</p>
                              )}
                              {recipe.recipe_type === 'url' ? (
                                <a 
                                  href={recipe.content} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-sm text-primary hover:underline flex items-center gap-1 break-all"
                                >
                                  <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                  {recipe.content}
                                </a>
                              ) : (
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{recipe.content}</p>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteRecipe(recipe.id)}
                              className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground flex-shrink-0"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No recipes yet. Add one below!</p>
                    )}
                  </div>

                  <Separator />

                  {/* Add new recipe */}
                  <div className="space-y-3">
                    <h4 className="font-semibold">Add Recipe</h4>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={newRecipe.type === 'url' ? 'default' : 'outline'}
                        onClick={() => setNewRecipe(prev => ({ ...prev, type: 'url' }))}
                      >
                        <ExternalLink className="h-4 w-4 mr-1" />
                        URL
                      </Button>
                      <Button
                        size="sm"
                        variant={newRecipe.type === 'instructions' ? 'default' : 'outline'}
                        onClick={() => setNewRecipe(prev => ({ ...prev, type: 'instructions' }))}
                      >
                        <FileText className="h-4 w-4 mr-1" />
                        Instructions
                      </Button>
                    </div>
                    
                    <Input
                      placeholder="Recipe title (optional)"
                      value={newRecipe.title}
                      onChange={(e) => setNewRecipe(prev => ({ ...prev, title: e.target.value }))}
                      className="text-sm"
                    />
                    
                    {newRecipe.type === 'url' ? (
                      <Input
                        placeholder="https://example.com/recipe"
                        value={newRecipe.content}
                        onChange={(e) => setNewRecipe(prev => ({ ...prev, content: e.target.value }))}
                        className="text-sm"
                      />
                    ) : (
                      <Textarea
                        placeholder="Enter recipe instructions..."
                        value={newRecipe.content}
                        onChange={(e) => setNewRecipe(prev => ({ ...prev, content: e.target.value }))}
                        rows={4}
                        className="text-sm"
                      />
                    )}
                    
                    <Button onClick={addRecipe} disabled={!newRecipe.content.trim()}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add Recipe
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          ))}
        </div>

        {filteredMealItems.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            {searchTerm || selectedCategory !== 'All' 
              ? 'No meal items match your search criteria.' 
              : 'No meal items in your inventory yet. Add some above!'}
          </div>
        )}
      </div>
    </Card>
  );
};
