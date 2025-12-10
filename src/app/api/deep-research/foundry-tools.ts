/**
 * Foundry search tools - Web search and Ontology search
 */

import { searchOntologyObjects } from '@/lib/foundry-client';

/**
 * Web search via Firecrawl (TODO: connect to Foundry)
 * Currently returns mock data for testing.
 */
async function webSearch(query: string): Promise<string> {
  // TODO: Replace with actual Foundry function call
  // const res = await callFoundryFunction('ri.function...firecrawl_rid', { query });
  // return JSON.stringify(res).slice(0, 15000);

  console.log(`[MOCK] Web search for: ${query}`);

  return JSON.stringify({
    results: [
      {
        title: `Mock Web Result for "${query}"`,
        url: "https://example.com/mock",
        content: `This is placeholder content for the web search query: "${query}". Replace this mock with actual Firecrawl integration.`,
      },
    ],
  }).slice(0, 15000);
}

/**
 * Ontology search via Palantir Foundry Ontology API
 * Searches across ontology objects and returns relevant results
 */
async function ontologySearch(query: string): Promise<string> {
  try {
    console.log(`[LIVE] Ontology search for: ${query}`);

    // Call the Foundry Ontology API with auto-discover enabled
    // This will automatically search across available object types
    const response = await searchOntologyObjects(query, {
      maxResults: 10,
      autoDiscover: true, // Automatically discover and search object types
    });

    // Check if ontology search is configured
    if (response.message === 'Ontology search not configured') {
      return `[INTERNAL DATA - Not Configured]
Ontology search is not configured. Set FOUNDRY_ONTOLOGY_RID environment variable to enable internal data search.`;
    }

    // Format the results for the research agent
    const formattedResults = {
      query,
      totalCount: response.totalCount || 0,
      searchedTypes: response.searchedTypes || [],
      results: response.data?.map((obj: any) => ({
        rid: obj.rid,
        properties: obj.properties,
      })) || [],
      hasMore: !!response.nextPageToken,
    };

    // Truncate to stay within context limits (as per CLAUDE.md)
    const jsonString = JSON.stringify(formattedResults, null, 2);
    const truncated = jsonString.slice(0, 15000);

    return `[INTERNAL DATA - Foundry Ontology]\n${truncated}${
      jsonString.length > 15000 ? '\n...(truncated)' : ''
    }`;
  } catch (error) {
    console.error('Error querying Foundry Ontology:', error);

    // Fallback to a helpful error message
    return `[INTERNAL DATA - Error]
Failed to query Foundry Ontology for: "${query}"
Error: ${error instanceof Error ? error.message : 'Unknown error'}

This might be due to:
- Missing FOUNDRY_ONTOLOGY_RID environment variable
- Invalid authentication token
- Network connectivity issues
- Ontology configuration issues

Please check your environment configuration.`;
  }
}

/**
 * Execute both search tools and combine results.
 * Returns SearchResult[] format expected by research-functions.ts
 */
export async function executeFoundrySearch(query: string) {
  const [webRes, ontologyRes] = await Promise.all([
    webSearch(query),
    ontologySearch(query),
  ]);

  return [
    { title: "Web Results", url: "Firecrawl", content: webRes },
    { title: "Internal Ontology", url: "Palantir", content: ontologyRes },
  ];
}
