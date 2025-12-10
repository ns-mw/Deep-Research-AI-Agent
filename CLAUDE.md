# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Deep Research AI Agent being refactored to run on **Palantir Foundry's Language Model Service** via `@northslopetech/foundry-ai-sdk` instead of OpenRouter/Exa. The agent generates follow-up questions, crafts search queries, and compiles comprehensive research reports through an iterative loop.

## Commands

```bash
npm run dev      # Start dev server with Turbopack (localhost:3000)
npm run build    # Production build
npm run lint     # ESLint
npm install --legacy-peer-deps  # Use this flag if dependency issues arise
```

## Environment Variables

Required in `.env.local` (or `.envrc` for direnv):
- `FOUNDRY_TOKEN` - Palantir Foundry API token
- `FOUNDRY_BASE_URL` - Foundry API base URL (e.g., https://northslope.palantirfoundry.com)
- `FOUNDRY_ONTOLOGY_RID` - Your Foundry Ontology RID (required for ontology search)

### Finding Your Ontology RID

To find your Ontology RID:
1. Navigate to your Ontology in Foundry
2. Copy the RID from the URL (format: `ri.ontology.main.ontology.xxxxxxxx`)
3. Or use the Palantir MCP tool `get_foundry_ontology_rid` if you have it configured

## Deep Research Agent: Search Strategy

The research agent has been updated with comprehensive guidance on using both internal (Ontology) and external (Web) search sources.

### Agent's Search Capabilities

**Dual-Source Search**: Every search query is executed against BOTH sources simultaneously:
1. **Web Search (External)**: Public internet, best practices, open-source knowledge
2. **Ontology Search (Internal)**: Company-specific data, internal entities, proprietary information

### Iterative Search Strategy

The agent has been trained to:

1. **Initial Planning**: Generate diverse queries that work for both internal and external sources
2. **Result Analysis**: Understand what was found (or not found) in each source
3. **Iterative Refinement**: Create follow-up queries based on:
   - Specific entities discovered in Ontology results
   - Object types available but not yet matched
   - Gaps in coverage identified from both sources

### Key Prompt Updates

**Planning Phase (`PLANNING_SYSTEM_PROMPT`)**:
- Understands dual-source architecture
- Generates queries optimized for both internal and external data
- Balances between company-specific and general queries

**Analysis Phase (`ANALYSIS_SYSTEM_PROMPT`)**:
- Interprets Ontology results (RIDs, properties, searchedTypes)
- Identifies when to create targeted follow-up queries
- Uses discovered entity names in subsequent searches
- Handles empty results appropriately

**Extraction Phase (`EXTRACTION_SYSTEM_PROMPT`)**:
- Processes structured Ontology data (JSON with entities)
- Extracts web content (standard HTML/text)
- Preserves entity relationships and RIDs

**Report Phase (`REPORT_SYSTEM_PROMPT`)**:
- Clearly distinguishes internal vs external information
- Creates dedicated sections for company-specific data
- Maintains traceability with RIDs and entity references

## Ontology Query Tool

### Available Parameters

The `searchOntologyObjects()` function supports these parameters:

```typescript
searchOntologyObjects(searchQuery: string, options?: {
  ontologyRid?: string;      // Your ontology RID (defaults to FOUNDRY_ONTOLOGY_RID env var)
  objectType?: string;        // Specific object type to search (optional)
  maxResults?: number;        // Maximum results to return (default: 10)
  autoDiscover?: boolean;     // Auto-discover and search across types (default: false)
})
```

### Usage Modes

**1. Auto-Discover Mode (Recommended for Research Agent)**
```typescript
// Automatically discovers object types and searches across them
const results = await searchOntologyObjects("employee data", {
  autoDiscover: true,
  maxResults: 10
});
```

**2. Specific Object Type**
```typescript
// Search a specific object type when you know what you're looking for
const results = await searchOntologyObjects("John Smith", {
  objectType: "Employee",
  maxResults: 5
});
```

**3. List Available Types First**
```typescript
// Discover what object types exist in your ontology
const types = await listObjectTypes();
console.log(types); // ["Employee", "Department", "Project", ...]
```

### Testing

Run the ontology query test:
```bash
npm run test:ontology
```

Or manually:
```bash
npx tsx scripts/test-ontology-query.ts
```

**Note:** You must set `FOUNDRY_ONTOLOGY_RID` in your `.envrc` before running tests.

## Architecture

### Research Flow (`src/app/api/deep-research/`)

The iterative research loop in `main.ts`:
1. **Planning** → `generateSearchQueries()` creates initial queries
2. **Search** → `search()` fetches results (currently Exa, migrating to Foundry)
3. **Extract** → `processSearchResults()` / `extractContent()` summarizes each result
4. **Analyze** → `analyzeFindings()` determines if content is sufficient or needs more queries
5. **Report** → `generateReport()` creates final markdown report

### Key Files to Modify

| File | Purpose | Migration Notes |
|------|---------|-----------------|
| `model-caller.ts` | LLM abstraction layer | **Critical**: Replace `generateObject` with forced tool call workaround |
| `services.ts` | Provider initialization | Replace OpenRouter/Exa with Foundry provider |
| `constants.ts` | Model identifiers | Update to Foundry model IDs (e.g., `GPT_4o`) |
| `research-functions.ts` | Search implementation | Replace Exa with Foundry tools |

### Files Created

| File | Purpose | Status |
|------|---------|--------|
| `src/lib/foundry-provider.ts` | Initialize `@northslopetech/foundry-ai-sdk` | ✅ Created |
| `src/lib/foundry-client.ts` | Foundry API client for ontology queries | ✅ Created |
| `src/app/api/deep-research/foundry-tools.ts` | Web search + Ontology search tools | ✅ Implemented |

## Critical Foundry Provider Constraints

### 1. No `generateObject` Support
The Foundry provider fails on `generateObject`. Use this workaround pattern:

```typescript
const { toolCalls } = await generateText({
  model: foundry(model),
  prompt,
  system: system + "\n\nIMPORTANT: You must respond ONLY by calling the 'submit_result' tool.",
  tools: {
    submit_result: tool({
      description: 'Submit the final structured result',
      parameters: zodSchema,
      providerOptions: { foundry: { parameters: jsonSchema } }, // REQUIRED
    })
  },
  toolChoice: 'required',
  maxSteps: 1,
});
return toolCalls?.[0]?.args;
```

### 2. Dual Schema Requirement
Every tool must include **both** Zod schema AND manual JSON schema in `providerOptions`:

```typescript
const params = z.object({ query: z.string() });
const jsonSchema = { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] };

export const myTool = tool({
  parameters: params,
  providerOptions: { foundry: { parameters: jsonSchema } }, // Without this, tools send empty
  // ...
});
```

### 3. Context Window Limits
Foundry Ontology results are massive. **Always truncate** tool outputs:

```typescript
return JSON.stringify(result).slice(0, 15000);
```

## State Management

- `src/store/deepResearch.ts` - Zustand store for UI state
- `ResearchState` type in `types.ts` tracks: topic, findings, token usage, completed steps

## UI Components

- `src/components/ui/deep-research/` - Research-specific components
- `src/components/ui/` - Shadcn UI primitives
