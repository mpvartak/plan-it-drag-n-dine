
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Plus, X, ChefHat, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export interface Recipe {
  id: string;
  name: string;
  category: string;
  ingredients?: string[];
  instructions?: string;
}

const DEFAULT_RECIPES: Recipe[] = [
  {
    id: '1',
    name: 'Overnight Oats',
    category: 'Breakfast',
    ingredients: ['oats', 'milk', 'honey', 'fruits'],
  },
  {
    id: '2',
    name: 'Grilled Chicken Salad',
    category: 'Lunch',
    ingredients: ['chicken breast', 'mixed greens', 'cherry tomatoes', 'olive oil'],
  },
  {
    id: '3',
    name: 'Spaghetti Bolognese',
    category: 'Dinner',
    ingredients: ['spaghetti', 'ground beef', 'tomato sauce', 'onions'],
  },
  {
    id: '4',
    name: 'Apple Slices with Peanut Butter',
    category: 'Snack',
    ingredients: ['apple', 'peanut butter'],
  },
  {
    id: '5',
    name: 'Greek Yogurt Parfait',
    category: 'Breakfast',
    ingredients: ['greek yogurt', 'granola', 'berries', 'honey'],
  },
  {
    id: '6',
    name: 'Turkey Sandwich',
    category: 'Lunch',
    ingredients: ['whole grain bread', 'turkey', 'lettuce', 'tomato'],
  },
];

export const RecipeInventory: React.FC = () => {
  const [recipes, setRecipes] = useState<Recipe[]>(DEFAULT_RECIPES);
  const [newRecipe, setNewRecipe] = useState({ name: '', category: 'Breakfast' });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [draggedRecipe, setDraggedRecipe] = useState<Recipe | null>(null);
  const { toast } = useToast();

  // Listen for add to inventory events
  React.useEffect(() => {
    const handleAddToInventory = (event: CustomEvent) => {
      const itemName = event.detail;
      if (itemName && typeof itemName === 'string') {
        // Check if recipe already exists
        const existingRecipe = recipes.find(r => r.name.toLowerCase() === itemName.toLowerCase());
        if (!existingRecipe) {
          const newRecipe: Recipe = {
            id: `recipe-${Date.now()}`,
            name: itemName,
            category: 'Lunch', // Default category for meal plan items
          };
          setRecipes(prev => [...prev, newRecipe]);
          toast({
            title: "Added to inventory",
            description: `"${itemName}" has been added to your recipe inventory.`,
          });
        }
      }
    };

    window.addEventListener('addToInventory', handleAddToInventory as EventListener);
    return () => {
      window.removeEventListener('addToInventory', handleAddToInventory as EventListener);
    };
  }, [recipes, toast]);

  const categories = ['All', 'Breakfast', 'Lunch', 'Dinner', 'Snack'];

  const addRecipe = () => {
    if (newRecipe.name.trim()) {
      const recipe: Recipe = {
        id: `recipe-${Date.now()}`,
        name: newRecipe.name.trim(),
        category: newRecipe.category,
      };
      setRecipes(prev => [...prev, recipe]);
      setNewRecipe({ name: '', category: 'Breakfast' });
      toast({
        title: "Recipe added",
        description: `"${recipe.name}" has been added to your inventory.`,
      });
    }
  };

  const removeRecipe = (recipeId: string) => {
    const recipe = recipes.find(r => r.id === recipeId);
    setRecipes(prev => prev.filter(r => r.id !== recipeId));
    if (recipe) {
      toast({
        title: "Recipe removed",
        description: `"${recipe.name}" has been removed from your inventory.`,
      });
    }
  };

  const filteredRecipes = recipes.filter(recipe => {
    const matchesSearch = recipe.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || recipe.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleDragStart = (e: React.DragEvent, recipe: Recipe) => {
    console.log('🚀 Starting drag from inventory:', recipe.name);
    
    setDraggedRecipe(recipe);
    
    const mealItem = {
      id: `recipe-${recipe.id}-${Date.now()}`,
      text: recipe.name,
      isRecipe: true,
      recipeId: recipe.id,
    };
    
    // Set multiple data formats for better compatibility
    e.dataTransfer.setData('text/plain', JSON.stringify(mealItem));
    e.dataTransfer.setData('application/x-recipe-item', 'true');
    e.dataTransfer.setData('application/json', JSON.stringify(mealItem));
    
    // Set the effect to copy since we're copying from inventory
    e.dataTransfer.effectAllowed = 'copy';
    
    console.log('📦 Data set for drag:', {
      mealItem,
      effectAllowed: e.dataTransfer.effectAllowed,
    });
    
    // Add visual feedback
    (e.currentTarget as HTMLElement).style.opacity = '0.5';
  };

  const handleDragEnd = (e: React.DragEvent) => {
    console.log('🏁 Drag ended from inventory');
    setDraggedRecipe(null);
    // Reset visual feedback
    (e.currentTarget as HTMLElement).style.opacity = '1';
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <ChefHat className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold text-foreground">Recipe Inventory</h2>
          {draggedRecipe && (
            <Badge variant="outline" className="animate-pulse">
              Dragging: {draggedRecipe.name}
            </Badge>
          )}
        </div>
        
        <p className="text-muted-foreground">
          Drag recipes from here to your meal plan, or add new recipes to your collection.
        </p>

        {/* Add new recipe */}
        <div className="flex gap-2 p-4 bg-muted/30 rounded-lg">
          <div className="flex-1">
            <Input
              value={newRecipe.name}
              onChange={(e) => setNewRecipe(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter recipe name..."
              onKeyPress={(e) => e.key === 'Enter' && addRecipe()}
            />
          </div>
          <select
            value={newRecipe.category}
            onChange={(e) => setNewRecipe(prev => ({ ...prev, category: e.target.value }))}
            className="px-3 py-2 border border-input bg-background rounded-md text-sm"
          >
            {categories.slice(1).map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
          <Button onClick={addRecipe}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <Separator />

        {/* Search and filter */}
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search recipes..."
              className="pl-10"
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

        {/* Recipe grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredRecipes.map(recipe => (
            <div
              key={recipe.id}
              draggable
              onDragStart={(e) => handleDragStart(e, recipe)}
              onDragEnd={handleDragEnd}
              className={`group p-3 border border-border rounded-lg cursor-move hover:border-primary hover:shadow-lg transition-all duration-200 bg-card ${
                draggedRecipe?.id === recipe.id ? 'opacity-50 scale-95' : 'hover:scale-105'
              }`}
              title="Drag to meal plan"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-card-foreground truncate">{recipe.name}</h4>
                  <Badge variant="outline" className="mt-1 text-xs">
                    {recipe.category}
                  </Badge>
                  {recipe.ingredients && (
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                      {recipe.ingredients.join(', ')}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeRecipe(recipe.id);
                  }}
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {filteredRecipes.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            {searchTerm || selectedCategory !== 'All' 
              ? 'No recipes match your search criteria.' 
              : 'No recipes in your inventory yet. Add some above!'}
          </div>
        )}
      </div>
    </Card>
  );
};
