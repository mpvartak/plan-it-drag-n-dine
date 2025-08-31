import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, X, Menu, LogOut, UtensilsCrossed } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const Settings = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

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
        </div>
      </main>
    </div>
  );
};

export default Settings;