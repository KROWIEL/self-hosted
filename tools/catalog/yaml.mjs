/**
 * Minimal YAML reader for the awesome-selfhosted-data `software/*.yml` files.
 *
 * Those files are machine-generated and stick to a tiny subset of YAML: block
 * mappings, sequences of scalars, and block scalars. Rather than pull a YAML
 * dependency into a repo that otherwise has none, this parser covers that
 * subset and throws on anything it does not understand, so a format change
 * upstream fails the sync loudly instead of silently producing junk.
 */

const BLOCK_SCALAR = /^([|>])([-+]?)$/;

function indentOf(line) {
  return line.length - line.trimStart().length;
}

function parseScalar(raw, line) {
  const s = raw.trim();
  if (s === '' || s === 'null' || s === '~') return null;
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s === '[]') return [];
  if (s === '{}') return {};

  const quote = s[0];
  if ((quote === "'" || quote === '"') && s.length > 1 && s.endsWith(quote)) {
    const body = s.slice(1, -1);
    return quote === "'" ? body.replace(/''/g, "'") : body.replace(/\\(.)/g, '$1');
  }
  if ('&*!['.includes(quote) || (quote === '{' && s !== '{}')) {
    throw new Error(`Unsupported YAML construct: ${line}`);
  }
  if (/^-?\d+$/.test(s)) return Number(s);
  return s;
}

function readBlockScalar(lines, state, parentIndent, header) {
  const [, style, chomp] = BLOCK_SCALAR.exec(header);
  const body = [];
  let blockIndent = null;
  while (state.i < lines.length) {
    const line = lines[state.i];
    if (line.trim() !== '' && indentOf(line) <= parentIndent) break;
    if (blockIndent === null && line.trim() !== '') blockIndent = indentOf(line);
    body.push(line.slice(blockIndent ?? 0));
    state.i++;
  }
  const text = body.join(style === '>' ? ' ' : '\n');
  return chomp === '-' ? text.trimEnd() : `${text.trimEnd()}\n`;
}

function parseSequence(lines, state, indent) {
  const out = [];
  while (state.i < lines.length) {
    const line = lines[state.i];
    if (indentOf(line) !== indent) break;
    const text = line.trim();
    if (!text.startsWith('- ')) break;
    out.push(parseScalar(text.slice(2), line));
    state.i++;
  }
  return out;
}

function parseMapping(lines, state, indent) {
  const out = {};
  while (state.i < lines.length) {
    const line = lines[state.i];
    const ind = indentOf(line);
    if (ind < indent) break;
    if (ind > indent) throw new Error(`Unexpected indentation: ${line}`);

    const match = /^([^:\s][^:]*):(?:\s+(.*))?$/.exec(line.trim());
    if (!match) throw new Error(`Unsupported YAML line: ${line}`);
    const key = match[1].trim();
    const rest = (match[2] ?? '').trim();
    state.i++;

    if (BLOCK_SCALAR.test(rest)) {
      out[key] = readBlockScalar(lines, state, ind, rest);
    } else if (rest !== '') {
      out[key] = parseScalar(rest, line);
    } else {
      out[key] = parseChild(lines, state, ind, line);
    }
  }
  return out;
}

function parseChild(lines, state, parentIndent, parentLine) {
  if (state.i >= lines.length) return null;
  const next = lines[state.i];
  const ind = indentOf(next);
  // A sequence may sit at the parent's own indentation; a mapping may not.
  if (next.trim().startsWith('- ') && ind >= parentIndent) {
    return parseSequence(lines, state, ind);
  }
  if (ind <= parentIndent) return null;
  return parseMapping(lines, state, ind);
}

export function parseYaml(text) {
  const lines = text
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '' && !line.trimStart().startsWith('#'));
  if (lines.length === 0) return {};
  if (lines[0].startsWith('---')) lines.shift();

  const state = { i: 0 };
  const doc = parseMapping(lines, state, indentOf(lines[0]));
  if (state.i < lines.length) {
    throw new Error(`Trailing content could not be parsed: ${lines[state.i]}`);
  }
  return doc;
}
