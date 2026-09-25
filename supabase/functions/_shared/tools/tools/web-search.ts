import { Tool, ToolMetadata, ToolContext, ToolResult } from '../types.ts';

export interface SearchResultItem {
  title: string;
  url: string;
  snippet: string;
  source?: string;
}

/**
 * Searches the web using OpenAI's search-grounded models and Responses API.
 */
async function searchOpenAI(query: string, apiKey: string, limit = 5): Promise<SearchResultItem[]> {
  const items: SearchResultItem[] = [];

  // 1. Try Chat Completions with gpt-4o-mini-search-preview
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini-search-preview",
        web_search_options: {},
        messages: [
          {
            role: "user",
            content: `Perform a live web search for: "${query}". Provide the latest, accurate information and all reference URLs.`
          }
        ],
        max_tokens: 1500
      }),
      signal: AbortSignal.timeout(10000)
    });

    if (res.ok) {
      const data = await res.json();
      const choice = data.choices?.[0];
      const message = choice?.message;
      const content = message?.content || "";
      const annotations = message?.annotations || [];

      // Extract url_citation annotations
      for (const ann of annotations) {
        const url = ann.url_citation?.url || ann.web_search_result?.url;
        const title = ann.url_citation?.title || ann.web_search_result?.title || '';
        if (url && !items.some(r => r.url === url) && items.length < limit) {
          items.push({
            title: title || new URL(url).hostname,
            url,
            snippet: ann.url_citation?.snippet || content.slice(0, 200).replace(/\n+/g, ' ').trim(),
            source: 'openai_search'
          });
        }
      }

      // Extract markdown links from generated text if annotations are empty or partial
      if (content && items.length < limit) {
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
              source: 'openai_search'
            });
          }
        }
      }

      // If we got content but no individual links, provide the grounded synthesis
      if (items.length === 0 && content.length > 30) {
        items.push({
          title: `Web Research: ${query.slice(0, 40)}`,
          url: 'https://openai.com/search',
          snippet: content.slice(0, 350).replace(/\n+/g, ' ').trim(),
          source: 'openai_search'
        });
      }
    } else {
      const errText = await res.text();
      console.warn("[web-search] OpenAI search-preview response status:", res.status, errText.slice(0, 150));
    }
  } catch (err: any) {
    console.warn("[web-search] OpenAI search-preview error:", err?.message || err);
  }

  // 2. Fallback to OpenAI Responses API if chat preview returned no results
  if (items.length === 0) {
    try {
      const res = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          tools: [{ type: "web_search_preview" }],
          input: `Search the web and provide sources for: "${query}"`
        }),
        signal: AbortSignal.timeout(10000)
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.output_text || (Array.isArray(data.output) ? data.output.map((o: any) => o.content || '').join('\n') : '');
        if (text) {
          const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
          let m: RegExpExecArray | null;
          while ((m = linkRegex.exec(text)) !== null && items.length < limit) {
            const title = m[1].trim();
            const url = m[2].trim();
            if (!items.some(r => r.url === url)) {
              items.push({
                title,
                url,
                snippet: text.slice(Math.max(0, m.index - 50), m.index + 120).replace(/\n+/g, ' ').trim(),
                source: 'openai_responses'
              });
            }
          }
        }
      }
    } catch (err: any) {
      console.warn("[web-search] OpenAI responses API error:", err?.message || err);
    }
  }

  return items;
}

/**
 * Searches the live web using OpenAI Web Search with multi-tier fallback
 * to DuckDuckGo Lite and Wikipedia API.
 * Returns structured search results with real titles, URLs, and snippets.
 */
export async function performWebSearch(query: string, limit = 5): Promise<SearchResultItem[]> {
  const cleanQuery = (query || '').trim();
  if (!cleanQuery) return [];

  const results: SearchResultItem[] = [];

  // 1. Primary Engine: OpenAI Web Search (High precision, authoritative, up-to-date)
  const openAiKey = Deno.env.get("OPEN_AI") || Deno.env.get("OPENAI_API_KEY");
  if (openAiKey) {
    try {
      const openAiResults = await searchOpenAI(cleanQuery, openAiKey, limit);
      if (openAiResults && openAiResults.length > 0) {
        results.push(...openAiResults);
      }
    } catch (err: any) {
      console.warn("[web-search] OpenAI search engine error:", err?.message || err);
    }
  }

  // 2. Secondary Engine: DuckDuckGo Lite (Fast, live, real-time web results)
  if (results.length < 3) {
    try {
      const res = await fetch("https://lite.duckduckgo.com/lite/", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        },
        body: "q=" + encodeURIComponent(cleanQuery),
        signal: AbortSignal.timeout(8000)
      });

      if (res.ok) {
        const html = await res.text();
        const linkRegex = /href=['"]([^'"]+)['"][^>]*class=['"]result-link['"][^>]*>([^<]+)/gi;
        const snippetRegex = /class=['"]result-snippet['"][^>]*>([^<]+)/gi;
        
        const links: { url: string; title: string }[] = [];
        let m: RegExpExecArray | null;
        while ((m = linkRegex.exec(html)) !== null && links.length < limit * 2) {
          let u = m[1];
          if (u.includes('uddg=')) {
            const parts = u.split('uddg=');
            if (parts[1]) {
              u = decodeURIComponent(parts[1].split('&')[0]);
            }
          }
          links.push({ url: u, title: m[2].trim() });
        }

        const snippets: string[] = [];
        while ((m = snippetRegex.exec(html)) !== null && snippets.length < limit * 2) {
          snippets.push(m[1].trim());
        }

        for (let i = 0; i < Math.min(links.length, limit - results.length); i++) {
          if (!results.some(r => r.url === links[i].url)) {
            results.push({
              title: links[i].title,
              url: links[i].url,
              snippet: snippets[i] || '',
              source: 'web'
            });
          }
        }
      }
    } catch (err: any) {
      console.warn("[web-search] DDG search error:", err?.message || err);
    }
  }

  // 3. Tertiary Engine: Wikipedia Search API (Authoritative for scientific, educational, and conceptual research)
  if (results.length < 3) {
    try {
      const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleanQuery)}&format=json&origin=*&utf8=1`;
      const wikiRes = await fetch(wikiUrl, {
        headers: { "User-Agent": "Ceova-Search/1.0" },
        signal: AbortSignal.timeout(5000)
      });
      if (wikiRes.ok) {
        const wikiData = await wikiRes.json();
        const wikiItems = wikiData.query?.search || [];
        for (const item of wikiItems.slice(0, limit - results.length)) {
          const cleanSnippet = (item.snippet || '').replace(/<[^>]+>/g, '').trim();
          const wikiUrlStr = `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`;
          if (!results.some(r => r.url === wikiUrlStr)) {
            results.push({
              title: `${item.title} (Wikipedia)`,
              url: wikiUrlStr,
              snippet: cleanSnippet,
              source: 'wikipedia'
            });
          }
        }
      }
    } catch (err: any) {
      console.warn("[web-search] Wikipedia search error:", err?.message || err);
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
