import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

serve(async (req) => {
  try {
    const authHeader = req.headers.get('Authorization');
    // Basic protection to ensure it's called with service role
    if (!authHeader || authHeader !== `Bearer ${supabaseServiceKey}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Find all expired library entries where source = 'video_downloader' and expires_at < now()
    const { data: expiredFiles, error: fetchError } = await supabase
      .from('files')
      .select('id, user_id, storage_source, storage_path')
      .eq('storage_source', 'video_downloader')
      .eq('is_temporary', true)
      .lt('expires_at', new Date().toISOString());

    if (fetchError) {
      throw new Error(`Error fetching expired files: ${fetchError.message}`);
    }

    if (!expiredFiles || expiredFiles.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No expired files to clean up" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // 2. Delete the actual files from Supabase Storage
    // The storage_path should be something like `temp_videos/{user_id}/{filename}`
    // Or just `{user_id}/{filename}` inside `temp_videos` bucket.
    // The Python script saves it as `{user_id}/{filename}`
    const pathsToDelete = expiredFiles.map(f => f.storage_path).filter(Boolean);
    
    let storageErrors = [];
    if (pathsToDelete.length > 0) {
      const { data, error } = await supabase.storage
        .from('temp_videos')
        .remove(pathsToDelete);
        
      if (error) {
        storageErrors.push(error.message);
      }
    }

    // 3. Delete the records from the files table
    const idsToDelete = expiredFiles.map(f => f.id);
    const { error: deleteError } = await supabase
      .from('files')
      .delete()
      .in('id', idsToDelete);

    if (deleteError) {
      throw new Error(`Error deleting DB records: ${deleteError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        cleanedCount: expiredFiles.length,
        storageErrors
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
