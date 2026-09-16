-- Fix new user signup by dropping orphaned workspace trigger
DROP TRIGGER IF EXISTS on_auth_user_created_workspace ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user_workspace();
