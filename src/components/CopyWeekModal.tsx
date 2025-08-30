import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { format, startOfWeek, subWeeks } from 'date-fns';
import { CalendarIcon, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CopyWeekModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCopyWeek: (fromWeekStart: Date, replaceAll: boolean) => void;
  currentWeekStart: Date;
  firstDayOfWeek: string;
}

const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const CopyWeekModal = ({ 
  open, 
  onOpenChange, 
  onCopyWeek, 
  currentWeekStart,
  firstDayOfWeek 
}: CopyWeekModalProps) => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [replaceAll, setReplaceAll] = useState(true);

  const calculateWeekStart = (date: Date) => {
    const firstDayIndex = ALL_DAYS.indexOf(firstDayOfWeek);
    const todayDayIndex = (date.getDay() + 6) % 7; // Convert Sunday=0 to Monday=0 format
    let daysSinceFirstDay = (todayDayIndex - firstDayIndex + 7) % 7;
    
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - daysSinceFirstDay);
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
  };

  const handleQuickCopy = (weeksBack: number) => {
    const fromWeekStart = subWeeks(currentWeekStart, weeksBack);
    onCopyWeek(fromWeekStart, replaceAll);
    onOpenChange(false);
  };

  const handleDateCopy = () => {
    if (selectedDate) {
      const fromWeekStart = calculateWeekStart(selectedDate);
      onCopyWeek(fromWeekStart, replaceAll);
      onOpenChange(false);
    }
  };

  const previousWeek = subWeeks(currentWeekStart, 1);
  const twoWeeksAgo = subWeeks(currentWeekStart, 2);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            Copy Meal Plan
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Quick options */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Quick copy from:</h4>
            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-between"
                onClick={() => handleQuickCopy(1)}
              >
                <span>Previous week</span>
                <Badge variant="secondary">
                  {format(previousWeek, 'MMM d')} - {format(new Date(previousWeek.getTime() + 6 * 24 * 60 * 60 * 1000), 'MMM d')}
                </Badge>
              </Button>
              
              <Button
                variant="outline"
                className="w-full justify-between"
                onClick={() => handleQuickCopy(2)}
              >
                <span>Two weeks ago</span>
                <Badge variant="secondary">
                  {format(twoWeeksAgo, 'MMM d')} - {format(new Date(twoWeeksAgo.getTime() + 6 * 24 * 60 * 60 * 1000), 'MMM d')}
                </Badge>
              </Button>
            </div>
          </div>

          {/* Custom date picker */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Or pick a specific week:</h4>
            <div className="flex flex-col items-center gap-3">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                className={cn("p-3 pointer-events-auto")}
                disabled={(date) => date >= currentWeekStart}
              />
              
              {selectedDate && (
                <div className="text-sm text-muted-foreground text-center">
                  Week starting: {format(calculateWeekStart(selectedDate), 'EEEE, MMM d, yyyy')}
                </div>
              )}
            </div>
          </div>

          {/* Copy options */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Copy options:</h4>
            <div className="space-y-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="copyOption"
                  checked={replaceAll}
                  onChange={() => setReplaceAll(true)}
                  className="w-4 h-4"
                />
                <span className="text-sm">Replace entire week</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="copyOption"
                  checked={!replaceAll}
                  onChange={() => setReplaceAll(false)}
                  className="w-4 h-4"
                />
                <span className="text-sm">Add to existing meals</span>
              </label>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancel
            </Button>
            {selectedDate && (
              <Button onClick={handleDateCopy} className="flex-1">
                Copy Week
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};