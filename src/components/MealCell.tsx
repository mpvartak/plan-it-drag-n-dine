import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, X, GripVertical } from 'lucide-react';
import { MealItem } from './MealPlanBuilder';
import { useToast } from '@/hooks/use-toast';

interface MealCellProps {
  day: string;
  mealType: string;
  items: MealItem[];
  onItemsChange: (items: MealItem[]) => void;
}

export const MealCell: React.FC<MealCellProps> = ({
  day,
  mealType,
  items,
  onItemsChange,
}) => {
  const [newItemText, setNewItemText] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [draggedItem, setDraggedItem] = useState<MealItem | null>(null);
  const { toast } = useToast();

  const addItem = () => {
    if (newItemText.trim()) {
      const newItem: MealItem = {
        id: `${Date.now()}-${Math.random()}`,
        text: newItemText.trim(),
        isRecipe: false,
      };
      onItemsChange([...items, newItem]);
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

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, item: MealItem) => {
    setDraggedItem(item);
    e.dataTransfer.setData('text/plain', JSON.stringify(item));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    try {
      const droppedItemData = e.dataTransfer.getData('text/plain');
      if (droppedItemData) {
        const droppedItem: MealItem = JSON.parse(droppedItemData);
        
        // Check if the item is not already in this cell
        if (!items.find(item => item.id === droppedItem.id)) {
          // Create a new item with a new ID to avoid conflicts
          const newItem: MealItem = {
            ...droppedItem,
            id: `${Date.now()}-${Math.random()}`,
          };
          onItemsChange([...items, newItem]);
          
          toast({
            title: "Item moved",
            description: `"${newItem.text}" moved to ${day} ${mealType}.`,
          });
        }
      }
    } catch (error) {
      console.error('Error dropping item:', error);
    }
    setDraggedItem(null);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  return (
    <Card 
      className="p-3 min-h-24 transition-colors duration-200 hover:shadow-md"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            draggable
            onDragStart={(e) => handleDragStart(e, item)}
            onDragEnd={handleDragEnd}
            className="group flex items-center gap-2 p-2 rounded-md bg-muted/50 cursor-move hover:bg-muted transition-colors"
          >
            <GripVertical className="h-3 w-3 text-muted-foreground" />
            <Badge 
              variant={item.isRecipe ? 'default' : 'secondary'} 
              className="flex-1 justify-start"
            >
              {item.text}
            </Badge>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => removeItem(item.id)}
              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground"
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
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={addItem}>
                Add
              </Button>
              <Button size="sm" variant="outline" onClick={() => setIsAdding(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsAdding(true)}
            className="w-full border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 hover:bg-primary/5"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        )}
      </div>
    </Card>
  );
};