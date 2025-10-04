import React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Copy, Maximize2, Minimize2, Trash2 } from 'lucide-react';

interface MealItemContextMenuProps {
  children: React.ReactNode;
  itemText: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onDelete: () => void;
  onCopy: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const MealItemContextMenu: React.FC<MealItemContextMenuProps> = ({
  children,
  itemText,
  isExpanded,
  onToggleExpand,
  onDelete,
  onCopy,
  open,
  onOpenChange,
}) => {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 touch-manipulation" align="start">
        <DropdownMenuItem
          onClick={onToggleExpand}
          className="min-h-[44px] flex items-center gap-2 cursor-pointer"
        >
          {isExpanded ? (
            <>
              <Minimize2 className="h-4 w-4" />
              <span>Collapse</span>
            </>
          ) : (
            <>
              <Maximize2 className="h-4 w-4" />
              <span>Expand</span>
            </>
          )}
        </DropdownMenuItem>
        
        <DropdownMenuItem
          onClick={onCopy}
          className="min-h-[44px] flex items-center gap-2 cursor-pointer"
        >
          <Copy className="h-4 w-4" />
          <span>Copy to Clipboard</span>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem
          onClick={onDelete}
          className="min-h-[44px] flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
          <span>Delete</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
