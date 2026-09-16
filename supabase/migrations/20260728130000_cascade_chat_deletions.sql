-- Drop the existing foreign key and recreate it with ON DELETE CASCADE
DO $$
DECLARE
    fk_name text;
BEGIN
    -- Find the foreign key constraint name for messages.chat_id
    SELECT constraint_name INTO fk_name
    FROM information_schema.key_column_usage
    WHERE table_name = 'messages' AND column_name = 'chat_id' AND position_in_unique_constraint = 1;
    
    IF fk_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.messages DROP CONSTRAINT ' || fk_name;
    END IF;
END $$;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_chat_id_fkey
    FOREIGN KEY (chat_id) REFERENCES public.chats(id) ON DELETE CASCADE;

-- Also fix the RLS policies just in case
DROP POLICY IF EXISTS "Users can delete their own messages" ON public.messages;
CREATE POLICY "Users can delete their own messages" ON public.messages FOR DELETE USING (
    user_id = auth.uid() OR 
    chat_id IN (SELECT id FROM public.chats WHERE user_id = auth.uid())
);
