/**
 * Risalah Living Text Calculator Engine (Pure JavaScript, DOM-free)
 *
 * API Contract (PRD Section 4):
 * - parseMathLines(content: string)
 *   Returns Array<{ lineIndex, expression, result, isVariableAssignment, variableName? }>
 * - formatNumber(num: number | string): string
 */

const UNIT_PATTERN =
  /\b(days|weeks|months|hrs|hours|kg|lbs|mins|minutes)\b/gi;

const CURRENCY_PATTERN = /[$€£]/g;

/**
 * Strips HTML tags (if note content was imported from the web version)
 * while preserving line breaks cleanly.
 */
function sanitizeHtmlToLines(content) {
  if (typeof content !== 'string' || content.length === 0) {
    return [];
  }

  let text = content
    .replace(/\r\n?/g, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(div|p|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");

  return text.split('\n');
}

/**
 * Normalizes a raw expression string by replacing unicode math operators,
 * removing currency symbols, common units, and thousand separators.
 */
function normalizeExpression(raw) {
  let expr = raw
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/[−–—]/g, '-')
    .replace(CURRENCY_PATTERN, '')
    .replace(UNIT_PATTERN, '');

  // Strip thousand commas inside numbers (e.g. 18,000 -> 18000)
  expr = expr.replace(/\b\d{1,3}(?:,\d{3})+(?=\b|\.)/g, (match) =>
    match.replace(/,/g, '')
  );

  return expr.trim();
}

/**
 * Tokenizes a normalized math expression with known variables.
 * Returns null if any unknown identifier or invalid character is encountered.
 */
function tokenize(expr, variables) {
  const tokens = [];
  let i = 0;
  const len = expr.length;

  while (i < len) {
    const ch = expr[i];

    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }

    // Number literal (integer or decimal)
    if (/[0-9]/.test(ch) || (ch === '.' && i + 1 < len && /[0-9]/.test(expr[i + 1]))) {
      let start = i;
      let hasDot = false;
      while (i < len && (/[0-9]/.test(expr[i]) || (expr[i] === '.' && !hasDot))) {
        if (expr[i] === '.') hasDot = true;
        i += 1;
      }
      const numStr = expr.slice(start, i);
      const val = Number(numStr);
      if (Number.isNaN(val)) return null;
      tokens.push({ type: 'number', value: val });
      continue;
    }

    // Identifier (must match an already defined variable)
    if (/[a-zA-Z_]/.test(ch)) {
      let start = i;
      while (i < len && /[a-zA-Z0-9_]/.test(expr[i])) {
        i += 1;
      }
      const ident = expr.slice(start, i);
      if (!Object.prototype.hasOwnProperty.call(variables, ident)) {
        return null;
      }
      tokens.push({ type: 'variable', name: ident, value: variables[ident] });
      continue;
    }

    // Operators & parentheses
    if ('+-*/^%()'.includes(ch)) {
      tokens.push({ type: 'op', value: ch });
      i += 1;
      continue;
    }

    // Any other character makes this line non-math prose
    return null;
  }

  return tokens;
}

/**
 * Safe recursive-descent arithmetic evaluator.
 * Supports +, -, *, /, %, ^, unary +/-, trailing %, and parentheses.
 * Returns a number (may be Infinity, -Infinity, NaN) or null on syntax error.
 */
