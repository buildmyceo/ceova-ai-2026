-- Allow users to delete their own chats
DROP POLICY IF EXISTS "Users can delete their own chats" ON public.chats;
CREATE POLICY "Users can delete their own chats" 
ON public.chats 
FOR DELETE 
USING (user_id = auth.uid());

-- Allow users to delete their own messages
DROP POLICY IF EXISTS "Users can delete their own messages" ON public.messages;
CREATE POLICY "Users can delete their own messages" 
ON public.messages 
FOR DELETE 
USING (user_id = auth.uid());
