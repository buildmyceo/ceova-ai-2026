import { Tool, ToolMetadata, ToolContext, ToolResult } from '../types.ts';

export interface SearchResultItem {
  title: string;
  url: string;
  snippet: string;
  source?: string;
}

/**
 * Extracts and cleans search queries by removing conversational filler words.
 * Extracts clean domain names when a website or URL is mentioned.
 */
export function cleanSearchQuery(rawQuery: string): string {
  let q = (rawQuery || '').trim();

  // If a domain or URL is detected, extract the domain directly
  const domainMatch = q.match(/https?:\/\/[^\s/$.?#].[^\s]*|(?:\b[a-zA-Z0-9-]+\.)+(?:com|online|org|net|io|ai|co|app|dev|in|tech|xyz)\b/i);
  if (domainMatch) {
    const domain = domainMatch[0].replace(/^https?:\/\//i, '').replace(/\/.*$/, '').trim();
    if (domain) return domain;
  }

  // Remove conversational filler prefixes
  q = q.replace(/^(?:please\s+)?(?:can\s+you\s+)?(?:tell\s+me\s+about|what\s+is|what\s+are|who\s+is|who\s+was|look\s+up|search\s+for|search|find\s+information\s+about|find\s+info\s+on|find|explain|give\s+me\s+info\s+on|research\s+on|research)\s+/i, '');
  // Remove trailing site/website words
  q = q.replace(/\s+(?:website|site|webpage|page|portal)$/i, '');
  return q.trim() || rawQuery.trim();
}

/**
 * Directly fetches and extracts content from a domain or URL mentioned in a prompt.
 * Handles HTML meta tags, OpenGraph data, body text, and React/SPA script bundles.
 */
async function fetchDirectSiteContent(rawQuery: string): Promise<SearchResultItem | null> {
  const domainMatch = rawQuery.match(/https?:\/\/[^\s/$.?#].[^\s]*|(?:\b[a-zA-Z0-9-]+\.)+(?:com|online|org|net|io|ai|co|app|dev|in|tech|xyz)\b/i);
  if (!domainMatch) return null;

  let targetUrl = domainMatch[0];
  if (!targetUrl.startsWith('http')) {
    targetUrl = 'https://' + targetUrl;
  }

  try {
    const res = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
      },
      signal: AbortSignal.timeout(6000),
      redirect: 'follow'
    });

    if (!res.ok) return null;
    const html = await res.text();

    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const siteTitle = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : new URL(targetUrl).hostname;

    const descMatch = html.match(/<meta\s+(?:name|property)=["'](?:description|og:description)["']\s+content=["']([\s\S]*?)["']/i);
    const metaDesc = descMatch ? descMatch[1].trim() : '';

    const keywordsMatch = html.match(/<meta\s+(?:name|property)=["']keywords["']\s+content=["']([\s\S]*?)["']/i);
    const keywords = keywordsMatch ? keywordsMatch[1].trim() : '';

    // Extract textual body paragraphs and headings
    const bodyTexts: string[] = [];
    const textMatches = Array.from(html.matchAll(/<(?:p|h1|h2|h3|li)[^>]*>([\s\S]*?)<\/(?:p|h1|h2|h3|li)>/gi));
    for (const tm of textMatches) {
      const clean = tm[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      if (clean.length > 20 && !clean.includes('{') && !bodyTexts.includes(clean)) {
        bodyTexts.push(clean);
        if (bodyTexts.length >= 8) break;
      }
    }

    // Single Page Application bundle inspector (e.g. Vite, Next, React SPA)
    const spaMatches: string[] = [];
    const scriptSrcMatches = Array.from(html.matchAll(/<script[^>]+src=["']([^"']+\.js)["']/gi));
    for (const sm of scriptSrcMatches.slice(0, 2)) {
      let scriptUrl = sm[1];
      if (!scriptUrl.startsWith('http')) {
        const parsedBase = new URL(targetUrl);
        scriptUrl = `${parsedBase.origin}/${scriptUrl.replace(/^\/+/, '')}`;
      }
      try {
        const sRes = await fetch(scriptUrl, {
          headers: { "User-Agent": "Mozilla/5.0" },
          signal: AbortSignal.timeout(4000)
        });
        if (sRes.ok) {
          const jsCode = await sRes.text();
          // Extract human-readable string literals and template strings
          const stringMatches = Array.from(jsCode.matchAll(/[`"]([A-Z][^`"]{25,240})[`"]/g));
          for (const stm of stringMatches) {
            const str = stm[1].trim();
            if (/(?:agency|platform|development|solution|service|enterprise|e-commerce|software|custom|digital|builder|partner|cloud|mobile|consulting|workflow|founder|product|odoo|shopify|wordpress)/i.test(str)) {
              if (!/(?:webpack|babel|node_modules|function\(|return\s|typeof|undefined|addEventListener)/i.test(str)) {
                if (!spaMatches.includes(str)) {
                  spaMatches.push(str);
                  if (spaMatches.length >= 10) break;
                }
              }
            }
          }
        }
      } catch {}
    }

    let combinedSnippet = "";
    if (metaDesc) combinedSnippet += `Official Description: ${metaDesc}\n`;
    if (keywords) combinedSnippet += `Keywords: ${keywords}\n`;
    if (bodyTexts.length > 0) combinedSnippet += `Site Highlights:\n• ${bodyTexts.join('\n• ')}\n`;
    if (spaMatches.length > 0) combinedSnippet += `Core Services & Offerings (from official site bundle):\n• ${spaMatches.join('\n• ')}\n`;

    if (combinedSnippet.trim().length > 30) {
      return {
        title: `${siteTitle} — Official Website`,
        url: targetUrl,
        snippet: combinedSnippet.trim(),
        source: 'direct_site'
      };
    }
  } catch (err: any) {
    console.warn(`[web-search] Direct fetch for ${targetUrl} failed:`, err?.message || err);
  }

  return null;
}

/**
 * Searches the web using OpenAI's native completions fallback.
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
 * Searches the live web using Direct Site Scraping (when domain is detected),
 * Tavily AI Search, DuckDuckGo, and OpenAI Synthesis.
 */
export async function performWebSearch(query: string, limit = 6): Promise<SearchResultItem[]> {
  const raw = (query || '').trim();
  if (!raw) return [];

  const results: SearchResultItem[] = [];
  const tavilyKey = Deno.env.get("TAVILY_API_KEY");
  const openAiKey = Deno.env.get("OPEN_AI") || Deno.env.get("OPENAI_API_KEY");

  // 1. Direct Site Inspection: If the user mentions a specific domain or URL, scrape official content first
  const directSite = await fetchDirectSiteContent(raw);
  if (directSite) {
    results.push(directSite);
  }

  const cleanQuery = cleanSearchQuery(raw);

  // 2. Primary: Tavily AI Search (real-time agentic search)
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
          if (results.length >= limit) {
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

  // 3. Secondary: DuckDuckGo Search (HTML parser with result__a and result__snippet)
  try {
    const ddgRes = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(cleanQuery)}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      },
      signal: AbortSignal.timeout(8000)
    });

    if (ddgRes.ok) {
      const html = await ddgRes.text();
      const titleMatches = Array.from(html.matchAll(/<a[^>]+class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi));
      const snippetMatches = Array.from(html.matchAll(/<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi));

      const count = Math.min(titleMatches.length, snippetMatches.length, limit);
      for (let i = 0; i < count; i++) {
        let rawUrl = titleMatches[i][1];
        const uddgMatch = rawUrl.match(/[?&]uddg=([^&]+)/);
        if (uddgMatch) {
          try { rawUrl = decodeURIComponent(uddgMatch[1]); } catch {}
        }
        if (!rawUrl.startsWith('http')) rawUrl = 'https:' + rawUrl;

        const title = titleMatches[i][2].replace(/<[^>]+>/g, '').trim();
        const snippet = snippetMatches[i][2].replace(/<[^>]+>/g, '').trim();

        if (title && snippet && !results.some(r => r.url === rawUrl)) {
          results.push({
            title: title || new URL(rawUrl).hostname,
            url: rawUrl,
            snippet,
            source: 'duckduckgo'
          });
        }
      }

      if (results.length >= limit) {
        return results.slice(0, limit);
      }
    }
  } catch (err: any) {
    console.warn("[web-search] DuckDuckGo fallback error:", err?.message || err);
  }

  // 4. Tertiary: OpenAI Synthesis Search
  if (openAiKey && results.length < 2) {
    const aiResults = await searchOpenAI(cleanQuery, openAiKey, limit);
    if (aiResults && aiResults.length > 0) {
      for (const air of aiResults) {
        if (!results.some(r => r.url === air.url)) {
          results.push(air);
        }
      }
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
