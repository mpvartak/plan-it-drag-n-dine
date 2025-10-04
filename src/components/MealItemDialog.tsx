import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Copy, Trash2 } from 'lucide-react';

interface MealItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemText: string;
  onDelete: () => void;
  onCopy: () => void;
}

export const MealItemDialog: React.FC<MealItemDialogProps> = ({
  open,
  onOpenChange,
  itemText,
  onDelete,
  onCopy,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Meal Item</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm whitespace-pre-wrap break-words">{itemText}</p>
          <div className="flex gap-2 justify-end">
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
