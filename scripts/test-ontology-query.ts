/**
 * Ontology Query Test
 *
 * Tests the Foundry Ontology query functionality
 *
 * Usage: npx tsx scripts/test-ontology-query.ts
 */

import {
  searchOntologyObjects,
  queryOntologyByType,
  listObjectTypes,
} from '../src/lib/foundry-client';

// Check env vars
const FOUNDRY_TOKEN = process.env.FOUNDRY_TOKEN;
const FOUNDRY_BASE_URL = process.env.FOUNDRY_BASE_URL;
const FOUNDRY_ONTOLOGY_RID = process.env.FOUNDRY_ONTOLOGY_RID;

console.log('🔧 Environment Check');
console.log('─'.repeat(50));
console.log(
  `FOUNDRY_TOKEN: ${
    FOUNDRY_TOKEN ? '✓ Set (' + FOUNDRY_TOKEN.substring(0, 10) + '...)' : '❌ Missing'
  }`
);
console.log(`FOUNDRY_BASE_URL: ${FOUNDRY_BASE_URL ? '✓ ' + FOUNDRY_BASE_URL : '❌ Missing'}`);
console.log(
  `FOUNDRY_ONTOLOGY_RID: ${
    FOUNDRY_ONTOLOGY_RID ? '✓ ' + FOUNDRY_ONTOLOGY_RID : '❌ Missing'
  }`
);

if (!FOUNDRY_TOKEN || !FOUNDRY_BASE_URL) {
  console.error('\n❌ Missing environment variables!');
  console.error('   Make sure .envrc is loaded (run: direnv allow)');
  process.exit(1);
}

if (!FOUNDRY_ONTOLOGY_RID) {
  console.error('\n❌ FOUNDRY_ONTOLOGY_RID not set!');
  console.error('   Please set this in your .envrc file');
  console.error('   Format: export FOUNDRY_ONTOLOGY_RID=ri.ontology.main.ontology.xxxxxxxx');
  process.exit(1);
}

async function testListObjectTypes() {
  console.log('\n📋 Test 1: List Available Object Types');
  console.log('─'.repeat(50));

  try {
    console.log('  Fetching object types...');
    const startTime = Date.now();

    const objectTypes = await listObjectTypes(FOUNDRY_ONTOLOGY_RID);

    const elapsed = Date.now() - startTime;
    console.log(`  Response time: ${elapsed}ms`);
    console.log(`  Found ${objectTypes.length} object types`);

    if (objectTypes.length > 0) {
      console.log('\n  Available object types:');
      objectTypes.slice(0, 10).forEach((type, i) => {
        console.log(`    ${i + 1}. ${type}`);
      });
      if (objectTypes.length > 10) {
        console.log(`    ... and ${objectTypes.length - 10} more`);
      }
      console.log('\n  ✅ List object types: PASSED');
      return { passed: true, objectTypes };
    } else {
      console.log('\n  ⚠️  No object types found (empty ontology?)');
      return { passed: true, objectTypes: [] };
    }
  } catch (error) {
    console.error('\n  ❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('     Message:', error.message);
    }
    return { passed: false, objectTypes: [] };
  }
}

async function testSearchWithAutoDiscover(searchQuery: string) {
  console.log('\n📋 Test 2: Search with Auto-Discover (Multiple Types)');
  console.log('─'.repeat(50));
  console.log(`  Query: "${searchQuery}"`);

  try {
    console.log('  Searching ontology with auto-discover...');
    const startTime = Date.now();

    const response = await searchOntologyObjects(searchQuery, {
      ontologyRid: FOUNDRY_ONTOLOGY_RID,
      maxResults: 10,
      autoDiscover: true, // This will discover and search across types
    });

    const elapsed = Date.now() - startTime;
    console.log(`  Response time: ${elapsed}ms`);
    console.log(`  Types searched: ${response.searchedTypes?.length || 0}`);
    if (response.searchedTypes && response.searchedTypes.length > 0) {
      console.log(`    - ${response.searchedTypes.join(', ')}`);
    }
    console.log(`  Total matches: ${response.totalCount || 0}`);
    console.log(`  Results returned: ${response.data?.length || 0}`);

    if (response.data && response.data.length > 0) {
      console.log('\n  Results:');
      response.data.forEach((obj: any, i: number) => {
        console.log(`\n    ${i + 1}. RID: ${obj.rid}`);
        console.log(`       Properties:`, JSON.stringify(obj.properties, null, 8).substring(0, 200));
      });
      console.log('\n  ✅ Auto-discover search: PASSED');
      return true;
    } else {
      console.log('\n  ℹ️  No results found for this query');
      console.log('     Try a different search term');
      return true; // Not a failure, just no matches
    }
  } catch (error) {
    console.error('\n  ❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('     Message:', error.message);
    }
    return false;
  }
}

