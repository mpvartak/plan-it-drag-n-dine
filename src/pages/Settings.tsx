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
import { Plus, X, Menu, LogOut, UtensilsCrossed, Save, Loader2, AlertTriangle, Trash2, Refrigerator, Key, Copy, Eye, EyeOff } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { FeedbackWidget } from '@/components/FeedbackWidget';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  is_active: boolean;
}

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

  // API Keys state
  const [showCreateKeyDialog, setShowCreateKeyDialog] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyExpiry, setNewKeyExpiry] = useState('never');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [showGeneratedKey, setShowGeneratedKey] = useState(false);

  // Fetch API keys
  const { data: apiKeys = [], isLoading: isLoadingKeys, refetch: refetchKeys } = useQuery({
    queryKey: ['api-keys', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('user_api_keys')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as ApiKey[];
    },
    enabled: !!user,
  });

  // Create API key mutation
  const createKeyMutation = useMutation({
    mutationFn: async ({ name, expires_in_days }: { name: string; expires_in_days?: number }) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      const response = await fetch('https://eucwtwejktcjxowiybjy.supabase.co/functions/v1/generate-api-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ name, expires_in_days }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create API key');
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      setGeneratedKey(data.api_key);
      setShowGeneratedKey(true);
      setNewKeyName('');
      setNewKeyExpiry('never');
      refetchKeys();
      toast({
        title: 'API key created',
        description: 'Make sure to copy your key - it won\'t be shown again!',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Delete API key mutation
  const deleteKeyMutation = useMutation({
    mutationFn: async (keyId: string) => {
      const { error } = await supabase
        .from('user_api_keys')
        .delete()
        .eq('id', keyId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      refetchKeys();
      toast({
        title: 'API key deleted',
        description: 'The API key has been revoked.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete API key.',
        variant: 'destructive',
      });
    },
  });

  const handleCreateKey = () => {
    const expires_in_days = newKeyExpiry === 'never' ? undefined : parseInt(newKeyExpiry);
    createKeyMutation.mutate({ name: newKeyName, expires_in_days });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied to clipboard' });
  };

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

          {/* API Keys */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Key className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">API Keys</h2>
              </div>
              <Button onClick={() => setShowCreateKeyDialog(true)} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Create Key
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              API keys allow external apps (like ChatGPT) to access your meal planning data.
            </p>
            
            {isLoadingKeys ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading keys...
              </div>
            ) : apiKeys.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No API keys created yet.</p>
            ) : (
              <div className="space-y-3">
                {apiKeys.map((key) => (
                  <div key={key.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{key.name}</span>
                        {!key.is_active && (
                          <Badge variant="secondary" className="text-xs">Inactive</Badge>
                        )}
                        {key.expires_at && new Date(key.expires_at) < new Date() && (
                          <Badge variant="destructive" className="text-xs">Expired</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <code className="bg-muted px-1 rounded">{key.key_prefix}</code>
                        <span>Created {new Date(key.created_at).toLocaleDateString()}</span>
                        {key.last_used_at && (
                          <span>Last used {new Date(key.last_used_at).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => deleteKeyMutation.mutate(key.id)}
                      disabled={deleteKeyMutation.isPending}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
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

      {/* Create API Key Dialog */}
      <Dialog open={showCreateKeyDialog} onOpenChange={(open) => {
        setShowCreateKeyDialog(open);
        if (!open) {
          setNewKeyName('');
          setNewKeyExpiry('never');
          setGeneratedKey(null);
          setShowGeneratedKey(false);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              {generatedKey ? 'Your New API Key' : 'Create API Key'}
            </DialogTitle>
            <DialogDescription>
              {generatedKey 
                ? 'Copy your API key now. You won\'t be able to see it again!'
                : 'Create a new API key for external apps to access your data.'}
            </DialogDescription>
          </DialogHeader>
          
          {generatedKey ? (
            <div className="space-y-4 py-4">
              <div className="relative">
                <Input
                  value={showGeneratedKey ? generatedKey : '•'.repeat(40)}
                  readOnly
                  className="font-mono pr-20"
                />
                <div className="absolute right-1 top-1 flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowGeneratedKey(!showGeneratedKey)}
                    className="h-7 w-7 p-0"
                  >
                    {showGeneratedKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(generatedKey)}
                    className="h-7 w-7 p-0"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                This key won't be shown again. Save it securely!
              </p>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label htmlFor="key-name" className="text-sm font-medium">
                  Key Name
                </label>
                <Input
                  id="key-name"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="e.g., ChatGPT Actions"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="key-expiry" className="text-sm font-medium">
                  Expiration
                </label>
                <Select value={newKeyExpiry} onValueChange={setNewKeyExpiry}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="never">Never expires</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="90">90 days</SelectItem>
                    <SelectItem value="365">1 year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          
          <DialogFooter>
            {generatedKey ? (
              <Button onClick={() => {
                setShowCreateKeyDialog(false);
                setGeneratedKey(null);
                setShowGeneratedKey(false);
              }}>
                Done
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setShowCreateKeyDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateKey}
                  disabled={!newKeyName.trim() || createKeyMutation.isPending}
                >
                  {createKeyMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Key'
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Settings;