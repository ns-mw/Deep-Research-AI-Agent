/**
 * Foundry OSDK Client Setup
 * 
 * Creates and exports a Foundry OSDK client for ontology queries and function calls.
 * Uses confidential OAuth client authentication (works for service users).
 * 
 * Note: Service users use OAuth (client_id/client_secret) for OSDK access.
 * For direct API calls (like function invocations), use FOUNDRY_TOKEN instead.
 */

import { Client, createClient } from "@osdk/client";
import { createConfidentialOauthClient } from "@osdk/oauth";

// Environment variables
const client_id: string = process.env.FOUNDRY_CLIENT_ID || "2838db6ed005984c06431ae45bbf4d29";
const url: string = process.env.FOUNDRY_BASE_URL || "https://northslope.palantirfoundry.com";
const ontologyRid: string = process.env.FOUNDRY_ONTOLOGY_RID || "ri.ontology.main.ontology.8ab32810-4c30-4343-b400-392685162049";
const client_secret: string = process.env.FOUNDRY_CLIENT_SECRET || "";

const scopes: string[] = [
  "api:use-ontologies-read",
  "api:use-ontologies-write",
  "api:use-mediasets-read",
  "api:use-mediasets-write",
];

// Create OAuth client
const auth = createConfidentialOauthClient(client_id, client_secret, url, scopes);

// Create and export Foundry client
export const foundryClient: Client = createClient(url, ontologyRid, auth);

