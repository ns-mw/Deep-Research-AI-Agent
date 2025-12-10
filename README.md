# Deep Research AI Agent

A powerful deep research agent that leverages **Palantir Foundry's Language Model Service** to conduct comprehensive research across both internal ontology data and external web sources.

## Overview

This agent generates follow-up questions, crafts optimal search queries, and compiles comprehensive research reports through an iterative research loop. It seamlessly integrates both company-specific data from your Foundry Ontology and public web information to provide complete, contextualized research.

## Key Features

- **Dual-Source Search**: Simultaneously queries Foundry Ontology (internal) and Web (external) sources
- **Intelligent Query Generation**: Creates diverse, targeted queries optimized for both data sources
- **Iterative Research Loop**: Analyzes findings and generates follow-up queries to fill gaps
- **Structured Ontology Integration**: Extracts entities, properties, and relationships from Foundry
- **Comprehensive Reporting**: Generates detailed markdown reports with clear source attribution
- **Real-time Streaming**: See research progress as it happens

## Tech Stack

- **Framework**: Next.js 15 (App Router with Turbopack)
- **AI Integration**: Vercel AI SDK with `@northslopetech/foundry-ai-sdk`
- **Data Platform**: Palantir Foundry (Ontology API + LLM Service)
- **Styling**: Tailwind CSS, Shadcn UI
- **Language**: TypeScript

## Prerequisites

Before you begin, ensure you have:

- Access to Palantir Foundry instance
- Foundry API token with appropriate permissions
- Your Foundry Ontology RID

## Setup Instructions

### 1. Clone the Repository

```bash
git clone [repo-url]
cd Deep-Research-AI-Agent
```

### 2. Install Dependencies

> **NOTE:** Use the `--legacy-peer-deps` flag if you encounter dependency issues.

```bash
npm install --legacy-peer-deps
```

### 3. Environment Variables

Create a `.env.local` file (or `.envrc` if using direnv) with the following:

```bash
FOUNDRY_TOKEN=your_foundry_api_token
FOUNDRY_BASE_URL=https://your-instance.palantirfoundry.com
FOUNDRY_ONTOLOGY_RID=ri.ontology.main.ontology.xxxxxxxx
```

To find your Ontology RID:
1. Navigate to your Ontology in Foundry
2. Copy the RID from the URL
3. Or use: `get_foundry_ontology_rid` if you have the Palantir MCP tool configured

### 4. Start Development Server

```bash
npm run dev
```

Visit `http://localhost:3000` to use the research agent.

## Available Commands

```bash
npm run dev         # Start dev server with Turbopack
npm run build       # Production build
npm run lint        # Run ESLint
npm run test:api    # Test Foundry API connection
npm run test:ontology  # Test ontology query functionality
```

## How It Works

The research agent follows an iterative loop:

1. **Planning**: Generates diverse search queries for both Ontology and Web sources
2. **Search**: Executes queries against both sources simultaneously
3. **Extract**: Summarizes and structures results from each source
4. **Analyze**: Determines if findings are sufficient or generates follow-up queries
5. **Report**: Compiles comprehensive markdown report with source attribution

### Search Strategy

The agent uses a dual-source approach:

- **Ontology Search**: Queries internal company data, entities, and relationships
- **Web Search**: Retrieves public information, best practices, and external context

Results are clearly attributed, and the agent iteratively refines queries based on what it discovers in each source.

## Documentation

See `CLAUDE.md` for detailed technical documentation including:
- Architecture overview
- Research flow details
- Foundry provider constraints
- Tool implementation
- Testing procedures

## Project Structure

```
├── src/
│   ├── app/
│   │   └── api/deep-research/    # Research agent API
│   ├── components/ui/             # UI components
│   ├── lib/                       # Core libraries
│   │   ├── foundry-provider.ts   # Foundry AI SDK setup
│   │   └── foundry-client.ts     # Ontology API client
│   └── store/                     # State management
├── scripts/                       # Testing scripts
└── docs/                          # Additional documentation
```

## License

MIT
