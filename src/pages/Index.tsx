import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { MealPlanBuilder } from '@/components/MealPlanBuilder';
import { Button } from '@/components/ui/button';
import { LogOut, Menu, UtensilsCrossed } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useNavigate } from 'react-router-dom';

const Index = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [showRecipeInventory, setShowRecipeInventory] = useState(false);
  
  console.log('Index component - user:', user?.email, 'loading:', loading);

  useEffect(() => {
    if (!loading && !user) {
      window.location.href = '/auth';
    }
  }, [user, loading]);

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
          <h1 className="text-2xl font-bold">Meal Planner</h1>
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
                {!showRecipeInventory ? (
                  <DropdownMenuItem onClick={() => setShowRecipeInventory(true)}>
                    <UtensilsCrossed className="h-4 w-4 mr-2" />
                    Recipe Inventory
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => setShowRecipeInventory(false)}>
                    <UtensilsCrossed className="h-4 w-4 mr-2" />
                    Meal Plan
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => navigate('/settings')}>
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
      <main>
        <MealPlanBuilder 
          showRecipeInventory={showRecipeInventory}
          setShowRecipeInventory={setShowRecipeInventory}
        />
      </main>
    </div>
  );
};

export default Index;
