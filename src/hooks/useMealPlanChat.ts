import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { ChatMessage } from '@/components/ChatInterface';

export const useMealPlanChat = (weekStartDate: Date, onMealPlanUpdate?: () => void) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const weekStart = weekStartDate.toISOString().split('T')[0];

  // Load chat history for current week
  useEffect(() => {
    if (!user) return;

    const loadChatHistory = async () => {
      try {
        const { data, error } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('user_id', user.id)
          .eq('week_start_date', weekStart)
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
  }, [user, weekStart]);

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

  // Send message and stream response
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

        // Call edge function (userId extracted from JWT on backend)
        const response = await supabase.functions.invoke('meal-plan-chat', {
          body: {
            messages: recentMessages,
            weekStartDate: weekStart,
          },
          method: 'POST',
        });

        if (response.error) {
          console.error('Chat function error:', response.error);
          toast({
            title: 'AI error',
            description: response.error.message || 'Failed to get response',
            variant: 'destructive',
          });
          // Remove temp user message and stop
          setMessages((prev) => prev.filter((m) => !m.id.startsWith('temp-')));
          setIsLoading(false);
          return;
        }

        // For now, handle non-streaming response
        // The edge function should return the complete message
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
        
        // Trigger meal plan reload if chat updated it
        if (onMealPlanUpdate && response.data?.mealPlanUpdated) {
          onMealPlanUpdate();
        }

      } catch (error) {
        console.error('Error sending message:', error);
        toast({
          title: 'Error',
          description: 'Failed to send message. Please try again.',
          variant: 'destructive',
        });

        // Remove failed messages
        setMessages((prev) =>
          prev.filter((m) => !m.id.startsWith('temp-'))
        );
      } finally {
        setIsLoading(false);
      }
    },
    [user, isLoading, messages, weekStart, saveMessage, toast, onMealPlanUpdate]
  );

  return {
    messages,
    isLoading,
    sendMessage,
  };
};
