import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { ChatMessage } from '@/components/ChatInterface';

interface ChatContextOptions {
  onMealPlanUpdate?: () => void;
  onInventoryUpdate?: () => void;
}

interface ChatContextValue {
  messages: ChatMessage[];
  isLoading: boolean;
  sendMessage: (content: string) => Promise<void>;
  weekStartDate: Date;
  setWeekStartDate: (date: Date) => void;
  setCallbacks: (callbacks: ChatContextOptions) => void;
  clearMessages: () => void;
  firstDayOfWeek: string;
  setFirstDayOfWeek: (day: string) => void;
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

const formatLocalDate = (d: Date) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

// Calculate week start based on first day of week setting
const calculateWeekStart = (date: Date, firstDay: string) => {
  const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const today = new Date(date);
  const firstDayIndex = ALL_DAYS.indexOf(firstDay);
  const todayDayIndex = (today.getDay() + 6) % 7;
  
  let daysSinceFirstDay = (todayDayIndex - firstDayIndex + 7) % 7;
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - daysSinceFirstDay);
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
};

export const ChatProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [callbacks, setCallbacks] = useState<ChatContextOptions>({});
  
  const [firstDayOfWeek, setFirstDayOfWeek] = useState<string>(() => {
    return localStorage.getItem('mealPlan_firstDayOfWeek') || 'Monday';
  });
  
  const [weekStartDate, setWeekStartDate] = useState<Date>(() => {
    const storedFirstDay = localStorage.getItem('mealPlan_firstDayOfWeek') || 'Monday';
    return calculateWeekStart(new Date(), storedFirstDay);
  });

  const weekStart = weekStartDate.toISOString().split('T')[0];
  const clientToday = formatLocalDate(new Date());
  const clientTzOffsetMinutes = new Date().getTimezoneOffset();

  // Load chat history for user (last 10 days only)
  useEffect(() => {
    if (!user) return;

    const loadChatHistory = async () => {
      try {
        const tenDaysAgo = new Date();
        tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
        const cutoffDate = tenDaysAgo.toISOString();

        const { data, error } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('user_id', user.id)
          .gte('created_at', cutoffDate)
          .order('created_at', { ascending: true })
          .limit(50);

        if (error) throw error;

        if (data) {
          setMessages(data as ChatMessage[]);
        }
      } catch (error) {
        console.error('Error loading chat history:', error);
      }
    };

    loadChatHistory();
  }, [user]);

  // Listen for localStorage changes to firstDayOfWeek
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'mealPlan_firstDayOfWeek' && e.newValue) {
        setFirstDayOfWeek(e.newValue);
      }
    };

    const handleFocus = () => {
      const storedFirstDay = localStorage.getItem('mealPlan_firstDayOfWeek') || 'Monday';
      if (storedFirstDay !== firstDayOfWeek) {
        setFirstDayOfWeek(storedFirstDay);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [firstDayOfWeek]);

  // Save message to database
  const saveMessage = useCallback(
    async (role: 'user' | 'assistant', content: string) => {
      if (!user) return null;

      try {
        const { data, error } = await supabase
          .from('chat_messages')
          .insert({
            user_id: user.id,
            role,
            content,
            week_start_date: weekStart,
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      } catch (error) {
        console.error('Error saving message:', error);
        return null;
      }
    },
    [user, weekStart]
  );

  // Send message and get response
  const sendMessage = useCallback(
    async (content: string) => {
      if (!user || isLoading) return;

      setIsLoading(true);

      // Add user message immediately
      const userMessage: ChatMessage = {
        id: `temp-${Date.now()}`,
        role: 'user',
        content,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMessage]);

      try {
        // Save user message
        await saveMessage('user', content);

        // Prepare messages for API (last 20 messages for context)
        const recentMessages = messages.slice(-20).map((m) => ({
          role: m.role,
          content: m.content,
        }));
        recentMessages.push({ role: 'user', content });

        // Call edge function
        console.info('[meal-plan-chat] invoking', { clientToday, clientTzOffsetMinutes, firstDayOfWeek });
        const response = await supabase.functions.invoke('meal-plan-chat', {
          body: {
            messages: recentMessages,
            weekStartDate: weekStart,
            clientToday,
            clientTzOffsetMinutes,
            firstDayOfWeek,
          },
        });

        if (response.error) {
          console.error('Chat function error:', response.error);
          toast({
            title: 'AI error',
            description: response.error.message || 'Failed to get response',
            variant: 'destructive',
          });
          setMessages((prev) => prev.filter((m) => !m.id.startsWith('temp-')));
          setIsLoading(false);
          return;
        }

        const assistantContent = response.data?.content || '';

        if (assistantContent) {
          setMessages((prev) => [
            ...prev,
            {
              id: `assistant-${Date.now()}`,
              role: 'assistant',
              content: assistantContent,
              created_at: new Date().toISOString(),
            },
          ]);

          await saveMessage('assistant', assistantContent);
        }

        // Trigger callbacks if data was updated
        if (callbacks.onMealPlanUpdate && response.data?.mealPlanUpdated) {
          callbacks.onMealPlanUpdate();
        }

        if (callbacks.onInventoryUpdate && response.data?.inventoryUpdated) {
          callbacks.onInventoryUpdate();
        }
      } catch (error) {
        console.error('Error sending message:', error);
        toast({
          title: 'Error',
          description: 'Failed to send message. Please try again.',
          variant: 'destructive',
        });

        setMessages((prev) => prev.filter((m) => !m.id.startsWith('temp-')));
      } finally {
        setIsLoading(false);
      }
    },
    [user, isLoading, messages, weekStart, saveMessage, toast, callbacks, clientToday, clientTzOffsetMinutes, firstDayOfWeek]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const handleSetCallbacks = useCallback((newCallbacks: ChatContextOptions) => {
    setCallbacks(prev => ({ ...prev, ...newCallbacks }));
  }, []);

  return (
    <ChatContext.Provider
      value={{
        messages,
        isLoading,
        sendMessage,
        weekStartDate,
        setWeekStartDate,
        setCallbacks: handleSetCallbacks,
        clearMessages,
        firstDayOfWeek,
        setFirstDayOfWeek,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};
