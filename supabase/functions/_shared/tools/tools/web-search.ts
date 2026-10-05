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
  const lunaModels = ["gpt-5_6-luna", "gpt-5.6-luna"];

  // Helper to extract links and citations from content
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

  // 1. Primary: OpenAI Responses API with native web_search tool
  // This explicitly registers in the OpenAI Dashboard under "Web Searches"
  for (const model of lunaModels) {
    if (items.length >= limit) break;
    try {
      const res = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: model,
          tools: [{ type: "web_search" }],
          input: `Perform a comprehensive live web search for: "${query}". Provide the latest accurate information and cite all source URLs.`
        }),
        signal: AbortSignal.timeout(12000)
      });

      if (res.ok) {
        const data = await res.json();
        
        // Extract from output array (annotations, citations, web_search_call outputs)
        if (Array.isArray(data.output)) {
          for (const item of data.output) {
            // Check for annotations inside message content
            if (item.content && Array.isArray(item.content)) {
              for (const part of item.content) {
                if (part.annotations && Array.isArray(part.annotations)) {
                  for (const ann of part.annotations) {
                    const url = ann.url_citation?.url || ann.web_search_result?.url || ann.url;
                    const title = ann.url_citation?.title || ann.web_search_result?.title || ann.title || '';
                    if (url && !items.some(r => r.url === url) && items.length < limit) {
                      items.push({
                        title: title || new URL(url).hostname,
                        url,
                        snippet: ann.url_citation?.snippet || ann.snippet || part.text?.slice(0, 200).replace(/\n+/g, ' ').trim() || '',
                        source: 'openai_responses'
                      });
                    }
                  }
                }
                if (part.text) {
                  extractItemsFromContent(part.text, 'openai_responses');
                }
              }
            }

            // Check for web search tool results directly
            if (item.type === 'web_search_call' || item.type === 'web_search_output') {
              const searchResults = item.results || item.web_search_results || [];
              for (const sr of searchResults) {
                if (sr.url && !items.some(r => r.url === sr.url) && items.length < limit) {
                  items.push({
                    title: sr.title || new URL(sr.url).hostname,
                    url: sr.url,
                    snippet: sr.snippet || sr.text || '',
                    source: 'openai_responses'
                  });
                }
              }
            }
          }
        }

        const textOutput = data.output_text || (typeof data.output === 'string' ? data.output : '');
        if (textOutput) {
          extractItemsFromContent(textOutput, 'openai_responses');
        }

        if (items.length > 0) {
          return items;
        }

        // If content was produced with live facts but without discrete markdown links
        if (textOutput && textOutput.length > 40) {
          items.push({
            title: `Live Web Research: ${query.slice(0, 45)}`,
            url: 'https://openai.com/search',
            snippet: textOutput.slice(0, 350).replace(/\n+/g, ' ').trim(),
            source: 'openai_responses'
          });
          return items;
        }
      } else {
        const errText = await res.text();
        console.warn(`[web-search] OpenAI responses API (${model}) status:`, res.status, errText.slice(0, 150));
      }
    } catch (err: any) {
      console.warn(`[web-search] OpenAI responses API (${model}) error:`, err?.message || err);
    }
  }

  // 2. Secondary: Chat Completions with native web_search tool
  if (items.length === 0) {
    for (const model of lunaModels) {
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
            tools: [{ type: "web_search" }],
            messages: [
              {
                role: "user",
                content: `Perform a live web search for: "${query}". Provide the latest accurate findings and all reference URLs formatted as [Source Name](url).`
              }
            ],
            max_completion_tokens: 1500
          }),
          signal: AbortSignal.timeout(12000)
        });

        if (res.ok) {
          const data = await res.json();
          const choice = data.choices?.[0];
          const message = choice?.message;
          const content = message?.content || "";
          const annotations = message?.annotations || [];

          for (const ann of annotations) {
            const url = ann.url_citation?.url || ann.web_search_result?.url || ann.url;
            const title = ann.url_citation?.title || ann.web_search_result?.title || '';
            if (url && !items.some(r => r.url === url) && items.length < limit) {
              items.push({
                title: title || new URL(url).hostname,
                url,
                snippet: ann.url_citation?.snippet || content.slice(0, 200).replace(/\n+/g, ' ').trim(),
                source: 'openai_chat_search'
              });
            }
          }

          extractItemsFromContent(content, 'openai_chat_search');

          if (items.length === 0 && content.length > 40) {
            items.push({
              title: `Live Web Research: ${query.slice(0, 45)}`,
              url: 'https://openai.com/search',
              snippet: content.slice(0, 350).replace(/\n+/g, ' ').trim(),
              source: 'openai_chat_search'
            });
          }

          if (items.length > 0) return items;
        } else {
          const errText = await res.text();
          console.warn(`[web-search] OpenAI chat search (${model}) status:`, res.status, errText.slice(0, 150));
        }
      } catch (err: any) {
        console.warn(`[web-search] OpenAI chat search (${model}) error:`, err?.message || err);
      }
    }
  }

  return items;
/**
 * Searches the live web using Tavily Search API.
 * Returns structured search results with real titles, URLs, and snippets.
 * Requires TAVILY_API_KEY in the environment.
 */
export async function performWebSearch(query: string, limit = 5): Promise<SearchResultItem[]> {
  const cleanQuery = (query || '').trim();
  if (!cleanQuery) return [];

  const results: SearchResultItem[] = [];
  
  const apiKey = Deno.env.get("TAVILY_API_KEY");

  if (!apiKey) {
    console.warn("[web-search] Missing TAVILY_API_KEY environment variable.");
    // Fallback error result to inform the user
    return [{
      title: "Tavily Search Configuration Required",
      url: "https://tavily.com",
      snippet: "Please create a free account at tavily.com and add TAVILY_API_KEY to your Supabase environment variables to enable live web search.",
      source: "system"
    }];
  }

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        api_key: apiKey,
        query: cleanQuery,
        search_depth: "basic",
        include_answer: false,
        max_results: limit
      }),
      signal: AbortSignal.timeout(12000)
    });

    if (res.ok) {
      const data = await res.json();
      if (data.results && Array.isArray(data.results)) {
        for (const item of data.results) {
          results.push({
            title: item.title,
            url: item.url,
            snippet: item.content,
            source: 'tavily'
          });
        }
      }
    } else {
      const errText = await res.text();
      console.warn(`[web-search] Tavily API error (${res.status}):`, errText);
    }
  } catch (err: any) {
    console.warn("[web-search] Tavily Search request failed:", err?.message || err);
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
