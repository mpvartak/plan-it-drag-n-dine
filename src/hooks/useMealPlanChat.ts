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

        // Call edge function with streaming
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meal-plan-chat`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({
              messages: recentMessages,
              weekStartDate: weekStart,
              userId: user.id,
            }),
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Process streaming response
        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let assistantContent = '';
        let assistantMessageId = `temp-assistant-${Date.now()}`;

        // Add assistant message placeholder
        setMessages((prev) => [
          ...prev,
          {
            id: assistantMessageId,
            role: 'assistant',
            content: '',
            created_at: new Date().toISOString(),
          },
        ]);

        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === 'data: [DONE]') continue;
            if (!trimmed.startsWith('data: ')) continue;

            try {
              const jsonStr = trimmed.slice(6);
              const parsed = JSON.parse(jsonStr);

              // Handle tool results
              if (parsed.type === 'tool_result') {
                console.log('Tool executed:', parsed.tool, parsed.result);
                // Trigger meal plan reload
                if (onMealPlanUpdate) {
                  onMealPlanUpdate();
                }
                continue;
              }

              // Handle content delta
              if (parsed.choices?.[0]?.delta?.content) {
                const delta = parsed.choices[0].delta.content;
                assistantContent += delta;

                // Update assistant message
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessageId
                      ? { ...m, content: assistantContent }
                      : m
                  )
                );
              }
            } catch (error) {
              console.error('Error parsing SSE:', error);
            }
          }
        }

        // Save assistant message to database
        if (assistantContent) {
          await saveMessage('assistant', assistantContent);
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