function evaluateTokens(tokens) {
  if (!tokens || tokens.length === 0) return null;

  let pos = 0;

  function peek() {
    return tokens[pos];
  }

  function consume() {
    return tokens[pos++];
  }

  function parseExpression() {
    let left = parseTerm();
    if (left === null) return null;

    while (peek() && peek().type === 'op' && (peek().value === '+' || peek().value === '-')) {
      const op = consume().value;
      const right = parseTerm();
      if (right === null) return null;
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  function parseTerm() {
    let left = parsePower();
    if (left === null) return null;

    while (
      peek() &&
      peek().type === 'op' &&
      (peek().value === '*' || peek().value === '/' || peek().value === '%')
    ) {
      const op = consume().value;
      const right = parsePower();
      if (right === null) return null;
      if (op === '*') {
        left = left * right;
      } else if (op === '/') {
        left = left / right;
      } else {
        left = left % right;
      }
    }
    return left;
  }

  function parsePower() {
    let base = parseUnary();
    if (base === null) return null;

    if (peek() && peek().type === 'op' && peek().value === '^') {
      consume();
      const exponent = parsePower();
      if (exponent === null) return null;
      base = Math.pow(base, exponent);
    }
    return base;
  }

  function parseUnary() {
    if (peek() && peek().type === 'op' && (peek().value === '+' || peek().value === '-')) {
      const op = consume().value;
      const val = parseUnary();
      if (val === null) return null;
      return op === '-' ? -val : val;
    }
    return parsePostfix();
  }

  function parsePostfix() {
    let val = parsePrimary();
    if (val === null) return null;

    // Support percentage suffix (e.g. 20% -> 0.2) when % is NOT followed by a primary operand
    while (peek() && peek().type === 'op' && peek().value === '%') {
      const next = tokens[pos + 1];
      const startsOperand =
        next &&
        (next.type === 'number' ||
          next.type === 'variable' ||
          (next.type === 'op' && next.value === '('));
      if (startsOperand) {
        break;
      }
      consume();
      val = val / 100;
    }
    return val;
  }

  function parsePrimary() {
    const tok = peek();
    if (!tok) return null;

    if (tok.type === 'number' || tok.type === 'variable') {
      consume();
      return tok.value;
    }

    if (tok.type === 'op' && tok.value === '(') {
      consume();
      const inner = parseExpression();
      if (inner === null) return null;
      if (!peek() || peek().type !== 'op' || peek().value !== ')') {
        return null;
      }
      consume();
      return inner;
    }

    return null;
  }

  const result = parseExpression();
  if (result === null || pos !== tokens.length) {
    return null;
  }
  return result;
}

/**
 * Converts numeric edge cases to PRD-specified string representations.
 */
function normalizeNumericResult(val) {
  if (typeof val !== 'number') return 'Undefined';
  if (Number.isNaN(val)) return 'Undefined';
  if (val === Infinity) return '∞';
  if (val === -Infinity) return '-∞';
  // Clean tiny floating-point rounding drift (e.g. 0.1 + 0.2 -> 0.3)
  if (Object.is(val, -0)) return 0;
  return Number(val.toPrecision(12));
}

/**
 * Evaluates text content line-by-line, tracking variable assignments and expressions.
 *
 * @param {string} content
 * @returns {Array<{ lineIndex: number, expression: string, result: number | string, isVariableAssignment: boolean, variableName?: string }>}
 */
export function parseMathLines(content) {
  const lines = sanitizeHtmlToLines(content);
  const variables = Object.create(null);
  const results = [];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const rawLine = lines[lineIndex].trim();
    if (!rawLine) continue;

    // Ignore already-inserted result lines like "= 48,000"
    if (rawLine.startsWith('=')) continue;

    // Check variable assignment: `varName = expression`
    const assignMatch = rawLine.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)$/);
    if (assignMatch) {
      const variableName = assignMatch[1];
      const rhsRaw = assignMatch[2].trim();
      const normalizedRhs = normalizeExpression(rhsRaw);
      if (!normalizedRhs) continue;

      const tokens = tokenize(normalizedRhs, variables);
      if (!tokens || tokens.length === 0) continue;

      const evaluated = evaluateTokens(tokens);
      if (evaluated === null) continue;

      const finalResult = normalizeNumericResult(evaluated);
      if (typeof finalResult === 'number') {
        variables[variableName] = finalResult;
      }

      results.push({
        lineIndex,
        expression: rawLine,
        result: finalResult,
        isVariableAssignment: true,
        variableName,
      });
      continue;
    }

    // Otherwise evaluate as a standalone math expression
    const normalized = normalizeExpression(rawLine);
    if (!normalized) continue;

    const tokens = tokenize(normalized, variables);
    if (!tokens || tokens.length === 0) continue;

    // Avoid treating a bare standalone number (e.g. "2026") as a calculation
    const hasOperator = tokens.some((t) => t.type === 'op');
    const hasVariable = tokens.some((t) => t.type === 'variable');
    if (!hasOperator && !hasVariable) continue;

    const evaluated = evaluateTokens(tokens);
    if (evaluated === null) continue;

    const finalResult = normalizeNumericResult(evaluated);
    results.push({
      lineIndex,
      expression: rawLine,
      result: finalResult,
      isVariableAssignment: false,
    });
  }

  return results;
}

/**
 * Formats numbers with thousand separators (max 4 decimal digits)
 * or returns special sentinel strings ('∞', '-∞', 'Undefined') unchanged.
 *
 * @param {number | string} num
 * @returns {string}
 */
export function formatNumber(num) {
  if (num === '∞' || num === '-∞' || num === 'Undefined') {
    return num;
  }

  if (typeof num === 'string') {
    const parsed = Number(num);
    if (Number.isNaN(parsed)) return num;
    num = parsed;
  }

  if (typeof num !== 'number' || Number.isNaN(num)) {
    return 'Undefined';
  }
  if (num === Infinity) return '∞';
  if (num === -Infinity) return '-∞';

  const rounded = Math.round((num + Number.EPSILON) * 10000) / 10000;
  const fixed = Object.is(rounded, -0) ? '0' : rounded.toFixed(4);
  const [intPart, rawDecPart] = fixed.split('.');
  const decPart = rawDecPart ? rawDecPart.replace(/0+$/, '') : '';

  const isNegative = intPart.startsWith('-');
  const absInt = isNegative ? intPart.slice(1) : intPart;
  const groupedInt = absInt.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  return `${isNegative ? '-' : ''}${groupedInt}${decPart ? `.${decPart}` : ''}`;
}
