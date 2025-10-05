import { useState } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { z } from 'zod';

const feedbackSchema = z.object({
  feedback_type: z.enum(['bug', 'feature', 'general']),
  message: z.string().trim().min(10, 'Message must be at least 10 characters').max(1000, 'Message must be less than 1000 characters'),
  user_email: z.string().email('Invalid email address').optional().or(z.literal('')),
});

interface FeedbackWidgetProps {
  variant?: 'floating' | 'menu';
}

export const FeedbackWidget = ({ variant = 'floating' }: FeedbackWidgetProps) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedbackType, setFeedbackType] = useState<string>('general');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState(user?.email || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: 'Error',
        description: 'You must be logged in to submit feedback',
        variant: 'destructive',
      });
      return;
    }

    // Validate input
    try {
      feedbackSchema.parse({
        feedback_type: feedbackType,
        message,
        user_email: email,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: 'Validation Error',
          description: error.errors[0].message,
          variant: 'destructive',
        });
        return;
      }
    }

    setLoading(true);

    try {
      const { error } = await supabase.from('feedback').insert({
        user_id: user.id,
        user_email: email || user.email,
        feedback_type: feedbackType,
        message: message.trim(),
        page_url: window.location.href,
        user_agent: navigator.userAgent,
        status: 'new',
      });

      if (error) throw error;

      toast({
        title: 'Feedback Submitted',
        description: 'Thank you for your feedback! We\'ll review it soon.',
      });

      // Reset form
      setMessage('');
      setFeedbackType('general');
      setOpen(false);
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit feedback. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const trigger = variant === 'floating' ? (
    <Button
      size="icon"
      className="fixed bottom-6 left-6 h-12 w-12 rounded-full shadow-lg z-50 hidden lg:flex"
      title="Send Feedback"
    >
      <MessageSquare className="h-5 w-5" />
    </Button>
  ) : (
    <div className="flex items-center w-full cursor-pointer">
      <MessageSquare className="h-4 w-4 mr-2" />
      Send Feedback
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Send Feedback</DialogTitle>
          <DialogDescription>
            Help us improve by sharing your thoughts, reporting bugs, or suggesting features.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email (optional)</Label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={255}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedback-type">Feedback Type</Label>
            <Select value={feedbackType} onValueChange={setFeedbackType}>
              <SelectTrigger id="feedback-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General Feedback</SelectItem>
                <SelectItem value="bug">Bug Report</SelectItem>
                <SelectItem value="feature">Feature Request</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              placeholder="Tell us what's on your mind..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              maxLength={1000}
              required
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground text-right">
              {message.length}/1000
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                'Sending...'
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Feedback
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
