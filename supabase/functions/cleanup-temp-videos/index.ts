import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.2';

serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // 1. Find all expired database rows in `files` table
    const { data: expiredFiles, error: fetchError } = await supabase
      .from('files')
      .select('id, file_path')
      .eq('source', 'video_downloader')
      .eq('temporary', true)
      .lt('expires_at', new Date().toISOString());

    if (fetchError) throw fetchError;

    if (!expiredFiles || expiredFiles.length === 0) {
      return new Response(JSON.stringify({ message: 'No expired files to clean up' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const filePaths = expiredFiles.map(f => f.file_path);
    const fileIds = expiredFiles.map(f => f.id);

    // 2. Delete from Storage
    const { error: storageError } = await supabase.storage
      .from('temp_videos')
      .remove(filePaths);

    if (storageError) {
      console.error('Storage deletion error:', storageError);
    }

    // 3. Delete from Database
    const { error: dbError } = await supabase
      .from('files')
      .delete()
      .in('id', fileIds);

    if (dbError) throw dbError;

    return new Response(JSON.stringify({ 
      success: true, 
      deletedCount: expiredFiles.length 
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
