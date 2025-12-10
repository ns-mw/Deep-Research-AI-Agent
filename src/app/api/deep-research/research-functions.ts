/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  ActivityTracker,
  ResearchFindings,
  ResearchState,
  SearchResult,
} from "./types";
import { z } from "zod";
import {
  ANALYSIS_SYSTEM_PROMPT,
  EXTRACTION_SYSTEM_PROMPT,
  getAnalysisPrompt,
  getExtractionPrompt,
  getPlanningPrompt,
  getReportPrompt,
  PLANNING_SYSTEM_PROMPT,
  REPORT_SYSTEM_PROMPT,
} from "./prompts";
import { callModel } from "./model-caller";
import { webSearch, ontologySearch } from "./foundry-tools";
import { combineFindings, handleError } from "./utils";
import { MAX_ITERATIONS, MODELS } from "./constants";

export async function generateSearchQueries(
  researchState: ResearchState,
  activityTracker: ActivityTracker
) {
  try{
    activityTracker.add("planning","pending","Planning the research");

  const result = await callModel(
    {
      model: MODELS.PLANNING,
      prompt: getPlanningPrompt(
        researchState.topic,
        researchState.clerificationsText
      ),
      system: PLANNING_SYSTEM_PROMPT,
      schema: z.object({
        searchQueries: z
          .array(
            z.object({
              query: z.string().describe("The search query text"),
              source: z.enum(["web", "ontology"]).describe("Which search tool to use: 'web' for external internet search, 'ontology' for internal company data"),
            })
          )
          .describe(
            "Array of search queries with their designated source. Generate 2-5 queries using a mix of both sources. (max 5 queries)"
          ),
      }),
      activityType: "planning"
    },
    researchState, activityTracker
  );

  activityTracker.add("planning", "complete", "Crafted the research plan");

  return result;
  }catch(error){
    // If planning fails completely, use minimal fallback
    return handleError(error, `Research planning`, activityTracker, "planning", {
        searchQueries: [
          { query: researchState.topic, source: "web" }
        ]
    })

  }
}

export async function search(
  query: string,
  source: "web" | "ontology",
  researchState: ResearchState,
  activityTracker: ActivityTracker
): Promise<SearchResult[]> {
  const sourceLabel = source === "web" ? "Web" : "Ontology";
  activityTracker.add("search", "pending", `Searching ${sourceLabel} for ${query}`);

  try {
    let content: string;
    let title: string;
    let url: string;

    if (source === "web") {
      content = await webSearch(query);
      title = "Web Results";
      url = "Firecrawl";
    } else {
      content = await ontologySearch(query);
      title = "Ontology Results";
      url = "Foundry";
    }

    researchState.completedSteps++;

    activityTracker.add("search", "complete", `Found ${sourceLabel} results for ${query}`);

    return [{ title, url, content }];
  } catch (error) {
    console.log("error: ", error);
    return handleError(error, `Searching ${sourceLabel} for ${query}`, activityTracker, "search", []) || [];
  }
}

export async function extractContent(
  content: string,
  url: string,
  researchState: ResearchState,
  activityTracker: ActivityTracker
) {

    try{
        activityTracker.add("extract","pending",`Extracting content from ${url}`);

        const result = await callModel(
          {
            model: MODELS.EXTRACTION,
            prompt: getExtractionPrompt(
              content,
              researchState.topic,
              researchState.clerificationsText
            ),
            system: EXTRACTION_SYSTEM_PROMPT,
            schema: z.object({
              summary: z.string().describe("A comprehensive summary of the content"),
            }),
            activityType: "extract"
          },
          researchState, activityTracker
        );
      
        activityTracker.add("extract","complete",`Extracted content from ${url}`);
      
        return {
          url,
          summary: (result as any).summary,
        };
    }catch(error){
        return handleError(error, `Content extraction from ${url}`, activityTracker, "extract", null) || null
    }
}

export async function processSearchResults(
  searchResults: SearchResult[],
  researchState: ResearchState,
  activityTracker: ActivityTracker
): Promise<ResearchFindings[]> {
  const extractionPromises = searchResults.map((result) =>
    extractContent(result.content, result.url, researchState, activityTracker)
  );
  const extractionResults = await Promise.allSettled(extractionPromises);

  type ExtractionResult = { url: string; summary: string };

  const newFindings = extractionResults
    .filter(
      (result): result is PromiseFulfilledResult<ExtractionResult> =>
        result.status === "fulfilled" &&
        result.value !== null &&
        result.value !== undefined
    )
    .map((result) => {
      const { summary, url } = result.value;
      return {
        summary,
        source: url,
      };
    });

  return newFindings;
}

export async function analyzeFindings(
  researchState: ResearchState,
  currentQueries: string[],
  currentIteration: number,
  activityTracker: ActivityTracker
) {
  try {
    activityTracker.add("analyze","pending",`Analyzing research findings (iteration ${currentIteration}) of ${MAX_ITERATIONS}`);
    const contentText = combineFindings(researchState.findings);

    const result = await callModel(
      {
        model: MODELS.ANALYSIS,
        prompt: getAnalysisPrompt(
          contentText,
          researchState.topic,
          researchState.clerificationsText,
          currentQueries,
          currentIteration,
          MAX_ITERATIONS,
          contentText.length
        ),
        system: ANALYSIS_SYSTEM_PROMPT,
        schema: z.object({
          sufficient: z
            .boolean()
            .describe(
              "Whether the collected content is sufficient for a useful report"
            ),
          gaps: z.array(z.string()).describe("Identified gaps in the content"),
          queries: z
            .array(
              z.object({
                query: z.string().describe("The search query text"),
                source: z.enum(["web", "ontology"]).describe("Which search tool to use"),
              })
            )
            .describe(
              "Search queries for missing information with designated source. Max 5 queries."
            ),
        }),
        activityType: "analyze"
      },
      researchState, activityTracker
    );

    const isContentSufficient = typeof result !== 'string' && result.sufficient; 

    activityTracker.add("analyze","complete",`Analyzed collected research findings: ${isContentSufficient ? 'Content is sufficient' : 'More research is needed!'}`);

    return result;
  } catch (error) {
    return handleError(error, `Content analysis`, activityTracker, "analyze", {
        sufficient: false,
        gaps: ["Unable to analyze content"],
        queries: [{ query: "Please try a different search query", source: "web" }]
    })
  }
}

export async function generateReport(researchState: ResearchState, activityTracker: ActivityTracker) {
  try {
    activityTracker.add("generate","pending",`Geneating comprehensive report!`);

    const contentText = combineFindings(researchState.findings);

    const report = await callModel(
      {
        model: MODELS.REPORT,
        prompt: getReportPrompt(
          contentText,
          researchState.topic,
          researchState.clerificationsText
        ),
        system: REPORT_SYSTEM_PROMPT,
        activityType: "generate"
      },
      researchState, activityTracker
    );

    activityTracker.add("generate","complete",`Generated comprehensive report, Total tokens used: ${researchState.tokenUsed}. Research completed in ${researchState.completedSteps} steps.`);

    return report;
  } catch (error) {
    console.log(error);
    return handleError(error, `Report Generation`, activityTracker, "generate", "Error generating report. Please try again. ")
  }
}
