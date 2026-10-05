export interface SerpApiResult {
  title: string;
  link: string;
  snippet: string;
  source?: string;
  date?: string;
}

export interface SerpApiResponse {
  query: string;
  results: SerpApiResult[];
  totalResults?: number;
  searchTimeMs: number;
  isAvailable: boolean;
}

/**
 * Queries SerpApi (Google Search API) for real-time maritime, port, cyclone, or defense intelligence.
 */
export async function searchMaritimeWeb(
  query: string,
  numResults: number = 4
): Promise<SerpApiResponse> {
  const apiKey = process.env.SERPAPI_API_KEY;
  const startTime = Date.now();

  if (!apiKey || apiKey.trim().length === 0) {
    return {
      query,
      results: [],
      searchTimeMs: 0,
      isAvailable: false,
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const url = `https://serpapi.com/search.json?q=${encodeURIComponent(
      query
    )}&api_key=${apiKey}&engine=google&gl=in&hl=en&num=${numResults}`;

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn(`[SerpApi] HTTP ${res.status}: ${res.statusText}`);
      return {
        query,
        results: [],
        searchTimeMs: Date.now() - startTime,
        isAvailable: false,
      };
    }

    const data = await res.json();
    const organic = data?.organic_results || [];

    const results: SerpApiResult[] = organic.slice(0, numResults).map((item: any) => ({
      title: item.title || '',
      link: item.link || '',
      snippet: item.snippet || '',
      source: item.source || item.displayed_link || '',
      date: item.date || '',
    }));

    return {
      query,
      results,
      totalResults: organic.length,
      searchTimeMs: Date.now() - startTime,
      isAvailable: true,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn(`[SerpApi] Search failed:`, err);
    return {
      query,
      results: [],
      searchTimeMs: Date.now() - startTime,
      isAvailable: false,
    };
  }
}
