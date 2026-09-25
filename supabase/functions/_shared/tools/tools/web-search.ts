import { Tool, ToolMetadata, ToolContext, ToolResult } from '../types.ts';

export interface SearchResultItem {
  title: string;
  url: string;
  snippet: string;
  source?: string;
}

/**
 * Searches the live web using DuckDuckGo Lite with fallback to Wikipedia API.
 * Returns structured search results with real titles, URLs, and snippets.
 */
export async function performWebSearch(query: string, limit = 5): Promise<SearchResultItem[]> {
  const cleanQuery = (query || '').trim();
  if (!cleanQuery) return [];

  const results: SearchResultItem[] = [];

  // 1. Primary Engine: DuckDuckGo Lite (Fast, live, real-time web results)
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

      for (let i = 0; i < Math.min(links.length, limit); i++) {
        results.push({
          title: links[i].title,
          url: links[i].url,
          snippet: snippets[i] || '',
          source: 'web'
        });
      }
    }
  } catch (err: any) {
    console.warn("[web-search] DDG search error:", err?.message || err);
  }

  // 2. Secondary Engine: Wikipedia Search API (Authoritative for scientific, educational, and conceptual research)
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
          results.push({
            title: `${item.title} (Wikipedia)`,
            url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`,
            snippet: cleanSnippet,
            source: 'wikipedia'
          });
        }
      }
    } catch (err: any) {
      console.warn("[web-search] Wikipedia search error:", err?.message || err);
    }
  }

  return results;
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
      return {
        success: true,
        data: {
          query,
          results: [],
          summary: `No web results found for "${query}".`
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
        summary: formattedSummary
      }
    };
  }
}
