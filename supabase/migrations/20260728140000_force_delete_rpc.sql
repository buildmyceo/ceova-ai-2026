CREATE OR REPLACE FUNCTION force_delete_chat(chat_id_to_delete TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    chat_owner UUID;
BEGIN
    -- Check if chat belongs to user (if it exists in chats table)
    SELECT user_id INTO chat_owner FROM public.chats WHERE id = chat_id_to_delete;
    IF chat_owner IS NOT NULL AND chat_owner != auth.uid() THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- Force delete (bypasses RLS bugs)
    DELETE FROM public.messages WHERE chat_id = chat_id_to_delete;
    DELETE FROM public.chats WHERE id = chat_id_to_delete;
END;
$$;

CREATE OR REPLACE FUNCTION force_bulk_delete_chats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM public.messages WHERE user_id = auth.uid() OR chat_id IN (SELECT id FROM public.chats WHERE user_id = auth.uid());
    DELETE FROM public.chats WHERE user_id = auth.uid();
END;
$$;
