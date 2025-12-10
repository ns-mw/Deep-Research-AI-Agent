/**
 * Foundry search tools - using OSDK client for Foundry integration.
 */

// Note: foundryClient from foundry-osdk-client.ts is available for future ontology queries

/**
 * Call a Foundry Function via HTTP
 * Uses service user token (FOUNDRY_TOKEN) for authentication.
 * 
 * @param functionRid - The RID of the Foundry function to call
 * @param parameters - Parameters to pass to the function
 */
async function callFoundryFunction(
  functionRid: string,
  parameters: Record<string, unknown>
): Promise<unknown> {
  const url = process.env.FOUNDRY_BASE_URL || "https://northslope.palantirfoundry.com";
  const token = process.env.FOUNDRY_TOKEN; // Service user token

  if (!token) {
    throw new Error("FOUNDRY_TOKEN environment variable is required");
  }

  // Function RIDs must be: ri.function-registry.main.function.XXXX
  if (!functionRid.startsWith('ri.function-registry')) {
    throw new Error(`Invalid function RID: ${functionRid}. Must start with 'ri.function-registry'`);
  }

  const functionUrl = `${url}/api/v1/functions/${functionRid}/invoke`;
  console.log(`[Foundry] Calling: ${functionUrl}`);

  const response = await fetch(functionUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(parameters),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  return response.json();
}

/**
 * Web search via Foundry Function
 * Calls the Foundry function specified in FOUNDRY_WEB_SEARCH_FUNCTION_RID
 * 
 * The function expects: { queries: string[] }
 * Returns: JSON string with { success, totalQueries, searchResults: [...] }
 */
async function webSearch(query: string): Promise<string> {
  const functionRid = process.env.FOUNDRY_WEB_SEARCH_FUNCTION_RID;
  
  // Debug logging
  console.log("[DEBUG] FOUNDRY_WEB_SEARCH_FUNCTION_RID:", functionRid ? `Set: ${functionRid.substring(0, 50)}...` : "NOT SET");
  console.log("[DEBUG] All FOUNDRY_ env vars:", Object.keys(process.env).filter(k => k.startsWith('FOUNDRY_')).map(k => `${k}=${process.env[k]?.substring(0, 20)}...`));

  if (!functionRid) {
    console.warn("[WARNING] FOUNDRY_WEB_SEARCH_FUNCTION_RID not set, using mock data");
    // Fallback to mock if function RID not configured
    return JSON.stringify({
      results: [
        {
          title: `Mock Web Result for "${query}"`,
          url: "https://example.com/mock",
          content: `This is placeholder content for the web search query: "${query}". Configure FOUNDRY_WEB_SEARCH_FUNCTION_RID to use actual Foundry function.`,
        },
      ],
    }).slice(0, 15000);
  }

  try {
    console.log(`[Foundry] Calling web search function: ${functionRid} with query: ${query}`);
    
    // Function expects queries as an array: { queries: string[] }
    const result = await callFoundryFunction(functionRid, { queries: [query] });
    
    // The function returns a JSON string, which may be wrapped in a "value" field for ontology queries
    // Handle ontology query response format (wrapped in "value" field)
    let resultString: string;
    if (typeof result === 'object' && result !== null && 'value' in result) {
      resultString = (result as { value: string }).value;
    } else if (typeof result === 'string') {
      resultString = result;
    } else {
      resultString = JSON.stringify(result);
    }
    
    // Parse the JSON string
    const parsedResult: {
      success?: boolean;
      totalQueries?: number;
      searchResults?: Array<{
        query: string;
        success: boolean;
        results: unknown[];
        error: string | null;
      }>;
      error?: string;
      details?: string;
    } = JSON.parse(resultString);
    
    // Extract results from the first search result (since we only sent one query)
    if (parsedResult.searchResults && parsedResult.searchResults.length > 0) {
      const firstResult = parsedResult.searchResults[0];
      
      if (firstResult.success && firstResult.results && firstResult.results.length > 0) {
        // Return the results in the expected format
        return JSON.stringify({
          success: true,
          results: firstResult.results,
        }).slice(0, 15000);
      } else if (firstResult.error) {
        // Return error from the function
        return JSON.stringify({
          error: firstResult.error,
          query,
        }).slice(0, 15000);
      }
    }
    
    // If we get here, something unexpected happened
    if (parsedResult.error) {
      return JSON.stringify({
        error: parsedResult.error,
        details: parsedResult.details,
        query,
      }).slice(0, 15000);
    }
    
    // Fallback: return the full response
    return JSON.stringify(parsedResult).slice(0, 15000);
  } catch (error) {
    console.error(`[Foundry] Web search error:`, error);
    // Return error information in a structured format
    return JSON.stringify({
      error: "Foundry function call failed",
      message: error instanceof Error ? error.message : String(error),
      query,
    }).slice(0, 15000);
  }
}

/**
 * Ontology search (TODO: connect to Palantir Ontology via Foundry)
 * Currently returns mock data for testing.
 */
async function ontologySearch(query: string): Promise<string> {
  // TODO: Replace with actual Foundry Ontology query
  // const res = await callFoundryFunction('ri.function...ontology_rid', { query });
  // return `[INTERNAL DATA]\n${JSON.stringify(res).slice(0, 15000)}`;

  console.log(`[MOCK] Ontology search for: ${query}`);

  return `[INTERNAL DATA]
Mock ontology results for query: "${query}"
- No real Ontology connection configured yet
- Replace this placeholder with actual Foundry Ontology integration`.slice(0, 15000);
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
