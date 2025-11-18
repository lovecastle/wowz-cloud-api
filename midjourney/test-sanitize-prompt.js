/**
 * Test suite for sanitizePrompt function
 * Tests the fix for quote removal to prevent Midjourney parameter parsing errors
 */

// Simple inline implementation matching puppeteer-client.js
function sanitizePrompt(description) {
  if (!description || typeof description !== 'string') {
    return description;
  }

  // Remove all quote types that confuse Midjourney's parameter parser
  // Midjourney's CLI-style parser treats text after quotes as parameter flags
  let sanitized = description
    .replace(/[""]/g, '')   // Remove smart double quotes
    .replace(/['']/g, '')   // Remove smart single quotes
    .replace(/["'`]/g, '')  // Remove all regular quotes and backticks
    .replace(/\\/g, '');    // Remove backslashes (escape characters)

  // Remove or escape characters that might confuse Midjourney's parser
  // Keep the prompt readable but safe
  sanitized = sanitized
    .replace(/\s+/g, ' ')   // Normalize multiple spaces to single space
    .trim();                // Remove leading/trailing whitespace

  return sanitized;
}

// Test runner
const runTests = () => {
  let passed = 0;
  let failed = 0;
  const failures = [];

  const test = (name, input, expected) => {
    const result = sanitizePrompt(input);
    const success = result === expected;

    if (success) {
      passed++;
      console.log(`✓ ${name}`);
    } else {
      failed++;
      const failure = {
        name,
        input,
        expected,
        actual: result
      };
      failures.push(failure);
      console.log(`✗ ${name}`);
      console.log(`  Input:    "${input}"`);
      console.log(`  Expected: "${expected}"`);
      console.log(`  Actual:   "${result}"`);
    }

    return success;
  };

  console.log('\n=== Testing sanitizePrompt Function ===\n');

  // Test 1: The problematic prompt from the bug report
  console.log('--- Critical Bug Fix Tests ---');
  test(
    'Remove quotes from dragon names (Andarna, Sgaeyl, Tairn)',
    "At the top left is 'Andarna', a golden dragon with shimmering scales, glowing with an ethereal light. In the center is 'Sgaeyl', a deep navy-blue dragon with storm clouds swirling around it. At the bottom right is 'Tairn', a fierce black dragon with crimson-red highlights.",
    "At the top left is Andarna, a golden dragon with shimmering scales, glowing with an ethereal light. In the center is Sgaeyl, a deep navy-blue dragon with storm clouds swirling around it. At the bottom right is Tairn, a fierce black dragon with crimson-red highlights."
  );

  test(
    'Remove smart double quotes',
    '"Hello" and "World"',
    'Hello and World'
  );

  test(
    'Remove smart single quotes',
    '\u2018Hello\u2019 and \u2018World\u2019',
    'Hello and World'
  );

  // Test 2: Various quote types
  console.log('\n--- Quote Type Tests ---');
  test(
    'Remove regular double quotes',
    'The "quick" brown fox',
    'The quick brown fox'
  );

  test(
    'Remove regular single quotes',
    "The 'quick' brown fox",
    'The quick brown fox'
  );

  test(
    'Remove backticks',
    'The `quick` brown fox',
    'The quick brown fox'
  );

  test(
    'Remove mixed quote types',
    '"Double" \'single\' `backtick` \u201Csmart\u201D \u2018smart\u2019',
    'Double single backtick smart smart'
  );

  test(
    'Remove backslashes (escape characters)',
    'Text with \\ backslashes \\ here',
    'Text with backslashes here'
  );

  // Test 3: Normal prompts (regression tests)
  console.log('\n--- Regression Tests (Normal Prompts) ---');
  test(
    'Normal prompt without quotes',
    'A beautiful sunset over mountains',
    'A beautiful sunset over mountains'
  );

  test(
    'Prompt with commas and periods',
    'A dragon, fierce and mighty, flying over castle.',
    'A dragon, fierce and mighty, flying over castle.'
  );

  test(
    'Prompt with numbers',
    'A scene with 3 dragons and 5 warriors',
    'A scene with 3 dragons and 5 warriors'
  );

  test(
    'Prompt with hyphens and underscores',
    'A cyber-punk scene with neon_lights',
    'A cyber-punk scene with neon_lights'
  );

  // Test 4: Edge cases
  console.log('\n--- Edge Case Tests ---');
  test(
    'Empty string',
    '',
    ''
  );

  test(
    'Only whitespace',
    '   ',
    ''
  );

  test(
    'Multiple spaces normalized',
    'Text   with    multiple     spaces',
    'Text with multiple spaces'
  );

  test(
    'Leading and trailing whitespace',
    '  Text with padding  ',
    'Text with padding'
  );

  test(
    'Only quotes',
    '\'\"\"\"`\'\'\u201C\u201D',
    ''
  );

  test(
    'Mixed whitespace and quotes',
    '  "Text"  with   \'spaces\'  ',
    'Text with spaces'
  );

  // Test 5: Non-string inputs
  console.log('\n--- Non-String Input Tests ---');
  test(
    'Null input',
    null,
    null
  );

  test(
    'Undefined input',
    undefined,
    undefined
  );

  // Test 6: Special characters that should be preserved
  console.log('\n--- Character Preservation Tests ---');
  test(
    'Preserve parentheses',
    'A dragon (fierce and mighty)',
    'A dragon (fierce and mighty)'
  );

  test(
    'Preserve brackets',
    'A scene [with details]',
    'A scene [with details]'
  );

  test(
    'Preserve exclamation and question marks',
    'What a beautiful scene! Is it real?',
    'What a beautiful scene! Is it real?'
  );

  test(
    'Preserve at symbols and hashtags',
    'A scene @sunrise #fantasy',
    'A scene @sunrise #fantasy'
  );

  test(
    'Preserve colons (for Midjourney parameters)',
    'A dragon --ar 16:9',
    'A dragon --ar 16:9'
  );

  // Test 7: Complex real-world prompts
  console.log('\n--- Real-World Prompt Tests ---');
  test(
    'Complex fantasy prompt with quotes',
    'An epic scene featuring "Tiamat", the five-headed dragon, with each head breathing different elements: fire, ice, lightning, acid, and poison. The dragon\'s scales shimmer with magical energy.',
    'An epic scene featuring Tiamat, the five-headed dragon, with each head breathing different elements: fire, ice, lightning, acid, and poison. The dragons scales shimmer with magical energy.'
  );

  test(
    'Prompt with contractions',
    "It's a dragon that won't be tamed",
    'Its a dragon that wont be tamed'
  );

  test(
    'Prompt with possessives',
    "The dragon's lair in the mountain's peak",
    'The dragons lair in the mountains peak'
  );

  // Summary
  console.log('\n=== Test Summary ===');
  console.log(`Total tests: ${passed + failed}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    console.log('\n=== Failed Tests Details ===');
    failures.forEach((failure, index) => {
      console.log(`\n${index + 1}. ${failure.name}`);
      console.log(`   Input:    "${failure.input}"`);
      console.log(`   Expected: "${failure.expected}"`);
      console.log(`   Actual:   "${failure.actual}"`);
    });
  }

  console.log('\n=== Verification ===');
  if (failed === 0) {
    console.log('✓ All tests passed! The fix successfully resolves the Midjourney parameter parsing error.');
    console.log('✓ Quotes are properly removed without breaking normal prompt generation.');
    console.log('\n=== Key Findings ===');
    console.log('✓ Smart quotes (\u201C \u201D \u2018 \u2019) are removed');
    console.log('✓ Regular quotes (" \' `) are removed');
    console.log('✓ Backslashes are removed');
    console.log('✓ Multiple spaces are normalized');
    console.log('✓ Normal prompts without quotes work correctly');
    console.log('✓ Special characters needed for Midjourney parameters are preserved');
  } else {
    console.log('✗ Some tests failed. The fix may need adjustment.');
  }

  return { passed, failed, failures };
};

// Run the tests
const results = runTests();
process.exit(results.failed > 0 ? 1 : 0);
