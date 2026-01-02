import React, { useEffect, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Send, Trash2 } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

const formatDateLabel = (dateStr: string): string => {
  const date = parseISO(dateStr);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'EEEE, MMMM d');
};

const getDateKey = (dateStr: string): string => {
  return dateStr.split('T')[0];
};

interface ChatInterfaceProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSendMessage: (message: string) => void;
  weekStartDate: string;
}

export const ChatInterface = ({ messages, isLoading, onSendMessage, weekStartDate }: ChatInterfaceProps) => {
  const [input, setInput] = React.useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const [isClearing, setIsClearing] = React.useState(false);

  // Group messages by date
  const groupedMessages = useMemo(() => {
    const groups: { date: string; label: string; messages: ChatMessage[] }[] = [];
    let currentDateKey = '';

    messages.forEach((message) => {
      const dateKey = getDateKey(message.created_at);
      if (dateKey !== currentDateKey) {
        currentDateKey = dateKey;
        groups.push({
          date: dateKey,
          label: formatDateLabel(message.created_at),
          messages: [message],
        });
      } else {
        groups[groups.length - 1].messages.push(message);
      }
    });

    return groups;
  }, [messages]);

  const handleClearHistory = async () => {
    if (!user) return;
    
    setIsClearing(true);
    try {
      const { error } = await supabase
        .from('chat_messages')
        .delete()
        .eq('user_id', user.id)
        .eq('week_start_date', weekStartDate);

      if (error) throw error;

      toast({
        title: 'Chat history cleared',
        description: 'All messages for this week have been deleted.',
      });
      
      // Reload the page to refresh the chat
      window.location.reload();
    } catch (error) {
      console.error('Error clearing chat history:', error);
      toast({
        title: 'Failed to clear history',
        description: 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsClearing(false);
    }
  };

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    const container = scrollRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="grid grid-rows-[auto_minmax(0,1fr)_auto] h-full min-h-0">
      <div className="px-4 pt-4 pb-2 shrink-0 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Ask me about meals, inventory, or recipes
        </p>
        {messages.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                disabled={isClearing}
                className="h-8 px-2 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear chat history?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete all chat messages for this week. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearHistory} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Clear History
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* Messages */}
      <div className="h-full min-h-0 overflow-hidden">
        <div ref={scrollRef} className="h-full max-h-full overflow-y-auto px-4">
          <div className="space-y-4 py-4">
            {messages.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p className="mb-2">👋 Hi! I'm your meal planning assistant.</p>
              <p className="text-sm">Try asking me:</p>
              <ul className="text-sm mt-2 space-y-1">
                <li>"Add chicken tacos for Tuesday dinner"</li>
                <li>"What should I make for Monday lunch?"</li>
                <li>"Show me my meal inventory"</li>
                <li>"Add scrambled eggs to my inventory"</li>
                <li>"Do you have any pasta recipes?"</li>
              </ul>
            </div>
          )}

          {groupedMessages.map((group) => (
            <div key={group.date}>
              {/* Date separator */}
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground font-medium px-2">
                  {group.label}
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Messages for this date */}
              <div className="space-y-4">
                {group.messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {message.role === 'assistant' && (
                      <Avatar className="h-8 w-8 bg-primary text-primary-foreground flex items-center justify-center">
                        <span className="text-xs">AI</span>
                      </Avatar>
                    )}
                    <div
                      className={`rounded-lg px-4 py-2 max-w-[80%] ${
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    </div>
                    {message.role === 'user' && (
                      <Avatar className="h-8 w-8 bg-secondary text-secondary-foreground flex items-center justify-center">
                        <span className="text-xs">You</span>
                      </Avatar>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3 justify-start">
              <Avatar className="h-8 w-8 bg-primary text-primary-foreground flex items-center justify-center">
                <span className="text-xs">AI</span>
              </Avatar>
              <div className="rounded-lg px-4 py-2 bg-muted">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Thinking...</span>
                </div>
              </div>
            </div>
            )}
          </div>
        </div>
      </div>

      {/* Input */}
      <div className="p-4 border-t shrink-0">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about meals, inventory, or recipes..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" disabled={isLoading || !input.trim()} size="icon">
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
};
