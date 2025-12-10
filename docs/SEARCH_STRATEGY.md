# Deep Research Agent: Search Strategy Guide

This document explains how the research agent has been trained to use the ontology query tool iteratively and effectively.

## Overview

The research agent searches **TWO sources simultaneously** with every query:
- **Web Search (External)**: Public internet via Firecrawl
- **Ontology Search (Internal)**: Company data via Foundry Ontology API

## Agent Training: What the Prompts Teach

### Phase 1: Planning (`PLANNING_SYSTEM_PROMPT`)

**What the agent learns:**

✅ Both sources exist and will be queried together
✅ How to craft queries that work well for both sources
✅ When to use company-specific terminology vs general terms
✅ Examples of good vs bad queries

**Example Training:**
```
Bad: "data" (too vague, low signal)
Good: "customer analytics dashboard implementation" (specific, works for both)
Good: "employee onboarding process documentation" (likely internal data)
Good: "TypeScript best practices 2025" (likely external data)
```

### Phase 2: Extraction (`EXTRACTION_SYSTEM_PROMPT`)

**What the agent learns:**

✅ Ontology results are structured JSON (not web text)
✅ How to interpret: query, totalCount, searchedTypes, results[], RIDs, properties
✅ How to extract entity information from structured data
✅ How to format ontology findings for later analysis

**Example Ontology Result the Agent Sees:**
```json
{
  "query": "project alpha",
  "totalCount": 2,
  "searchedTypes": ["T6Resource", "KeyPeople"],
  "results": [
    {
      "rid": "ri.ontology.main.object.abc123",
      "properties": {
        "resourceId": "res-001",
        "name": "Project Alpha",
        "owner": "Alice Smith",
        "status": "Active"
      }
    }
  ]
}
```

**What the Agent Extracts:**
```markdown
## Internal Data: Project Alpha

Searched Types: T6Resource, KeyPeople
Found: 2 entities

**T6Resource: Project Alpha**
- Resource ID: res-001
- Owner: Alice Smith
- Status: Active
- RID: ri.ontology.main.object.abc123
```

### Phase 3: Analysis (`ANALYSIS_SYSTEM_PROMPT`)

**What the agent learns:**

✅ How to identify if data was found (totalCount > 0)
✅ What searchedTypes reveals (what object types exist)
✅ When to create follow-up queries
✅ How to use discovered entities in new searches

**Iterative Search Decision Tree:**

```
Did we find entities? (totalCount > 0)
├─ YES → Extract property values → Use in follow-up queries
│         Example: Found "Alice Smith" → Search "Alice Smith projects"
│
└─ NO → Check searchedTypes
    ├─ Relevant types exist? → Try different terms
    │   Example: searchedTypes shows "KeyPeople" but got 0 results
    │   → Try "engineer" instead of "developer"
    │
    └─ No relevant types? → Topic likely external-only
        → Focus on web results
```

**When to Search Again:**

1. **Discovered Relevant Entities**
   ```
   Found: Project Alpha (owner: Alice Smith, status: Active)
   Follow-up: "Alice Smith projects", "Project Alpha status report"
   ```

2. **Found Object Types But No Matches**
   ```
   searchedTypes: ["KeyPeople"]
   totalCount: 0
   Follow-up: Try synonyms like "employee", "staff", "team member"
   ```

3. **Missing Critical Information**
   ```
   Web: General best practices
   Ontology: No results
   Follow-up: Try company-specific terms, internal project names
   ```

### Phase 4: Report Generation (`REPORT_SYSTEM_PROMPT`)

**What the agent learns:**

✅ Clearly separate internal vs external information
✅ Create dedicated sections for company-specific data
✅ Preserve RIDs and entity details for traceability
✅ Handle missing internal data gracefully

**Report Structure:**
```markdown
# Topic Overview
General knowledge and external best practices...

## Company-Specific Implementation
### Internal Resources Found
- **Project Alpha** (RID: ri.ontology.main.object.abc123)
  - Owner: Alice Smith
  - Status: Active
  ...

## External Best Practices
Information from public sources...

## Internal Resources
- T6Resource: Project Alpha (ri.ontology.main.object.abc123)
- KeyPeople: Alice Smith (ri.ontology.main.object.def456)
```

## Real-World Example: Research Flow

### User Query: "Tell me about our data analytics projects"

**Iteration 1: Initial Search**

Agent generates queries:
- "data analytics projects implementation"
- "analytics dashboard tools"
- "data visualization platforms"

Results:
- Web: General articles about analytics tools
- Ontology: Found 3 entities in T6Resource type with "analytics" in properties

**Iteration 2: Targeted Follow-up**

Agent extracts from Ontology:
- Project: "Customer Analytics Dashboard"
- Owner: "Bob Chen"
- Status: "In Progress"

Agent generates follow-up:
- "Customer Analytics Dashboard status"
- "Bob Chen analytics projects"

Results:
- Ontology: More details about the dashboard project
- Web: Best practices for customer analytics

**Iteration 3: Deep Dive**

Agent now knows specific project names and owners, generates:
- "Customer Analytics Dashboard architecture"
- "Bob Chen team members"

**Final Report:**

```markdown
# Data Analytics Projects at [Company]

## Overview
Data analytics involves... [general knowledge]

## Internal Analytics Projects

### Customer Analytics Dashboard
- **Status**: In Progress
- **Owner**: Bob Chen
- **RID**: ri.ontology.main.object.xyz789
- **Purpose**: Real-time customer behavior tracking
- **Technologies**: [from web research]

### Related Personnel
- **Bob Chen** - Project Lead
- **Team Members**: [if found in ontology]

## Industry Best Practices
[Information from web sources]

## Internal Resources
- T6Resource: Customer Analytics Dashboard
- KeyPeople: Bob Chen
```

## Key Success Factors

### ✅ Agent Understands:
1. Ontology results are structured (JSON), not text
2. Empty results (totalCount: 0) mean no matches, not an error
3. searchedTypes reveals what internal data categories exist
4. Entity properties can be used in follow-up searches
5. Both sources provide value - use them together

### ✅ Agent Avoids:
1. Treating empty Ontology results as failures
2. Ignoring searchedTypes information
3. Fabricating internal data when none exists
4. Generic follow-up queries when specific entities were found
5. Mixing up internal entity data with external knowledge

## Testing the Updated Prompts

To verify the agent uses the ontology correctly:

1. **Test with internal entities**: Research a topic with known internal data
2. **Watch for iteration**: Agent should create follow-up queries using discovered entities
3. **Check report**: Should clearly separate internal vs external information
4. **Verify RIDs**: Internal entities should include RIDs for traceability

Example test topics:
- "Our current projects" (likely finds internal data)
- "TypeScript best practices" (likely external only)
- "Employee Alice Smith's work" (if Alice exists in ontology)
