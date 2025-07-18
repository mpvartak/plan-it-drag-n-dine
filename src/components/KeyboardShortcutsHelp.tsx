
import React from 'react';
import { Card } from '@/components/ui/card';
import { Keyboard, Copy, Clipboard } from 'lucide-react';

export const KeyboardShortcutsHelp: React.FC = () => {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const ctrlKey = isMac ? 'Cmd' : 'Ctrl';

  return (
    <Card className="p-4 bg-muted/30">
      <div className="flex items-center gap-2 mb-3">
        <Keyboard className="h-4 w-4 text-primary" />
        <h3 className="font-medium text-sm">Keyboard Shortcuts</h3>
      </div>
      <div className="space-y-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Copy className="h-3 w-3" />
            <kbd className="px-1.5 py-0.5 text-xs font-mono bg-muted rounded">{ctrlKey}+C</kbd>
          </div>
          <span>Copy items from hovered cell</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Clipboard className="h-3 w-3" />
            <kbd className="px-1.5 py-0.5 text-xs font-mono bg-muted rounded">{ctrlKey}+V</kbd>
          </div>
          <span>Paste items to hovered cell</span>
        </div>
      </div>
    </Card>
  );
};
