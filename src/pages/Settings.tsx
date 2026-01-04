import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Plus, X, Menu, LogOut, UtensilsCrossed, Save, Loader2, AlertTriangle, Trash2, Refrigerator } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { FeedbackWidget } from '@/components/FeedbackWidget';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const Settings = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Clear inventory dialog state
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [clearConfirmChecked, setClearConfirmChecked] = useState(false);
  const [clearConfirmText, setClearConfirmText] = useState('');
  
  const CONFIRM_PHRASE = 'I confirm';

  // Clear all inventory mutation
  const clearAllMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('inventory_items')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      toast({ title: 'Inventory cleared', description: 'All items have been permanently removed.' });
      setShowClearDialog(false);
      resetClearDialog();
    },
    onError: (error) => {
      toast({ title: 'Error', description: 'Failed to clear inventory.', variant: 'destructive' });
      console.error(error);
    },
  });

  const resetClearDialog = () => {
    setClearConfirmChecked(false);
    setClearConfirmText('');
  };

  const canClearInventory = clearConfirmChecked && clearConfirmText === CONFIRM_PHRASE;

  // Settings state
  const [firstDayOfWeek, setFirstDayOfWeek] = useState<string>(() => {
    return localStorage.getItem('mealPlan_firstDayOfWeek') || 'Monday';
  });
  
  const [customMealTypes, setCustomMealTypes] = useState<string[]>(() => {
    const stored = localStorage.getItem('mealPlan_customMealTypes');
    return stored ? JSON.parse(stored) : [];
  });
  
  const [newMealType, setNewMealType] = useState('');
  
  const [zipCode, setZipCode] = useState(() => {
    return localStorage.getItem('mealPlan_zipCode') || '';
  });

  const [mealPreferences, setMealPreferences] = useState('');
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);
  const [isLoadingPreferences, setIsLoadingPreferences] = useState(true);

  // Load meal preferences from database
  useEffect(() => {
    const loadPreferences = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('meal_preferences')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (error) {
          console.error('Error loading preferences:', error);
        } else if (data?.meal_preferences) {
          setMealPreferences(data.meal_preferences);
        }
      } catch (err) {
        console.error('Error loading preferences:', err);
      } finally {
        setIsLoadingPreferences(false);
      }
    };

    loadPreferences();
  }, [user]);

  const saveMealPreferences = async () => {
    if (!user) return;
    
    setIsSavingPreferences(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ meal_preferences: mealPreferences })
        .eq('user_id', user.id);
      
      if (error) throw error;
      
      toast({
        title: "Preferences saved",
        description: "Your meal planning preferences have been updated."
      });
    } catch (err) {
      console.error('Error saving preferences:', err);
      toast({
        title: "Error",
        description: "Failed to save preferences. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSavingPreferences(false);
    }
  };

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  // Save to localStorage whenever settings change
  useEffect(() => {
    localStorage.setItem('mealPlan_firstDayOfWeek', firstDayOfWeek);
  }, [firstDayOfWeek]);

  useEffect(() => {
    localStorage.setItem('mealPlan_customMealTypes', JSON.stringify(customMealTypes));
  }, [customMealTypes]);

  useEffect(() => {
    localStorage.setItem('mealPlan_zipCode', zipCode);
  }, [zipCode]);

  const addCustomMealType = () => {
    if (newMealType.trim() && !customMealTypes.includes(newMealType.trim())) {
      const mealType = newMealType.trim();
      setCustomMealTypes(prev => [...prev, mealType]);
      setNewMealType('');
      toast({
        title: "Meal type added",
        description: `${mealType} has been added to your meal plan.`
      });
    }
  };

  const removeCustomMealType = (mealTypeToRemove: string) => {
    setCustomMealTypes(prev => prev.filter(type => type !== mealTypeToRemove));
    toast({
      title: "Meal type removed",
      description: `${mealTypeToRemove} has been removed from your meal plan.`
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to auth
  }

  return (
    <div className="min-h-screen">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Settings</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              Welcome, {user.email}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Menu className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => navigate('/')}>
                  <UtensilsCrossed className="h-4 w-4 mr-2" />
                  Meal Plan
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/?inventory=true')}>
                  <UtensilsCrossed className="h-4 w-4 mr-2" />
                  Recipe Index
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/inventory')}>
                  <Refrigerator className="h-4 w-4 mr-2" />
                  Kitchen Inventory
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <FeedbackWidget variant="menu" />
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={signOut}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-8">
          {/* Weather Settings */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Weather</h2>
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Zip Code
              </label>
              <Input 
                value={zipCode} 
                onChange={e => setZipCode(e.target.value)} 
                placeholder="Enter zip code" 
              />
              <p className="text-xs text-muted-foreground mt-1">
                Enter your zip code to see weather information for each day
              </p>
            </div>
          </Card>

          {/* Meal Planning Preferences */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Meal Planning Preferences</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  General Principles
                </label>
                {isLoadingPreferences ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading preferences...
                  </div>
                ) : (
                  <Textarea
                    value={mealPreferences}
                    onChange={e => setMealPreferences(e.target.value)}
                    placeholder="Enter your meal planning guidelines. For example:
- Weekday school snacks should be cucumbers or carrots
- No red meat on Mondays
- Light dinners on workout days (Tue/Thu)
- Kids lunch should always include a fruit"
                    rows={6}
                    className="resize-none"
                  />
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  These preferences will be used by the AI assistant when suggesting meals
                </p>
              </div>
              <Button 
                onClick={saveMealPreferences} 
                disabled={isSavingPreferences || isLoadingPreferences}
                className="w-full sm:w-auto"
              >
                {isSavingPreferences ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Preferences
                  </>
                )}
              </Button>
            </div>
          </Card>

          {/* Week Settings */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Week Settings</h2>
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                First Day of Week
              </label>
              <Select value={firstDayOfWeek} onValueChange={setFirstDayOfWeek}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_DAYS.map(day => (
                    <SelectItem key={day} value={day}>{day}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Choose which day your meal planning week should start with
              </p>
            </div>
          </Card>

          {/* Custom Meal Types */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Custom Meal Types</h2>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input 
                  value={newMealType} 
                  onChange={e => setNewMealType(e.target.value)} 
                  placeholder="e.g., Afternoon Snack, Pre-workout" 
                  onKeyPress={e => e.key === 'Enter' && addCustomMealType()} 
                />
                <Button onClick={addCustomMealType} size="sm">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {customMealTypes.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Custom meal types:</p>
                  <div className="flex flex-wrap gap-2">
                    {customMealTypes.map(mealType => (
                      <Badge key={mealType} variant="secondary" className="flex items-center gap-1">
                        {mealType}
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => removeCustomMealType(mealType)} 
                          className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                        >
                          <X className="h-2 w-2" />
                        </Button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Keyboard Shortcuts */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Keyboard Shortcuts</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Copy items from cell</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs">Ctrl+C</kbd>
              </div>
              <div className="flex justify-between">
                <span>Paste items to cell</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs">Ctrl+V</kbd>
              </div>
              <div className="flex justify-between">
                <span>Add new item</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs">Enter</kbd>
              </div>
              <div className="flex justify-between">
                <span>Cancel adding</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs">Escape</kbd>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                💡 Hover over any meal cell to activate keyboard shortcuts for that cell.
              </p>
            </div>
          </Card>

          {/* Danger Zone */}
          <Card className="p-6 border-destructive/50">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <h2 className="text-xl font-semibold text-destructive">Danger Zone</h2>
            </div>
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border border-destructive/30 rounded-lg">
                <div>
                  <h3 className="font-medium">Clear Kitchen Inventory</h3>
                  <p className="text-sm text-muted-foreground">
                    Permanently delete all items from your kitchen inventory. This action cannot be undone.
                  </p>
                </div>
                <Button 
                  variant="destructive" 
                  onClick={() => setShowClearDialog(true)}
                  className="shrink-0"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear All Items
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </main>

      {/* Clear Inventory Confirmation Dialog */}
      <Dialog open={showClearDialog} onOpenChange={(open) => {
        setShowClearDialog(open);
        if (!open) resetClearDialog();
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Clear Kitchen Inventory
            </DialogTitle>
            <DialogDescription className="text-left pt-2">
              This will permanently delete <strong>all items</strong> from your kitchen inventory. 
              This action is irreversible and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="flex items-start space-x-3">
              <Checkbox
                id="confirm-delete"
                checked={clearConfirmChecked}
                onCheckedChange={(checked) => setClearConfirmChecked(checked === true)}
              />
              <label
                htmlFor="confirm-delete"
                className="text-sm leading-tight cursor-pointer"
              >
                Yes, I understand that all my kitchen inventory items will be permanently deleted and this cannot be undone.
              </label>
            </div>
            
            <div className="space-y-2">
              <label htmlFor="confirm-text" className="text-sm font-medium">
                Type <span className="font-mono bg-muted px-1 rounded">{CONFIRM_PHRASE}</span> to confirm:
              </label>
              <Input
                id="confirm-text"
                value={clearConfirmText}
                onChange={(e) => setClearConfirmText(e.target.value)}
                placeholder={CONFIRM_PHRASE}
                className={clearConfirmText === CONFIRM_PHRASE ? 'border-green-500' : ''}
              />
            </div>
          </div>
          
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setShowClearDialog(false);
                resetClearDialog();
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => clearAllMutation.mutate()}
              disabled={!canClearInventory || clearAllMutation.isPending}
            >
              {clearAllMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Clearing...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Permanently Delete All
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Settings;