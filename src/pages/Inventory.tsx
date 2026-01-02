import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { Plus, Trash2, Edit2, CalendarIcon, ArrowLeft, Menu, LogOut, Settings as SettingsIcon, AlertTriangle, Search, Refrigerator, Snowflake, Package, ChefHat, X, ArrowUpDown } from 'lucide-react';
import { format, differenceInDays, isPast, addDays } from 'date-fns';
import { cn } from '@/lib/utils';
import backgroundImage from '@/assets/fruits-veggies-background.jpg';
import { ChatInterface } from '@/components/ChatInterface';
import { useChat } from '@/contexts/ChatContext';

type InventoryLocation = 'fridge' | 'freezer' | 'pantry';

interface InventoryItem {
  id: string;
  user_id: string;
  name: string;
  quantity: number;
  unit: string | null;
  location: InventoryLocation;
  expiration_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const locationIcons = {
  fridge: Refrigerator,
  freezer: Snowflake,
  pantry: Package,
};

const locationLabels = {
  fridge: 'Fridge',
  freezer: 'Freezer',
  pantry: 'Pantry',
};

const locationColors = {
  fridge: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  freezer: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
  pantry: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
};

// Parse DATE-only strings (YYYY-MM-DD) as local dates to avoid timezone shifting (off-by-one).
const parseDateOnly = (dateStr: string): Date => {
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(dateStr);
};

const Inventory = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | InventoryLocation>('all');
  const [showChat, setShowChat] = useState(false);
  const [sortByExpiration, setSortByExpiration] = useState<'none' | 'asc' | 'desc'>('none');
  
  // Form state
  const [formName, setFormName] = useState('');
  const [formQuantity, setFormQuantity] = useState('1');
  const [formUnit, setFormUnit] = useState('');
  const [formLocation, setFormLocation] = useState<InventoryLocation>('fridge');
  const [formExpirationDate, setFormExpirationDate] = useState<Date | undefined>();
  const [formNotes, setFormNotes] = useState('');

  // Chat hook for AI sous chef - use global chat context
  const { messages, isLoading: isChatLoading, sendMessage, setCallbacks, weekStartDate: currentWeekStart } = useChat();
  
  // Register inventory update callback
  useEffect(() => {
    setCallbacks({
      onInventoryUpdate: () => queryClient.invalidateQueries({ queryKey: ['inventory-items'] }),
    });
  }, [setCallbacks, queryClient]);

  // Fetch inventory items
  const { data: inventoryItems = [], isLoading: isLoadingItems } = useQuery({
    queryKey: ['inventory-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as InventoryItem[];
    },
    enabled: !!user,
  });

  // Add item mutation
  const addItemMutation = useMutation({
    mutationFn: async (newItem: Omit<InventoryItem, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('inventory_items')
        .insert(newItem)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      toast({ title: 'Item added', description: 'Inventory item added successfully.' });
      resetForm();
      setIsAddDialogOpen(false);
    },
    onError: (error) => {
      toast({ title: 'Error', description: 'Failed to add item.', variant: 'destructive' });
      console.error(error);
    },
  });

