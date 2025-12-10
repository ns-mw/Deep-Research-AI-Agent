/**
 * Foundry API Client
 * Provides functions to interact with Palantir Foundry APIs
 */

const FOUNDRY_TOKEN = process.env.FOUNDRY_TOKEN;
const FOUNDRY_BASE_URL = process.env.FOUNDRY_BASE_URL;

if (!FOUNDRY_TOKEN || !FOUNDRY_BASE_URL) {
  console.warn('Warning: FOUNDRY_TOKEN or FOUNDRY_BASE_URL not set. Foundry API calls will fail.');
}

// Type definitions for Foundry API responses
interface FoundryOntologyObject {
  rid: string;
  properties: Record<string, unknown>;
}

interface FoundrySearchResponse {
  data?: FoundryOntologyObject[];
  totalCount?: number;
  nextPageToken?: string;
  searchedTypes?: string[];
  message?: string;
}

interface FoundryObjectType {
  apiName: string;
}

interface FoundryObjectTypesResponse {
  data?: FoundryObjectType[];
}

interface FoundryPropertyDefinition {
  baseType?: string;
  type?: string;
  dataType?: { type?: string };
}

interface FoundryObjectSchema {
  properties?: Record<string, FoundryPropertyDefinition>;
}

/**
 * Generic function to call Foundry API endpoints
 */
async function callFoundryAPI(
  endpoint: string,
  options: RequestInit = {}
): Promise<unknown> {
  const url = `${FOUNDRY_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${FOUNDRY_TOKEN}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Foundry API error (${response.status}): ${errorText}`
    );
  }

  return response.json();
}

/**
 * Get the Ontology RID for the default ontology
 * This is a simplified version - in production you might want to:
 * 1. Cache this value
 * 2. Accept ontologyRid as a parameter
 * 3. Have a way to discover/configure the ontology
 *
 * Returns null if not configured (allows graceful fallback)
 */
export async function getOntologyRid(): Promise<string | null> {
  const configuredOntologyRid = process.env.FOUNDRY_ONTOLOGY_RID;

  if (configuredOntologyRid) {
    return configuredOntologyRid;
  }

  return null;
}

/**
 * Search objects in the Foundry Ontology
 * This is a simplified semantic search that queries across object types
 *
 * If no objectType is specified, this will:
 * 1. Discover available object types
 * 2. Search across the first few types (to avoid rate limiting)
 * 3. Combine and return results
 */
export async function searchOntologyObjects(
  searchQuery: string,
  options: {
    ontologyRid?: string;
    objectType?: string;
    maxResults?: number;
    autoDiscover?: boolean; // If true, search across multiple object types
  } = {}
): Promise<FoundrySearchResponse> {
  const ontologyRid = options.ontologyRid || await getOntologyRid();

  // If no ontology RID is configured, return empty results gracefully
  if (!ontologyRid) {
    console.warn('FOUNDRY_ONTOLOGY_RID not configured - ontology search disabled');
    return {
      data: [],
      totalCount: 0,
      message: 'Ontology search not configured'
    };
  }

  const {
    objectType,
    maxResults = 10,
    autoDiscover = false,
  } = options;

  try {
    // If a specific object type is provided, search only that type
    if (objectType) {
      const endpoint = `/api/v1/ontologies/${ontologyRid}/objects/${objectType}/search`;

      const requestBody = {
        query: {
          type: 'anyTerm',
          value: searchQuery,
        },
        pageSize: maxResults,
      };

      return await callFoundryAPI(endpoint, {
        method: 'POST',
        body: JSON.stringify(requestBody),
      }) as FoundrySearchResponse;
    }

    // If autoDiscover is enabled, search across multiple object types
    if (autoDiscover) {
      console.log('Auto-discovering object types and searching...');

      // Get available object types
      const objectTypes = await listObjectTypes(ontologyRid);

      if (objectTypes.length === 0) {
        console.warn('No object types found in ontology');
        return { data: [], totalCount: 0 };
      }

      console.log(`Found ${objectTypes.length} object types, searching top 5...`);

      // Search across first 5 object types to avoid too many API calls
      const typesToSearch = objectTypes.slice(0, 5);
      const searchPromises = typesToSearch.map(type =>
        queryOntologyByType(type, searchQuery, { ontologyRid, maxResults: 3 })
          .catch(err => {
            console.warn(`Failed to search type ${type}:`, err.message);
            return { data: [], totalCount: 0 };
          })
      );

      const results = await Promise.all(searchPromises);

      // Combine results from all types
      const allData = results.flatMap(r => r.data || []);
      const totalCount = results.reduce((sum, r) => sum + (r.totalCount || 0), 0);

      return {
        data: allData.slice(0, maxResults),
        totalCount,
        searchedTypes: typesToSearch,
      };
    }

    // Default: return error asking user to specify object type
    throw new Error(
      'Please specify an objectType or set autoDiscover:true. ' +
      'Use listObjectTypes() to see available types.'
    );

  } catch (error) {
    console.error('Error searching ontology objects:', error);
    throw error;
  }
}

