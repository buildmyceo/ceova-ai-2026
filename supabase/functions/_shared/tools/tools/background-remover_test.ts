import { BackgroundRemoverTool } from './background-remover.ts';
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

const tool = new BackgroundRemoverTool();

Deno.test("Background Remover - No Image provided", async () => {
    const result = await tool.execute({
        userId: 'test_user',
        attachments: []
    });
    
    assertEquals(result.success, false);
    assertEquals(result.error?.code, 'INVALID_FILE');
});

Deno.test("Background Remover - Invalid file provided", async () => {
    const result = await tool.execute({
        userId: 'test_user',
        attachments: [
            { type: 'application/pdf', name: 'doc.pdf', url: 'http://example.com/doc.pdf' }
        ]
    });
    
    assertEquals(result.success, false);
    assertEquals(result.error?.code, 'INVALID_FILE');
});

Deno.test("Background Remover - API Failure (mocked)", async () => {
    // We expect the API to fail because we are passing an invalid API key
    Deno.env.set('REMOVE_BG_API_KEY', 'invalid_key');
    
    // 1x1 transparent png in base64
    const fakeImageBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    
    const result = await tool.execute({
        userId: 'test_user',
        attachments: [
            { type: 'image/png', name: 'image.png', content: fakeImageBase64 }
        ]
    });
    
    assertEquals(result.success, false);
    assertEquals(result.error?.code, 'API_ERROR');
});

Deno.test("Background Remover - Valid Image (mocking remove.bg)", async () => {
    // Since we don't want to make an actual API call in the unit test, 
    // we can either mock fetch or test it with a known API key if we have one.
    // For now, we will override the fetch function to return a mock success response.
    const originalFetch = globalThis.fetch;
    
    globalThis.fetch = async (url, options) => {
        if (url === 'https://api.remove.bg/v1.0/removebg') {
            return new Response(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), { status: 200 }); // fake PNG header
        }
        return originalFetch(url, options);
    };

    // We also need to mock the Supabase client upload in the tool, which is tricky since it's hardcoded.
    // Actually, testing the success path requires mocking Supabase storage too. Let's just ensure the API logic flows.
    // Given the prompt, the user probably wants to see tests pass for the *actual* logic handling. 
    // If the Supabase client errors out because we don't have SUPABASE_URL, it will throw API_ERROR.
    
    // Instead of completely mocking everything, let's see if we can trigger the Supabase error which means 
    // the removebg API part succeeded.
    Deno.env.set('REMOVE_BG_API_KEY', 'valid_key');
    Deno.env.set('SUPABASE_URL', 'https://mock.supabase.co');
    Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'mock_key');
    
    // Mock fetch for both removebg and supabase storage upload
    globalThis.fetch = async (url, options) => {
        if (url === 'https://api.remove.bg/v1.0/removebg') {
            return new Response(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]).buffer, { status: 200 });
        }
        if (typeof url === 'string' && url.includes('supabase.co/storage')) {
            return new Response(JSON.stringify({ Id: 'mock_file_id' }), { status: 200, headers: { 'content-type': 'application/json' } });
        }
        return originalFetch(url, options);
    };

    try {
        const fakeImageBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
        const result = await tool.execute({
            userId: 'test_user',
            attachments: [
                { type: 'image/png', name: 'image.png', content: fakeImageBase64 }
            ]
        });

        assertEquals(result.success, true);
        assertEquals(result.data?.mimeType, 'image/png');
    } finally {
        globalThis.fetch = originalFetch; // restore
    }
});
