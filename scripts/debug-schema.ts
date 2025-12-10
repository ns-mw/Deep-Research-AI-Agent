/**
 * Debug script to inspect object type schemas
 */

import { getObjectTypeSchema, listObjectTypes } from '../src/lib/foundry-client';

const FOUNDRY_ONTOLOGY_RID = process.env.FOUNDRY_ONTOLOGY_RID;

if (!FOUNDRY_ONTOLOGY_RID) {
  console.error('❌ FOUNDRY_ONTOLOGY_RID not set!');
  process.exit(1);
}

async function main() {
  console.log('🔍 Inspecting Object Type Schemas\n');

  // Get first few object types
  const types = await listObjectTypes(FOUNDRY_ONTOLOGY_RID);
  console.log(`Found ${types.length} object types\n`);

  // Inspect first 3 types in detail
  for (const type of types.slice(0, 3)) {
    try {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`Object Type: ${type}`);
      console.log('='.repeat(60));

      const schema = await getObjectTypeSchema(type, FOUNDRY_ONTOLOGY_RID);

      console.log('\nFull Schema:', JSON.stringify(schema, null, 2));

      if (schema.properties) {
        console.log('\n📋 Properties:');
        for (const [propName, propDef] of Object.entries(schema.properties)) {
          console.log(`  - ${propName}:`, JSON.stringify(propDef, null, 2));
        }
      } else {
        console.log('\n⚠️  No properties found in schema');
      }
    } catch (error) {
      console.error(`\n❌ Error getting schema for ${type}:`, error);
    }
  }
}

main().catch(console.error);
