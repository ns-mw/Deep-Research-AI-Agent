/**
 * Test Foundry Web Search Function
 * 
 * Tests the webSearch function directly to verify Foundry integration.
 * 
 * Usage: npx tsx scripts/test-foundry-websearch.ts
 */

// Load environment variables from .env.local or .envrc (if using direnv, vars are already loaded)
import { config } from 'dotenv';
import { resolve } from 'path';
import { existsSync } from 'fs';

// Try .env.local first, then .envrc (though direnv should already load .envrc)
const envLocal = resolve(process.cwd(), '.env.local');
const envrc = resolve(process.cwd(), '.envrc');
if (existsSync(envLocal)) {
  config({ path: envLocal });
} else if (existsSync(envrc)) {
  config({ path: envrc });
}

import { executeFoundrySearch } from '../src/app/api/deep-research/foundry-tools';

async function testWebSearch() {
  console.log('\n🧪 Testing Foundry Web Search Function');
  console.log('═'.repeat(60));
  
  // Check environment variables
  console.log('\n📋 Environment Check:');
  console.log('─'.repeat(60));
  const token = process.env.FOUNDRY_TOKEN;
  const functionRid = process.env.FOUNDRY_WEB_SEARCH_FUNCTION_RID;
  const baseUrl = process.env.FOUNDRY_BASE_URL;
  
  console.log(`FOUNDRY_TOKEN: ${token ? '✓ Set (' + token.substring(0, 20) + '...)' : '❌ Missing'}`);
  console.log(`FOUNDRY_BASE_URL: ${baseUrl || 'Using default'}`);
  console.log(`FOUNDRY_WEB_SEARCH_FUNCTION_RID: ${functionRid ? '✓ ' + functionRid : '❌ Missing (will use mock)'}`);
  
  if (!token) {
    console.error('\n❌ FOUNDRY_TOKEN is required!');
    console.error('   Make sure .env.local is loaded or export the variable');
    process.exit(1);
  }
  
  // Test with a simple query
  const testQuery = 'artificial intelligence';
  console.log(`\n🔍 Testing with query: "${testQuery}"`);
  console.log('─'.repeat(60));
  
  try {
    const startTime = Date.now();
    
    const results = await executeFoundrySearch(testQuery);
    
    const elapsed = Date.now() - startTime;
    
    console.log(`\n✅ Function call completed in ${elapsed}ms`);
    console.log(`\n📊 Results (${results.length} sources):`);
    console.log('─'.repeat(60));
    
    results.forEach((result, index) => {
      console.log(`\n${index + 1}. ${result.title} (${result.url})`);
      console.log(`   Content length: ${result.content.length} chars`);
      
      // Show first 200 chars of content
      const preview = result.content.substring(0, 200);
      console.log(`   Preview: ${preview}...`);
      
      // Check if it's mock data
      if (result.content.includes('Mock') || result.content.includes('placeholder')) {
        console.log('   ⚠️  WARNING: This appears to be mock data');
      } else {
        console.log('   ✅ Real Foundry data!');
      }
    });
    
    console.log('\n' + '═'.repeat(60));
    console.log('✅ Test completed successfully!');
    
    return true;
  } catch (error) {
    console.error('\n❌ Test failed:');
    console.error('─'.repeat(60));
    console.error(error);
    
    if (error instanceof Error) {
      console.error(`\nError message: ${error.message}`);
      console.error(`\nStack trace: ${error.stack}`);
    }
    
    return false;
  }
}

// Run the test
testWebSearch()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
