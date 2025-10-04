import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, X } from 'lucide-react';
import { MealItem } from './MealPlanBuilder';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { MealItemDialog } from './MealItemDialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface MealCellProps {
  day: string;
  mealType: string;
  items: MealItem[];
  onItemsChange: (items: MealItem[]) => void;
  onRemoveFromSource?: (sourceCell: string, itemId: string) => void;
  onAddToInventory?: (itemName: string) => void;
}

// Simple global clipboard - clean slate
let clipboard: MealItem[] = [];
let currentCell: string | null = null;

export const MealCell: React.FC<MealCellProps> = ({
  day,
  mealType,
  items,
  onItemsChange,
  onRemoveFromSource,
  onAddToInventory,
}) => {
  const [newItemText, setNewItemText] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [draggedItem, setDraggedItem] = useState<MealItem | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [dialogItemId, setDialogItemId] = useState<string | null>(null);
  const [inventoryItems, setInventoryItems] = useState<Array<{ id: string; name: string; image_url?: string }>>([]);
  const [filteredSuggestions, setFilteredSuggestions] = useState<Array<{ id: string; name: string; image_url?: string }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const cellRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const cellId = `${day}-${mealType}`;

  // Load inventory items from database
  useEffect(() => {
    const loadInventoryItems = async () => {
      if (!user) return;
      
      const { data, error } = await supabase
        .from('meal_items')
        .select('id, name, image_url')
        .eq('user_id', user.id);
      
      if (error) {
        console.error('Error loading inventory items:', error);
        return;
      }
      
      if (data) {
        setInventoryItems(data);
      }
    };
    
    loadInventoryItems();
  }, [user]);

  // Handle input change and filter suggestions
  const handleInputChange = (value: string) => {
    setNewItemText(value);
    
    if (value.trim().length === 0) {
      setFilteredSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    
    const filtered = inventoryItems
      .filter(item => item.name.toLowerCase().includes(value.toLowerCase()))
      .slice(0, 5);
    
    setFilteredSuggestions(filtered);
    setShowSuggestions(filtered.length > 0);
  };

  // Select a suggestion
  const selectSuggestion = (suggestion: { id: string; name: string; image_url?: string }) => {
    const newItem: MealItem = {
      id: `${cellId}-${Date.now()}-${Math.random()}`,
      text: suggestion.name,
      isRecipe: false,
      meal_item_id: suggestion.id,
      image_url: suggestion.image_url,
    };
    
    onItemsChange([...items, newItem]);
    setNewItemText('');
    setShowSuggestions(false);
    setIsAdding(false);
    
    toast({
      title: "Item added",
      description: `"${newItem.text}" added to ${day} ${mealType}.`,
    });
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        inputRef.current && !inputRef.current.contains(event.target as Node) &&
        suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Simple copy/paste functionality - rewritten from scratch
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only work if this cell is the current one (hovered or clicked)
      if (currentCell !== cellId) return;
      if (e.target instanceof HTMLInputElement) return;

      const isCtrlC = (e.ctrlKey || e.metaKey) && e.key === 'c';
      const isCtrlV = (e.ctrlKey || e.metaKey) && e.key === 'v';

      if (isCtrlC) {
        e.preventDefault();
        // Copy items from this cell
        clipboard = [...items];
        toast({
          title: "Copied!",
          description: `Copied ${items.length} items from ${day} ${mealType}`,
        });
      } else if (isCtrlV) {
        e.preventDefault();
        // Paste items to this cell
        if (clipboard.length === 0) {
          toast({
            title: "Nothing to paste",
            description: "Copy items first with Ctrl+C",
            variant: "destructive",
          });
          return;
        }

        // Create new items with unique IDs
        const newItems = clipboard.map((item, index) => ({
          ...item,
          id: `${cellId}-${Date.now()}-${index}`,
        }));

        // Add to existing items (avoid duplicates by text)
        const existingTexts = items.map(item => item.text.toLowerCase());
        const uniqueItems = newItems.filter(item => 
          !existingTexts.includes(item.text.toLowerCase())
        );

        if (uniqueItems.length > 0) {
          onItemsChange([...items, ...uniqueItems]);
          toast({
            title: "Pasted!",
            description: `Pasted ${uniqueItems.length} items to ${day} ${mealType}`,
          });
        } else {
          toast({
            title: "Already exists",
            description: "All items already exist in this cell",
            variant: "destructive",
          });
        }
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [cellId, items, day, mealType, onItemsChange, toast]);

  // Track current cell on hover and click
  const handleMouseEnter = () => {
    currentCell = cellId;
  };

  const handleMouseLeave = () => {
    if (currentCell === cellId) {
      currentCell = null;
    }
  };

  const handleClick = () => {
    currentCell = cellId;
  };

  const addItem = () => {
    if (newItemText.trim()) {
      const newItem: MealItem = {
        id: `${cellId}-${Date.now()}-${Math.random()}`,
        text: newItemText.trim(),
        isRecipe: false,
      };
      onItemsChange([...items, newItem]);
      
      if (onAddToInventory) {
        onAddToInventory(newItem.text);
      }
      
      setNewItemText('');
      setIsAdding(false);
      toast({
        title: "Item added",
        description: `"${newItem.text}" added to ${day} ${mealType}.`,
      });
    }
  };

  const removeItem = (itemId: string) => {
    onItemsChange(items.filter(item => item.id !== itemId));
  };

  const copyItemToClipboard = (itemText: string) => {
    clipboard = [{ id: `clipboard-${Date.now()}`, text: itemText, isRecipe: false }];
    setDialogItemId(null);
    toast({
      title: "Copied!",
      description: `"${itemText}" copied to clipboard`,
    });
  };

  const openDialog = (itemId: string) => {
    setDialogItemId(itemId);
  };

  const handleDragStart = (e: React.DragEvent, item: MealItem) => {
    console.log(`🎯 Drag started from ${cellId}:`, item);
    setDraggedItem(item);
    e.dataTransfer.setData('text/plain', JSON.stringify(item));
    e.dataTransfer.setData('application/x-source-cell', cellId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Check what type of data we're receiving
    const types = Array.from(e.dataTransfer.types);
    const isFromRecipe = types.includes('application/x-recipe-item');
    const hasSourceCell = types.includes('application/x-source-cell');
    
    console.log(`✨ Drag over ${cellId} - isFromRecipe: ${isFromRecipe}, hasSourceCell: ${hasSourceCell}`);
    
    // Set appropriate drop effect
    if (isFromRecipe) {
      e.dataTransfer.dropEffect = 'copy'; // Copy from inventory
    } else if (hasSourceCell) {
      e.dataTransfer.dropEffect = 'move'; // Move between cells
    } else {
      e.dataTransfer.dropEffect = 'copy'; // Default
    }
    
    if (!isDragOver) {
      setIsDragOver(true);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log(`🎯 Drag entered ${cellId}`);
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set isDragOver to false if we're leaving the cell completely
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      console.log(`🚪 Drag left ${cellId}`);
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log(`💧 Drop attempted on ${cellId}`);
    
    setIsDragOver(false);
    
    try {
      const droppedItemData = e.dataTransfer.getData('text/plain');
      const sourceCell = e.dataTransfer.getData('application/x-source-cell');
      const isFromRecipe = e.dataTransfer.getData('application/x-recipe-item');
      
      console.log('Drop data:', {
        droppedItemData: droppedItemData ? 'present' : 'missing',
        sourceCell,
        isFromRecipe,
        cellId
      });
      
      if (droppedItemData) {
        const droppedItem: MealItem = JSON.parse(droppedItemData);
        console.log('Parsed dropped item:', droppedItem);
        
        // Check if the item is not already in this cell
        const existingItem = items.find(item => item.id === droppedItem.id);
        if (!existingItem) {
          // If from inventory, always create new item with unique ID
          // If from another cell, use original item
          const finalItem = isFromRecipe ? {
            ...droppedItem,
            id: `${Date.now()}-${Math.random()}`,
          } : droppedItem;
          
          console.log('Adding item to cell:', finalItem);
          onItemsChange([...items, finalItem]);
          
          // Remove from source cell if moving between cells (not from inventory)
          if (sourceCell && onRemoveFromSource && !isFromRecipe) {
            console.log('Removing from source cell:', sourceCell, droppedItem.id);
            onRemoveFromSource(sourceCell, droppedItem.id);
          }
          
          toast({
            title: isFromRecipe ? "Recipe added" : (sourceCell ? "Item moved" : "Item added"),
            description: `"${finalItem.text}" ${isFromRecipe ? 'added' : (sourceCell ? 'moved' : 'added')} to ${day} ${mealType}.`,
          });
        } else {
          console.log('Item already exists in this cell:', existingItem);
          toast({
            title: "Item already exists",
            description: `"${droppedItem.text}" is already in ${day} ${mealType}.`,
            variant: "destructive",
          });
        }
      } else {
        console.error('No dropped item data found');
      }
    } catch (error) {
      console.error('Error dropping item:', error);
      toast({
        title: "Drop failed",
        description: "Failed to add item to meal plan. Please try again.",
        variant: "destructive",
      });
    }
    setDraggedItem(null);
  };

  const handleDragEnd = () => {
    console.log(`🏁 Drag ended from ${cellId}`);
    setDraggedItem(null);
    setIsDragOver(false);
  };

  return (
    <div 
      ref={cellRef}
      className={`p-2 sm:p-3 min-h-20 sm:min-h-24 bg-background border-r border-b border-border transition-all duration-200 cursor-pointer ${
        isDragOver ? 'bg-primary/5' : ''
      } ${
        currentCell === cellId ? 'bg-accent/20' : 'hover:bg-accent/5'
      }`}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      tabIndex={0}
    >
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            draggable
            onDragStart={(e) => handleDragStart(e, item)}
            onDragEnd={handleDragEnd}
            onClick={(e) => {
              e.stopPropagation();
              openDialog(item.id);
            }}
            className={cn(
              "p-2 sm:p-2.5 rounded-lg bg-primary text-primary-foreground transition-colors shadow-sm cursor-pointer",
              isMobile ? "touch-manipulation active:scale-[0.98]" : "hover:bg-primary/90"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="block text-xs sm:text-sm font-medium truncate">
                {item.text}
              </span>
              {item.image_url && (
                <img 
                  src={item.image_url} 
                  alt={item.text} 
                  className="w-8 h-8 object-cover rounded flex-shrink-0"
                />
              )}
            </div>
          </div>
        ))}
        
        {/* Dialog for viewing full item details */}
        {dialogItemId && (() => {
          const dialogItem = items.find(item => item.id === dialogItemId);
          return dialogItem ? (
            <MealItemDialog
              open={true}
              onOpenChange={(open) => !open && setDialogItemId(null)}
              itemText={dialogItem.text}
              imageUrl={dialogItem.image_url}
              mealItemId={dialogItem.meal_item_id}
              onDelete={() => removeItem(dialogItem.id)}
              onCopy={() => copyItemToClipboard(dialogItem.text)}
            />
          ) : null;
        })()}

        {isAdding ? (
          <div className="space-y-2 relative">
            <Input
              ref={inputRef}
              value={newItemText}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder="Enter meal..."
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  if (showSuggestions && filteredSuggestions.length > 0) {
                    selectSuggestion(filteredSuggestions[0]);
                  } else {
                    addItem();
                  }
                }
                if (e.key === 'Escape') {
                  setShowSuggestions(false);
                  setIsAdding(false);
                }
              }}
              autoFocus
              className="text-xs sm:text-sm border-border"
            />
            
            {/* Autocomplete suggestions */}
            {showSuggestions && filteredSuggestions.length > 0 && (
              <div 
                ref={suggestionsRef}
                className="absolute z-50 w-full bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-auto"
              >
                {filteredSuggestions.map((suggestion) => (
                  <div
                    key={suggestion.id}
                    onClick={() => selectSuggestion(suggestion)}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-accent cursor-pointer"
                  >
                    {suggestion.image_url && (
                      <img 
                        src={suggestion.image_url} 
                        alt={suggestion.name} 
                        className="w-8 h-8 object-cover rounded flex-shrink-0"
                      />
                    )}
                    <span className="text-xs sm:text-sm">{suggestion.name}</span>
                  </div>
                ))}
              </div>
            )}
            
            <div className="flex gap-2">
              <Button size="sm" onClick={addItem} className="text-xs flex-1 sm:flex-initial">
                Add
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setIsAdding(false); setShowSuggestions(false); }} className="text-xs flex-1 sm:flex-initial">
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsAdding(true)}
            className="w-full h-7 sm:h-8 border border-dashed border-border hover:border-primary/50 hover:bg-accent/50 text-muted-foreground"
            title="Add item"
          >
            <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
          </Button>
        )}

      </div>
    </div>
  );
};