/**
 * Get the schema/properties for a specific object type
 */
export async function getObjectTypeSchema(
  objectType: string,
  ontologyRid?: string
): Promise<FoundryObjectSchema> {
  const rid = ontologyRid || await getOntologyRid();

  if (!rid) {
    throw new Error('FOUNDRY_ONTOLOGY_RID not configured');
  }

  const endpoint = `/api/v1/ontologies/${rid}/objectTypes/${objectType}`;

  try {
    const response = await callFoundryAPI(endpoint, {
      method: 'GET',
    }) as FoundryObjectSchema;

    return response;
  } catch (error) {
    console.error(`Error getting schema for ${objectType}:`, error);
    throw error;
  }
}

/**
 * Extract searchable text field names from an object type schema
 */
function extractSearchableFields(schema: FoundryObjectSchema): string[] {
  const searchableFields: string[] = [];

  if (schema.properties) {
    for (const [fieldName, fieldDef] of Object.entries(schema.properties)) {
      const def = fieldDef as FoundryPropertyDefinition;
      // Check for string fields using the actual Foundry schema structure
      // baseType is the correct field in Foundry schemas
      if (def.baseType === 'String' || def.type === 'string' || def.dataType?.type === 'string') {
        searchableFields.push(`properties.${fieldName}`);
      }
    }
  }

  return searchableFields;
}

/**
 * Query specific object types in the ontology
 * This allows for more targeted searches when you know the object type
 */
export async function queryOntologyByType(
  objectType: string,
  searchQuery: string,
  options: {
    ontologyRid?: string;
    maxResults?: number;
    fields?: string[];
  } = {}
): Promise<FoundrySearchResponse> {
  const ontologyRid = options.ontologyRid || await getOntologyRid();

  if (!ontologyRid) {
    console.warn('FOUNDRY_ONTOLOGY_RID not configured - ontology search disabled');
    return { data: [], totalCount: 0 };
  }

  const {
    maxResults = 10,
    fields,
  } = options;

  const endpoint = `/api/v1/ontologies/${ontologyRid}/objects/${objectType}/search`;

  try {
    // Determine which fields to search
    let searchFields = fields;

    if (!searchFields || searchFields.length === 0) {
      try {
        // Get the object type schema to find searchable fields
        const schema = await getObjectTypeSchema(objectType, ontologyRid);
        searchFields = extractSearchableFields(schema);
        console.log(`  Found ${searchFields.length} searchable fields for ${objectType}`);

        if (searchFields.length === 0) {
          console.warn(`  No searchable string fields found for ${objectType}, skipping`);
          return { data: [], totalCount: 0 };
        }
      } catch {
        console.warn(`  Could not get schema for ${objectType}, skipping`);
        return { data: [], totalCount: 0 };
      }
    }

    // Construct a query that searches across all the fields
    let query;

    if (searchFields.length === 1) {
      // Single field - simple query
      query = {
        type: 'anyTerm',
        field: searchFields[0],
        value: searchQuery,
      };
    } else {
      // Multiple fields - use OR query
      query = {
        type: 'or',
        value: searchFields.map(field => ({
          type: 'anyTerm',
          field: field,
          value: searchQuery,
        })),
      };
    }

    const requestBody = {
      query,
      pageSize: maxResults,
    };

    const response = await callFoundryAPI(endpoint, {
      method: 'POST',
      body: JSON.stringify(requestBody),
    }) as FoundrySearchResponse;

    return response;
  } catch (error) {
    console.error(`Error querying ontology type ${objectType}:`, error);
    throw error;
  }
}

/**
 * List available object types in the ontology
 * Useful for discovering what types of objects are available
 */
export async function listObjectTypes(
  ontologyRid?: string
): Promise<string[]> {
  const rid = ontologyRid || await getOntologyRid();

  if (!rid) {
    console.warn('FOUNDRY_ONTOLOGY_RID not configured - cannot list object types');
    return [];
  }

  const endpoint = `/api/v1/ontologies/${rid}/objectTypes`;

  try {
    const response = await callFoundryAPI(endpoint, {
      method: 'GET',
    }) as FoundryObjectTypesResponse;

    return response.data?.map((type) => type.apiName) || [];
  } catch (error) {
    console.error('Error listing object types:', error);
    throw error;
  }
}
