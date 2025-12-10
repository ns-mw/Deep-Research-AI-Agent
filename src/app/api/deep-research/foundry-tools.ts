/**
 * Foundry search tools - Web search and Ontology search
 */

import { searchOntologyObjects, listObjectTypes as listOntologyObjectTypes } from '@/lib/foundry-client';

/**
 * Call a Foundry Ontology Query function via HTTP
 * Uses service user token (FOUNDRY_TOKEN) for authentication.
 *
 * @param functionName - The name of the Ontology Query function (e.g., 'searchWebBatch')
 * @param parameters - Parameters to pass to the function
 */
async function callFoundryFunction(
  functionName: string,
  parameters: Record<string, unknown>
): Promise<unknown> {
  const url = process.env.FOUNDRY_BASE_URL || "https://northslope.palantirfoundry.com";
  const token = process.env.FOUNDRY_TOKEN;
  const ontologyApiName = process.env.FOUNDRY_ONTOLOGY_API_NAME;

  if (!token) {
    throw new Error("FOUNDRY_TOKEN environment variable is required");
  }

  if (!ontologyApiName) {
    throw new Error("FOUNDRY_ONTOLOGY_API_NAME environment variable is required");
  }

  // Use Ontology Query endpoint format with API name (not full RID)
  const functionUrl = `${url}/api/v2/ontologies/${ontologyApiName}/queries/${functionName}/execute`;
  console.log(`[Foundry] Calling: ${functionUrl}`);

  const response = await fetch(functionUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ parameters }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  return response.json();
}

/**
 * Web search via Foundry Ontology Query
 * Calls the Ontology Query function specified in FOUNDRY_WEB_SEARCH_FUNCTION_NAME
 *
 * The function expects: { queries: string[] }
 * Returns: JSON string with { success, totalQueries, searchResults: [...] }
 */
export async function webSearch(query: string): Promise<string> {
  const functionName = process.env.FOUNDRY_WEB_SEARCH_FUNCTION_NAME || "searchWebBatch";

  // Debug logging
  console.log("[DEBUG] FOUNDRY_WEB_SEARCH_FUNCTION_NAME:", functionName);
  console.log("[DEBUG] All FOUNDRY_ env vars:", Object.keys(process.env).filter(k => k.startsWith('FOUNDRY_')).map(k => `${k}=${process.env[k]?.substring(0, 20)}...`));

  try {
    console.log(`[Foundry] Calling web search function: ${functionName} with query: ${query}`);

    // Function expects queries as an array: { queries: string[] }
    const result = await callFoundryFunction(functionName, { queries: [query] });
    
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
 * Ontology search via Palantir Foundry Ontology API
 * Searches across ontology objects and returns relevant results
 */
export async function ontologySearch(query: string): Promise<string> {
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
      results: response.data?.map((obj) => ({
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
 * List available object types in the Ontology
 * Returns array of object type names (e.g., ["Employee", "Project", "Upload"])
 */
export async function listObjectTypes(): Promise<string[]> {
  const ontologyRid = process.env.FOUNDRY_ONTOLOGY_RID;

  if (!ontologyRid) {
    console.warn('[listObjectTypes] FOUNDRY_ONTOLOGY_RID not set');
    return [];
  }

  try {
    const types = await listOntologyObjectTypes(ontologyRid);
    return types;
  } catch (error) {
    console.error('[listObjectTypes] Error:', error);
    return [];
  }
}

/**
 * Execute both search tools and combine results.
 * Returns SearchResult[] format expected by research-functions.ts
 * @deprecated Use webSearch() and ontologySearch() separately instead
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
