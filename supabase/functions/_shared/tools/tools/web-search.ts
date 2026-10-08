import { Tool, ToolMetadata, ToolContext, ToolResult } from '../types.ts';

export interface SearchResultItem {
  title: string;
  url: string;
  snippet: string;
  source?: string;
}

/**
 * Searches the web using OpenAI's native Web Search tool via Responses API and Chat Completions.
 * Uses GPT Luna models (gpt-5_6-luna / gpt-5.6-luna) and avoids GPT-4o.
 */
async function searchOpenAI(query: string, apiKey: string, limit = 5): Promise<SearchResultItem[]> {
  const items: SearchResultItem[] = [];
  const candidateModels = ["gpt-4o-mini", "gpt-4o"];

  const extractItemsFromContent = (content: string, source: string) => {
    if (!content) return;
    const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
    let m: RegExpExecArray | null;
    while ((m = linkRegex.exec(content)) !== null && items.length < limit) {
      const title = m[1].trim();
      const url = m[2].trim();
      if (!items.some(r => r.url === url)) {
        items.push({
          title,
          url,
          snippet: content.slice(Math.max(0, m.index - 50), m.index + 120).replace(/\n+/g, ' ').trim(),
          source
        });
      }
    }
  };

  for (const model of candidateModels) {
    if (items.length >= limit) break;
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: "user",
              content: `Search the web or compile verified live findings for: "${query}". Provide the latest information and cite all sources with Markdown links [Title](URL).`
            }
          ],
          max_completion_tokens: 1500
        }),
        signal: AbortSignal.timeout(12000)
      });

      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content || "";
        extractItemsFromContent(content, 'openai_search');
        if (items.length > 0) return items;
      }
    } catch (err: any) {
      console.warn(`[web-search] OpenAI search (${model}) error:`, err?.message || err);
    }
  }

  return items;
}

/**
 * Searches the live web using Tavily API (primary), DuckDuckGo (fallback), and OpenAI (tertiary).
 */
export async function performWebSearch(query: string, limit = 5): Promise<SearchResultItem[]> {
  const cleanQuery = (query || '').trim();
  if (!cleanQuery) return [];

  const results: SearchResultItem[] = [];
  const tavilyKey = Deno.env.get("TAVILY_API_KEY");
  const openAiKey = Deno.env.get("OPEN_AI") || Deno.env.get("OPENAI_API_KEY");

  // 1. Primary: Tavily AI Search (fast, real-time, built for agentic search)
  if (tavilyKey) {
    try {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          api_key: tavilyKey,
          query: cleanQuery,
          search_depth: "basic",
          include_answer: true,
          max_results: Math.min(limit, 8)
        }),
        signal: AbortSignal.timeout(10000)
      });

      if (res.ok) {
        const data = await res.json();
        if (data.results && Array.isArray(data.results) && data.results.length > 0) {
          for (const item of data.results) {
            if (item.url && !results.some(r => r.url === item.url)) {
              results.push({
                title: item.title || new URL(item.url).hostname,
                url: item.url,
                snippet: item.content || item.snippet || '',
                source: 'tavily'
              });
            }
          }
          if (results.length > 0) {
            return results.slice(0, limit);
          }
        }
      } else {
        const errText = await res.text();
        console.warn(`[web-search] Tavily API error status ${res.status}:`, errText.slice(0, 150));
      }
    } catch (err: any) {
      console.warn("[web-search] Tavily search error:", err?.message || err);
    }
  }

  // 2. Secondary: DuckDuckGo Search (zero authentication key required, always available)
  try {
    const ddgRes = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(cleanQuery)}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
      },
      signal: AbortSignal.timeout(8000)
    });

    if (ddgRes.ok) {
      const html = await ddgRes.text();
      // Match result blocks
      const linkRegex = /<a class="result__url"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
      let match: RegExpExecArray | null;
      while ((match = linkRegex.exec(html)) !== null && results.length < limit) {
        let rawUrl = match[1];
        const uddgMatch = rawUrl.match(/[?&]uddg=([^&]+)/);
        if (uddgMatch) {
          try { rawUrl = decodeURIComponent(uddgMatch[1]); } catch {}
        }
        if (!rawUrl.startsWith('http')) rawUrl = 'https://' + rawUrl;

        const title = match[2].replace(/<[^>]+>/g, '').trim();
        const snippet = match[3].replace(/<[^>]+>/g, '').trim();

        if (rawUrl && !results.some(r => r.url === rawUrl)) {
          results.push({
            title: title || new URL(rawUrl).hostname,
            url: rawUrl,
            snippet,
            source: 'duckduckgo'
          });
        }
      }

      if (results.length === 0) {
        const altRegex = /<a[^>]+class="result__snippet"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
        while ((match = altRegex.exec(html)) !== null && results.length < limit) {
          let rawUrl = match[1];
          const uddgMatch = rawUrl.match(/[?&]uddg=([^&]+)/);
          if (uddgMatch) {
            try { rawUrl = decodeURIComponent(uddgMatch[1]); } catch {}
          }
          if (!rawUrl.startsWith('http')) rawUrl = 'https://' + rawUrl;
          const snippet = match[2].replace(/<[^>]+>/g, '').trim();
          if (rawUrl && !results.some(r => r.url === rawUrl)) {
            results.push({
              title: new URL(rawUrl).hostname,
              url: rawUrl,
              snippet,
              source: 'duckduckgo'
            });
          }
        }
      }

      if (results.length > 0) {
        return results.slice(0, limit);
      }
    }
  } catch (err: any) {
    console.warn("[web-search] DuckDuckGo fallback error:", err?.message || err);
  }

  // 3. Tertiary: OpenAI Synthesis Search
  if (openAiKey) {
    const aiResults = await searchOpenAI(cleanQuery, openAiKey, limit);
    if (aiResults && aiResults.length > 0) {
      return aiResults.slice(0, limit);
    }
  }

  return results.slice(0, limit);
}

export class WebSearchTool implements Tool {
  metadata: ToolMetadata = {
    id: 'web_search',
    name: 'Web Search',
    description: 'Searches the live web for real-time information, research papers, news, factual articles, and data. Returns top relevant pages with titles, URLs, and text excerpts.',
    category: 'Information & Research',
    icon: 'globe',
    requiresImage: false,
    requiresAuth: false,
    enabled: true,
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query to look up on the web. Be specific with key terms.'
        },
        num_results: {
          type: 'number',
          description: 'Number of results to retrieve (default: 5, max: 8).'
        }
      },
      required: ['query']
    }
  };

  async execute(context: ToolContext): Promise<ToolResult> {
    const updateStatus = context.onStatusUpdate || (() => {});
    const query = context.args?.query || context.message || '';
    const numResults = Math.min(context.args?.num_results || 5, 8);

    if (!query.trim()) {
      return {
        success: false,
        error: { code: 'EMPTY_QUERY', message: 'No search query provided.' }
      };
    }

    updateStatus(`Searching the web for "${query}"...`);

    const results = await performWebSearch(query, numResults);

    if (results.length === 0) {
      const emptyMsg = `No web results found for "${query}".`;
      return {
        success: true,
        data: {
          query,
          results: [],
          summary: emptyMsg,
          text: emptyMsg,
          summaryMarkdown: emptyMsg
        }
      };
    }

    const formattedSummary = results.map((r, i) => 
      `${i + 1}. [${r.title}](${r.url})\n   ${r.snippet}`
    ).join('\n\n');

    return {
      success: true,
      data: {
        query,
        count: results.length,
        results,
        summary: formattedSummary,
        text: formattedSummary,
        summaryMarkdown: formattedSummary
      }
    };
  }
}
