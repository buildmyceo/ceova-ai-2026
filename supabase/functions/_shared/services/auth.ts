import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.2";
import { Logger } from "./logger.ts";

export const getAdminClient = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE') || '';
  return createClient(supabaseUrl, supabaseKey);
};

export const getUserContext = async (req: Request) => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) throw new Error("No authorization header");
  
  const token = authHeader.replace('Bearer ', '');
  const supabase = getAdminClient();
  
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) throw new Error("Unauthorized");
  
  return { user };
};
