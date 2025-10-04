-- Add delete policy for chat messages so users can delete their own messages
CREATE POLICY "Users can delete their own messages"
ON public.chat_messages
FOR DELETE
USING (auth.uid() = user_id);