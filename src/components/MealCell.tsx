import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, X, GripVertical } from 'lucide-react';
import { MealItem } from './MealPlanBuilder';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

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
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const { toast } = useToast();
  const cellRef = useRef<HTMLDivElement>(null);

  const cellId = `${day}-${mealType}`;

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
      className={`p-3 min-h-24 bg-background border-r border-b border-border transition-all duration-200 cursor-pointer ${
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
            className="group flex items-center gap-2 p-2.5 rounded-lg bg-primary text-primary-foreground cursor-move hover:bg-primary/90 transition-colors shadow-sm"
          >
            <GripVertical className="h-3.5 w-3.5 shrink-0 opacity-60" />
            <span 
              className={cn(
                "flex-1 min-w-0 text-sm font-medium cursor-pointer",
                expandedItemId === item.id ? "whitespace-normal" : "truncate"
              )}
              onClick={(e) => {
                e.stopPropagation();
                setExpandedItemId(expandedItemId === item.id ? null : item.id);
              }}
            >
              {item.text}
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => removeItem(item.id)}
              className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary-foreground/20"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))}

        {isAdding ? (
          <div className="space-y-2">
            <Input
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              placeholder="Enter meal or recipe name..."
              onKeyPress={(e) => {
                if (e.key === 'Enter') addItem();
                if (e.key === 'Escape') setIsAdding(false);
              }}
              autoFocus
              className="text-sm border-border"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={addItem} className="text-xs">
                Add
              </Button>
              <Button size="sm" variant="outline" onClick={() => setIsAdding(false)} className="text-xs">
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsAdding(true)}
            className="w-full h-8 border border-dashed border-border hover:border-primary/50 hover:bg-accent/50 text-muted-foreground"
            title="Add item"
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}

      </div>
    </div>
  );
};
