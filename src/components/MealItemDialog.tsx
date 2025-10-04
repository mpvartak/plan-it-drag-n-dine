import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Copy, Trash2, ExternalLink } from 'lucide-react';

interface MealItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemText: string;
  onDelete: () => void;
  onCopy: () => void;
  imageUrl?: string;
  mealItemId?: string;
}

export const MealItemDialog: React.FC<MealItemDialogProps> = ({
  open,
  onOpenChange,
  itemText,
  onDelete,
  onCopy,
  imageUrl,
  mealItemId,
}) => {
  const handleViewDetails = () => {
    console.log('🔘 View Details clicked, mealItemId:', mealItemId);
    if (mealItemId) {
      // Persist pending id as a fallback in case the event fires before the listener mounts
      try { sessionStorage.setItem('pendingMealItemId', mealItemId); } catch {}

      console.log('🔘 Dispatching showInventory + openMealItemInventory');
      // First, trigger showing the inventory
      window.dispatchEvent(new CustomEvent('showInventory'));
      
      // Then after a short delay, open the specific item
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('openMealItemInventory', {
          detail: { meal_item_id: mealItemId }
        }));
      }, 250);
      
      onOpenChange(false);
    } else {
      console.log('❌ No mealItemId provided');
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Meal Item</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {imageUrl && (
            <div className="flex justify-center">
              <img 
                src={imageUrl} 
                alt={itemText} 
                className="w-48 h-48 object-cover rounded-lg"
              />
            </div>
          )}
          <p className="text-sm whitespace-pre-wrap break-words">{itemText}</p>
          <div className="flex gap-2 justify-end">
            {mealItemId && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleViewDetails}
                className="gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                View Details
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onCopy();
                onOpenChange(false);
              }}
              className="gap-2"
            >
              <Copy className="h-4 w-4" />
              Copy
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                onDelete();
                onOpenChange(false);
              }}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