async function testQuerySpecificType(objectType: string, searchQuery: string) {
  console.log('\n📋 Test 3: Query Specific Object Type');
  console.log('─'.repeat(50));
  console.log(`  Object Type: "${objectType}"`);
  console.log(`  Query: "${searchQuery}"`);

  try {
    console.log('  Querying ontology...');
    const startTime = Date.now();

    const response = await queryOntologyByType(objectType, searchQuery, {
      ontologyRid: FOUNDRY_ONTOLOGY_RID,
      maxResults: 5,
    });

    const elapsed = Date.now() - startTime;
    console.log(`  Response time: ${elapsed}ms`);
    console.log(`  Total matches: ${response.totalCount || 0}`);
    console.log(`  Results returned: ${response.data?.length || 0}`);

    if (response.data && response.data.length > 0) {
      console.log('\n  Results:');
      response.data.forEach((obj: any, i: number) => {
        console.log(`\n    ${i + 1}. RID: ${obj.rid}`);
        console.log(`       Properties:`, JSON.stringify(obj.properties, null, 8).substring(0, 200));
      });
      console.log('\n  ✅ Query specific type: PASSED');
      return true;
    } else {
      console.log('\n  ℹ️  No results found for this type/query combination');
      return true;
    }
  } catch (error) {
    console.error('\n  ❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('     Message:', error.message);

      // Provide helpful guidance for common errors
      if (error.message.includes('404') || error.message.includes('not found')) {
        console.error('\n     💡 Tip: The object type may not exist in your ontology.');
        console.error('        Run Test 1 to see available object types.');
      }
    }
    return false;
  }
}

async function main() {
  console.log('\n🚀 Foundry Ontology Query Test');
  console.log('═'.repeat(50));

  const results: boolean[] = [];

  // Test 1: List object types (helps us know what's available)
  const { passed: test1Passed, objectTypes } = await testListObjectTypes();
  results.push(test1Passed);

  // Test 2: Search with auto-discover (searches across multiple object types)
  // You can customize this query based on your ontology
  const genericQuery = 'data'; // Change this to match something in your ontology
  results.push(await testSearchWithAutoDiscover(genericQuery));

  // Test 3: Query a specific object type (if we found any in Test 1)
  if (objectTypes.length > 0) {
    const firstObjectType = objectTypes[0];
    results.push(await testQuerySpecificType(firstObjectType, genericQuery));
  } else {
    console.log('\n📋 Test 3: Skipped (no object types available)');
  }

  console.log('\n' + '═'.repeat(50));
  console.log('📊 Summary');
  console.log('─'.repeat(50));

  const passed = results.filter((r) => r).length;
  console.log(`Passed: ${passed}/${results.length}`);

  if (passed === results.length) {
    console.log('\n✅ All tests passed!');
    console.log('\n💡 Integration Status:');
    console.log('   The ontology query tool is working correctly and can be used');
    console.log('   by the deep research agent to search internal Foundry data.');
  } else {
    console.log('\n⚠️  Some tests failed - check output above');
  }

  console.log('\n📝 Notes:');
  console.log('   • Object types are specific to your Foundry ontology');
  console.log('   • Search queries use semantic text matching');
  console.log('   • Results are automatically truncated to 15KB');
  console.log('   • Customize the search queries in this script to match your data');
}

main().catch(console.error);
