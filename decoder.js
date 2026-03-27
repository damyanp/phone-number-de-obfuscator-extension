// Phone Number Decoder Engine
// Detects and decodes obfuscated phone numbers in text.

const PhoneDecoder = (() => {
  'use strict';

  // Number words → digit mapping
  const WORD_TO_DIGIT = {
    'zero': '0', 'oh': '0', 'o': '0',
    'one': '1',
    'two': '2',
    'three': '3', 'tree': '3',
    'four': '4',
    'five': '5',
    'six': '6',
    'seven': '7',
    'eight': '8',
    'nine': '9',
  };

  // Build a regex that matches any number word (longest first to avoid partial matches)
  const WORD_KEYS = Object.keys(WORD_TO_DIGIT).sort((a, b) => b.length - a.length);
  const WORD_PATTERN = WORD_KEYS.join('|');

  // Token types
  const T_DIGIT = 'digit';       // a literal digit character 0-9
  const T_WORD = 'word';         // a number word like "three", "oh"
  const T_LOOKALIKE = 'look';    // a lookalike char like O (letter) used as 0
  const T_SEP = 'sep';           // separator: dash, dot, space, parens, etc.
  const T_TEXT = 'text';         // non-phone text

  /**
   * Tokenize a string into a sequence of typed tokens.
   * Each token: { type, value, digit, start, end, obfuscated }
   *   - digit: the numeric digit this token represents (for digit/word/lookalike)
   *   - obfuscated: true if this token is an obfuscation (word or lookalike)
   */
  function tokenize(text) {
    const tokens = [];
    // Regex to find: number words, digit chars, separators, or letter O adjacent to digits
    // We process character by character with a state machine approach.
    const lowerText = text.toLowerCase();
    let i = 0;

    while (i < text.length) {
      // Try to match a number word at this position
      const wordMatch = matchNumberWord(lowerText, i);
      if (wordMatch) {
        tokens.push({
          type: T_WORD,
          value: text.substring(i, i + wordMatch.length),
          digit: wordMatch.digit,
          start: i,
          end: i + wordMatch.length,
          obfuscated: true,
        });
        i += wordMatch.length;
        continue;
      }

      const ch = text[i];

      // Digit character
      if (ch >= '0' && ch <= '9') {
        tokens.push({
          type: T_DIGIT,
          value: ch,
          digit: ch,
          start: i,
          end: i + 1,
          obfuscated: false,
        });
        i++;
        continue;
      }

      // Separators commonly found in phone numbers
      if (ch === '-' || ch === '.' || ch === ' ' || ch === '(' || ch === ')' || ch === '\u2013' || ch === '\u2014') {
        tokens.push({
          type: T_SEP,
          value: ch,
          digit: null,
          start: i,
          end: i + 1,
          obfuscated: false,
        });
        i++;
        continue;
      }

      // Uppercase letter O adjacent to digits → lookalike for 0
      if (ch === 'O' && isAdjacentToDigitContext(text, i)) {
        tokens.push({
          type: T_LOOKALIKE,
          value: ch,
          digit: '0',
          start: i,
          end: i + 1,
          obfuscated: true,
        });
        i++;
        continue;
      }

      // Everything else is text
      const textStart = i;
      while (i < text.length && !isTokenStart(text, lowerText, i)) {
        i++;
      }
      tokens.push({
        type: T_TEXT,
        value: text.substring(textStart, i),
        digit: null,
        start: textStart,
        end: i,
        obfuscated: false,
      });
    }

    return tokens;
  }

  /**
   * Try to match a number word at position `pos` in `lowerText`.
   * The word must be at a word boundary (not part of a larger word).
   * Returns { length, digit } or null.
   */
  function matchNumberWord(lowerText, pos) {
    // Check word boundary before
    if (pos > 0 && isWordChar(lowerText[pos - 1])) {
      return null;
    }

    for (const word of WORD_KEYS) {
      if (lowerText.startsWith(word, pos)) {
        // Check word boundary after
        const endPos = pos + word.length;
        if (endPos < lowerText.length && isWordChar(lowerText[endPos])) {
          continue;
        }
        return { length: word.length, digit: WORD_TO_DIGIT[word] };
      }
    }
    return null;
  }

  function isWordChar(ch) {
    return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_' || ch === "'";
  }

  /**
   * Check if position `pos` (which has an uppercase 'O') is adjacent to digit context.
   * It must be next to a digit or a separator-then-digit pattern.
   */
  function isAdjacentToDigitContext(text, pos) {
    // Check character before O (skipping separators)
    const before = findNonSepChar(text, pos, -1);
    if (before && before >= '0' && before <= '9') return true;

    // Check character after O (skipping separators)
    const after = findNonSepChar(text, pos, 1);
    if (after && after >= '0' && after <= '9') return true;

    return false;
  }

  function findNonSepChar(text, pos, direction) {
    let p = pos + direction;
    while (p >= 0 && p < text.length) {
      const ch = text[p];
      if (ch === '-' || ch === '.' || ch === ' ' || ch === '(' || ch === ')') {
        p += direction;
        continue;
      }
      return ch;
    }
    return null;
  }

  function isTokenStart(text, lowerText, pos) {
    const ch = text[pos];
    if (ch >= '0' && ch <= '9') return true;
    if (ch === '-' || ch === '.' || ch === ' ' || ch === '(' || ch === ')' || ch === '\u2013' || ch === '\u2014') return true;
    if (ch === 'O' && isAdjacentToDigitContext(text, pos)) return true;
    if (matchNumberWord(lowerText, pos)) return true;
    return false;
  }

  /**
   * Scan tokens for phone number candidates.
   * A candidate is a consecutive run of digit-producing tokens (digit, word, lookalike)
   * with optional separators between them, that totals 7 or 10 digits, and contains
   * at least one obfuscated token.
   *
   * Returns array of:
   *   { start, end, original, decoded, digits }
   *   - start/end: character indices in original text
   *   - original: the original substring
   *   - decoded: the clean phone number string (e.g., "509-240-9397")
   *   - digits: raw digit string (e.g., "5092409397")
   */
  function findPhoneNumbers(text) {
    const tokens = tokenize(text);
    const results = [];
    let i = 0;

    while (i < tokens.length) {
      // Skip non-digit-producing tokens
      if (tokens[i].type === T_TEXT) {
        i++;
        continue;
      }

      // Try to build a phone number candidate starting at token i
      const candidate = tryBuildCandidate(tokens, i, text);
      if (candidate) {
        results.push(candidate);
        // Advance past the consumed tokens
        i = candidate._tokenEnd;
      } else {
        i++;
      }
    }

    return results;
  }

  /**
   * Starting at token index `start`, try to consume a sequence of tokens
   * that forms a valid phone number (7 or 10 digits).
   * Prefers 10-digit matches over 7-digit ones.
   */
  function tryBuildCandidate(tokens, start, text) {
    let digits = '';
    let hasObfuscation = false;
    let lastDigitTokenIdx = start;
    let consecutiveNonDigit = 0;
    let sevenDigitCandidate = null;

    let j = start;
    while (j < tokens.length && digits.length < 11) {
      const tok = tokens[j];

      if (tok.type === T_DIGIT || tok.type === T_WORD || tok.type === T_LOOKALIKE) {
        digits += tok.digit;
        if (tok.obfuscated) hasObfuscation = true;
        lastDigitTokenIdx = j;
        consecutiveNonDigit = 0;
        j++;
      } else if (tok.type === T_SEP) {
        consecutiveNonDigit++;
        // Allow at most 3 consecutive separator tokens (e.g., ") " or "- ")
        if (consecutiveNonDigit > 3) break;
        j++;
      } else {
        // Hit a text token — stop
        break;
      }

      // Stash a 7-digit candidate but keep going for 10
      if (digits.length === 7 && hasObfuscation && isPlausibleNumber(digits)) {
        sevenDigitCandidate = {
          start: tokens[start].start,
          end: tokens[lastDigitTokenIdx].end,
          original: text.substring(tokens[start].start, tokens[lastDigitTokenIdx].end),
          decoded: formatPhoneNumber(digits),
          digits,
          _tokenEnd: lastDigitTokenIdx + 1,
        };
      }

      // 10-digit match is preferred
      if (digits.length === 10 && hasObfuscation && isPlausibleNumber(digits)) {
        const startChar = tokens[start].start;
        const endChar = tokens[lastDigitTokenIdx].end;
        return {
          start: startChar,
          end: endChar,
          original: text.substring(startChar, endChar),
          decoded: formatPhoneNumber(digits),
          digits,
          _tokenEnd: lastDigitTokenIdx + 1,
        };
      }
    }

    // Fall back to 7-digit match if no 10-digit match found
    return sevenDigitCandidate;
  }

  /**
   * Basic plausibility check for a phone number.
   */
  function isPlausibleNumber(digits) {
    if (digits.length === 10) {
      const areaCode = digits.substring(0, 3);
      // Area codes can't start with 0 or 1
      if (areaCode[0] === '0' || areaCode[0] === '1') return false;
      // Reject obviously fake patterns
      if (areaCode === '555') return false;
    }
    if (digits.length === 7) {
      // Exchange can't start with 0 or 1
      if (digits[0] === '0' || digits[0] === '1') return false;
    }
    return true;
  }

  /**
   * Format a digit string as a standard US phone number.
   */
  function formatPhoneNumber(digits) {
    if (digits.length === 10) {
      return `${digits.substring(0, 3)}-${digits.substring(3, 6)}-${digits.substring(6)}`;
    }
    if (digits.length === 7) {
      return `${digits.substring(0, 3)}-${digits.substring(3)}`;
    }
    return digits;
  }

  // Public API
  return {
    findPhoneNumbers,
    tokenize,
    formatPhoneNumber,
    // Exposed for testing
    _WORD_TO_DIGIT: WORD_TO_DIGIT,
  };
})();

// Export for Node.js testing (no-op in browser)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PhoneDecoder;
}