  // Update item mutation
  const updateItemMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<InventoryItem> & { id: string }) => {
      const { data, error } = await supabase
        .from('inventory_items')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      toast({ title: 'Item updated', description: 'Inventory item updated successfully.' });
      resetForm();
      setEditingItem(null);
    },
    onError: (error) => {
      toast({ title: 'Error', description: 'Failed to update item.', variant: 'destructive' });
      console.error(error);
    },
  });

  // Delete item mutation
  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('inventory_items')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      toast({ title: 'Item deleted', description: 'Inventory item removed.' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: 'Failed to delete item.', variant: 'destructive' });
      console.error(error);
    },
  });


  const resetForm = () => {
    setFormName('');
    setFormQuantity('1');
    setFormUnit('');
    setFormLocation('fridge');
    setFormExpirationDate(undefined);
    setFormNotes('');
  };

  const openEditDialog = (item: InventoryItem) => {
    setEditingItem(item);
    setFormName(item.name);
    setFormQuantity(String(item.quantity));
    setFormUnit(item.unit || '');
    setFormLocation(item.location);
    setFormExpirationDate(item.expiration_date ? parseDateOnly(item.expiration_date) : undefined);
    setFormNotes(item.notes || '');
  };

  const handleSubmit = () => {
    if (!formName.trim()) {
      toast({ title: 'Error', description: 'Please enter an item name.', variant: 'destructive' });
      return;
    }

    const itemData = {
      user_id: user!.id,
      name: formName.trim(),
      quantity: parseFloat(formQuantity) || 1,
      unit: formUnit.trim() || null,
      location: formLocation,
      expiration_date: formExpirationDate ? format(formExpirationDate, 'yyyy-MM-dd') : null,
      notes: formNotes.trim() || null,
    };

    if (editingItem) {
      updateItemMutation.mutate({ id: editingItem.id, ...itemData });
    } else {
      addItemMutation.mutate(itemData);
    }
  };

  // Count items by location
  const locationCounts = useMemo(() => {
    const counts = { all: inventoryItems.length, fridge: 0, freezer: 0, pantry: 0 };
    inventoryItems.forEach(item => {
      counts[item.location]++;
    });
    return counts;
  }, [inventoryItems]);

  // Filter and group items
  const filteredItems = useMemo(() => {
    let items = inventoryItems;
    
    if (searchQuery) {
      items = items.filter(item => 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.notes?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    if (activeTab !== 'all') {
      items = items.filter(item => item.location === activeTab);
    }

    // Sort by expiration date if enabled
    if (sortByExpiration !== 'none') {
      items = [...items].sort((a, b) => {
        // Items without expiration date go to the end
        if (!a.expiration_date && !b.expiration_date) return 0;
        if (!a.expiration_date) return 1;
        if (!b.expiration_date) return -1;
        
        const dateA = parseDateOnly(a.expiration_date).getTime();
        const dateB = parseDateOnly(b.expiration_date).getTime();
        return sortByExpiration === 'asc' ? dateA - dateB : dateB - dateA;
      });
    }
    
    return items;
  }, [inventoryItems, searchQuery, activeTab, sortByExpiration]);

  const toggleExpirationSort = () => {
    setSortByExpiration(prev => {
      if (prev === 'none') return 'asc';
      if (prev === 'asc') return 'desc';
      return 'none';
    });
  };

  // Get expiration status
  const getExpirationStatus = (expirationDate: string | null) => {
    if (!expirationDate) return null;

    const expDate = parseDateOnly(expirationDate);
    expDate.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (isPast(expDate) && differenceInDays(today, expDate) > 0) {
      return 'expired';
    }

    const daysUntilExpiry = differenceInDays(expDate, today);
    if (daysUntilExpiry <= 3) {
      return 'expiring-soon';
    }
    if (daysUntilExpiry <= 7) {
      return 'expiring-week';
    }

    return 'ok';
  };

  const expirationBadge = (status: string | null, date: string) => {
    if (!status) return null;

    const formattedDate = format(parseDateOnly(date), 'MMM d');
    
    switch (status) {
      case 'expired':
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            Expired {formattedDate}
          </Badge>
        );
      case 'expiring-soon':
        return (
          <Badge className="gap-1 bg-orange-500 hover:bg-orange-600">
            <AlertTriangle className="h-3 w-3" />
            Expires {formattedDate}
          </Badge>
        );
      case 'expiring-week':
        return (
          <Badge variant="secondary" className="gap-1">
            Expires {formattedDate}
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="gap-1">
            {formattedDate}
          </Badge>
        );
    }
  };

  // Count items by status
  const statusCounts = useMemo(() => {
    const counts = { expired: 0, expiringSoon: 0 };
    inventoryItems.forEach(item => {
      const status = getExpirationStatus(item.expiration_date);
      if (status === 'expired') counts.expired++;
      else if (status === 'expiring-soon') counts.expiringSoon++;
    });
    return counts;
  }, [inventoryItems]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    navigate('/auth');
    return null;
  }

  return (
    <div className="min-h-screen">
      <header className="border-b bg-breakfast sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 sm:py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-lg sm:text-2xl font-bold text-breakfast-foreground">Kitchen Inventory</h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Menu className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => navigate('/')}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Meal Plan
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/settings')}>
                  <SettingsIcon className="h-4 w-4 mr-2" />
                  Settings
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

      <main 
        className="pb-6 min-h-screen bg-cover bg-center bg-no-repeat" 
        style={{ backgroundImage: `url(${backgroundImage})` }}
      >
        <div className="container mx-auto px-4 py-6">
          {/* Summary alerts */}
          {(statusCounts.expired > 0 || statusCounts.expiringSoon > 0) && (
            <div className="mb-4 flex flex-wrap gap-2">
              {statusCounts.expired > 0 && (
                <Badge variant="destructive" className="gap-1 text-sm py-1 px-3">
                  <AlertTriangle className="h-3 w-3" />
                  {statusCounts.expired} expired item{statusCounts.expired > 1 ? 's' : ''}
                </Badge>
              )}
              {statusCounts.expiringSoon > 0 && (
                <Badge className="gap-1 text-sm py-1 px-3 bg-orange-500 hover:bg-orange-600">
                  <AlertTriangle className="h-3 w-3" />
                  {statusCounts.expiringSoon} item{statusCounts.expiringSoon > 1 ? 's' : ''} expiring soon
                </Badge>
              )}
            </div>
          )}

          {/* Search and Add */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search inventory..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-background/95"
              />
            </div>
            <Dialog open={isAddDialogOpen || !!editingItem} onOpenChange={(open) => {
              if (!open) {
                setIsAddDialogOpen(false);
                setEditingItem(null);
                resetForm();
              } else {
                setIsAddDialogOpen(true);
              }
            }}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Item
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>{editingItem ? 'Edit Item' : 'Add Inventory Item'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Item Name *</Label>
                    <Input
                      id="name"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="e.g., Milk, Chicken breast, Rice"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="quantity">Quantity</Label>
                      <Input
                        id="quantity"
                        type="number"
                        min="0"
                        step="0.1"
                        value={formQuantity}
                        onChange={(e) => setFormQuantity(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="unit">Unit</Label>
                      <Input
                        id="unit"
                        value={formUnit}
                        onChange={(e) => setFormUnit(e.target.value)}
                        placeholder="e.g., lbs, oz, items"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Select value={formLocation} onValueChange={(v) => setFormLocation(v as InventoryLocation)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fridge">
                          <div className="flex items-center gap-2">
                            <Refrigerator className="h-4 w-4" />
                            Fridge
                          </div>
                        </SelectItem>
                        <SelectItem value="freezer">
                          <div className="flex items-center gap-2">
                            <Snowflake className="h-4 w-4" />
                            Freezer
                          </div>
                        </SelectItem>
                        <SelectItem value="pantry">
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4" />
                            Pantry
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Expiration Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !formExpirationDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formExpirationDate ? format(formExpirationDate, "PPP") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 z-[100]" align="start">
                        <Calendar
                          mode="single"
                          selected={formExpirationDate}
                          onSelect={setFormExpirationDate}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                    {formExpirationDate && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setFormExpirationDate(undefined)}
                        className="text-xs"
                      >
                        Clear date
                      </Button>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Input
                      id="notes"
                      value={formNotes}
                      onChange={(e) => setFormNotes(e.target.value)}
                      placeholder="Optional notes..."
                    />
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DialogClose>
                  <Button onClick={handleSubmit} disabled={addItemMutation.isPending || updateItemMutation.isPending}>
                    {editingItem ? 'Save Changes' : 'Add Item'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Item counts summary */}
          <Card className="mb-4 bg-background/95">
            <CardContent className="py-3 px-4">
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <div className="font-medium">
                  Total: <span className="text-primary">{locationCounts.all} items</span>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Refrigerator className="h-4 w-4" />
                  <span>{locationCounts.fridge}</span>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Snowflake className="h-4 w-4" />
                  <span>{locationCounts.freezer}</span>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Package className="h-4 w-4" />
                  <span>{locationCounts.pantry}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Location tabs and sort */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="flex-1">
              <TabsList className="grid grid-cols-4 w-full max-w-md bg-background/95">
                <TabsTrigger value="all">All ({locationCounts.all})</TabsTrigger>
                <TabsTrigger value="fridge" className="gap-1">
                  <Refrigerator className="h-3 w-3 hidden sm:inline" />
                  Fridge ({locationCounts.fridge})
                </TabsTrigger>
                <TabsTrigger value="freezer" className="gap-1">
                  <Snowflake className="h-3 w-3 hidden sm:inline" />
                  Freezer ({locationCounts.freezer})
                </TabsTrigger>
                <TabsTrigger value="pantry" className="gap-1">
                  <Package className="h-3 w-3 hidden sm:inline" />
                  Pantry ({locationCounts.pantry})
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Button
              variant={sortByExpiration !== 'none' ? 'secondary' : 'outline'}
              size="sm"
              onClick={toggleExpirationSort}
              className="gap-2 shrink-0 bg-background/95"
            >
              <ArrowUpDown className="h-4 w-4" />
              Expiry {sortByExpiration === 'asc' ? '↑' : sortByExpiration === 'desc' ? '↓' : ''}
            </Button>
          </div>

          {/* Inventory list */}
          {isLoadingItems ? (
            <div className="text-center py-8 text-muted-foreground">Loading inventory...</div>
          ) : filteredItems.length === 0 ? (
            <Card className="bg-background/95">
              <CardContent className="py-8 text-center text-muted-foreground">
                {searchQuery ? 'No items match your search.' : 'No items in inventory. Add some!'}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredItems.map((item) => {
                const expirationStatus = getExpirationStatus(item.expiration_date);
                const LocationIcon = locationIcons[item.location];
                
                return (
                  <Card 
                    key={item.id} 
                    className={cn(
                      "bg-background/95 transition-all",
                      expirationStatus === 'expired' && "ring-2 ring-destructive/50",
                      expirationStatus === 'expiring-soon' && "ring-2 ring-orange-500/50"
                    )}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium truncate">{item.name}</h3>
                          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                            <span>{item.quantity}{item.unit ? ` ${item.unit}` : ''}</span>
                            <Badge variant="outline" className={cn("text-xs", locationColors[item.location])}>
                              <LocationIcon className="h-3 w-3 mr-1" />
                              {locationLabels[item.location]}
                            </Badge>
                          </div>
                          {item.expiration_date && (
                            <div className="mt-2">
                              {expirationBadge(expirationStatus, item.expiration_date)}
                            </div>
                          )}
                          {item.notes && (
                            <p className="text-xs text-muted-foreground mt-2 truncate">{item.notes}</p>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={() => openEditDialog(item)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => deleteItemMutation.mutate(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* AI Sous Chef Floating Button */}
      <Button
        size="icon"
        onClick={() => setShowChat(true)}
        className="fixed bottom-6 right-6 h-12 w-12 rounded-full shadow-lg z-50 flex hover:scale-110 active:scale-95 transition-transform"
        title="AI Sous Chef"
      >
        <ChefHat className="h-5 w-5" />
      </Button>

      {/* AI Sous Chef Chat Sheet */}
      <Sheet open={showChat} onOpenChange={setShowChat}>
        <SheetContent 
          side="right" 
          className="w-full sm:max-w-md p-0 flex flex-col h-full"
        >
          <SheetHeader className="p-4 border-b shrink-0">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2">
                <ChefHat className="h-5 w-5" />
                AI Sous Chef
              </SheetTitle>
              <Button variant="ghost" size="icon" onClick={() => setShowChat(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </SheetHeader>
          <div className="flex-1 min-h-0">
            <ChatInterface
              messages={messages}
              isLoading={isChatLoading}
              onSendMessage={sendMessage}
              weekStartDate={currentWeekStart.toISOString().split('T')[0]}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Inventory;