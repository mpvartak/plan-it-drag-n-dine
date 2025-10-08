import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { MealPlanBuilder } from '@/components/MealPlanBuilder';
import { Button } from '@/components/ui/button';
import { LogOut, Menu, UtensilsCrossed, Settings as SettingsIcon } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useNavigate } from 'react-router-dom';
import { FeedbackWidget } from '@/components/FeedbackWidget';
import backgroundImage from '@/assets/fruits-veggies-background.jpg';

const Index = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [showRecipeInventory, setShowRecipeInventory] = useState(false);
  const [showChat, setShowChat] = useState(false);

  // Check URL params for inventory parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('inventory') === 'true') {
      setShowRecipeInventory(true);
      // Clean up URL
      navigate('/', { replace: true });
    }
  }, [navigate]);

  // Listen for showInventory event
  useEffect(() => {
    const handleShowInventory = () => {
      setShowRecipeInventory(true);
    };

    window.addEventListener('showInventory', handleShowInventory);
    return () => {
      window.removeEventListener('showInventory', handleShowInventory);
    };
  }, []);
  
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
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 sm:py-4 flex items-center justify-between gap-2">
          <h1 className="text-lg sm:text-2xl font-bold truncate">Meal Planner</h1>
          <div className="flex items-center gap-2 sm:gap-4">
            <span className="text-xs sm:text-sm text-muted-foreground hidden md:inline truncate max-w-[150px]">
              {user.email}
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
                    Meal Item Inventory
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => setShowRecipeInventory(false)}>
                    <UtensilsCrossed className="h-4 w-4 mr-2" />
                    Meal Plan
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => navigate('/settings')}>
                  <SettingsIcon className="h-4 w-4 mr-2" />
                  Settings
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
      <main 
        className="pb-6 bg-cover bg-center bg-no-repeat" 
        style={{ backgroundImage: `url(${backgroundImage})` }}
      >
        <MealPlanBuilder 
          showRecipeInventory={showRecipeInventory}
          setShowRecipeInventory={setShowRecipeInventory}
          showChat={showChat}
          setShowChat={setShowChat}
        />
      </main>
      <FeedbackWidget variant="floating" />
    </div>
  );
};

export default Index;
