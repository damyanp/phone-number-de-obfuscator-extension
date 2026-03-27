// Unit tests for PhoneDecoder
// Run with: node test/decoder.test.js

const PhoneDecoder = require('../decoder.js');
const corpus = require('./corpus.json');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${message}`);
  }
}

function test(name, fn) {
  console.log(`\n  ${name}`);
  fn();
}

// ─── Corpus tests ───────────────────────────────────────────────────────────

console.log('\n=== Corpus Tests ===');

for (const entry of corpus) {
  test(`"${entry.input}" → ${entry.expected}`, () => {
    const results = PhoneDecoder.findPhoneNumbers(entry.input);
    assert(results.length >= 1,
      `Expected at least 1 match, got ${results.length} for "${entry.input}"`);
    if (results.length >= 1) {
      assert(results[0].decoded === entry.expected,
        `Expected "${entry.expected}", got "${results[0].decoded}" for "${entry.input}"`);
    }
  });
}

// ─── Contextual tests (phone numbers embedded in sentences) ─────────────────

console.log('\n=== Contextual Tests ===');

test('Words mixed with digits in sentence', () => {
  const text = 'call me at 425- three six one 8823 with any questions.';
  const results = PhoneDecoder.findPhoneNumbers(text);
  assert(results.length === 1, `Expected 1 match, got ${results.length}`);
  if (results.length >= 1) {
    assert(results[0].decoded === '425-361-8823', `Got "${results[0].decoded}"`);
  }
});

test('Lookalike O and trailing word in sentence', () => {
  const text = 'Message 4O6-553-221nine for more information';
  const results = PhoneDecoder.findPhoneNumbers(text);
  assert(results.length === 1, `Expected 1 match, got ${results.length}`);
  if (results.length >= 1) {
    assert(results[0].decoded === '406-553-2219', `Got "${results[0].decoded}"`);
  }
});

test('Words jammed against digits in sentence', () => {
  const text = 'Text 360-eight five2-seven190 with any questions!';
  const results = PhoneDecoder.findPhoneNumbers(text);
  assert(results.length === 1, `Expected 1 match, got ${results.length}`);
  if (results.length >= 1) {
    assert(results[0].decoded === '360-852-7190', `Got "${results[0].decoded}"`);
  }
});

test('Fully spelled area code with separators in sentence', () => {
  const text = 'Text Seven- two- eight-195-Six- 3-3-Six. Or email me.';
  const results = PhoneDecoder.findPhoneNumbers(text);
  assert(results.length === 1, `Expected 1 match, got ${results.length}`);
  if (results.length >= 1) {
    assert(results[0].decoded === '728-195-6336', `Got "${results[0].decoded}"`);
  }
});

test('All words with digit group in middle', () => {
  const text = 'Text. Four one two 685 three seven one nine for info.';
  const results = PhoneDecoder.findPhoneNumbers(text);
  assert(results.length === 1, `Expected 1 match, got ${results.length}`);
  if (results.length >= 1) {
    assert(results[0].decoded === '412-685-3719', `Got "${results[0].decoded}"`);
  }
});

// ─── Negative tests (should NOT match) ─────────────────────────────────────

console.log('\n=== Negative Tests ===');

test('Plain numeric phone number should NOT be decoded (no obfuscation)', () => {
  const text = 'call 425-555-0199 for info';
  const results = PhoneDecoder.findPhoneNumbers(text);
  assert(results.length === 0, `Expected 0 matches (plain number), got ${results.length}`);
});

test('Price should NOT be decoded: "$500"', () => {
  const text = 'Selling for $500 cash only';
  const results = PhoneDecoder.findPhoneNumbers(text);
  assert(results.length === 0, `Expected 0 matches (price), got ${results.length}`);
});

test('Year should NOT be decoded: "2024"', () => {
  const text = 'Built in 2024, excellent condition';
  const results = PhoneDecoder.findPhoneNumbers(text);
  assert(results.length === 0, `Expected 0 matches (year), got ${results.length}`);
});

test('Street address should NOT be decoded: "104 Glover St"', () => {
  const text = 'Located at 104 Glover St. S. Twisp WA';
  const results = PhoneDecoder.findPhoneNumbers(text);
  assert(results.length === 0, `Expected 0 matches (address), got ${results.length}`);
});

test('"four chairs for sale" should NOT be decoded', () => {
  const text = 'I have four chairs for sale at fifty dollars each';
  const results = PhoneDecoder.findPhoneNumbers(text);
  assert(results.length === 0, `Expected 0 matches (prose), got ${results.length}`);
});

// ─── Summary ────────────────────────────────────────────────────────────────

console.log('\n' + '='.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('='.repeat(50));

process.exit(failed > 0 ? 1 : 0);
