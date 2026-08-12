'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

// Line parser shared by preservation, presence checks, and post-write
// verification. Mirrors the subset of dotenv syntax the writer emits:
// optional leading whitespace, optional `export` prefix, KEY=value.
const LINE_RE = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/;

// GUI-submitted values may never contain control characters; a newline would
// escape the value and inject additional lines into the env file.
const CONTROL_RE = /[\u0000-\u001F\u007F]/;

// Values containing whitespace or a shell-sensitive character are quoted so
// dotenv reads them back identically (see renderLine / unquoteValue).
const NEEDS_QUOTING_RE = /[\s"'#`]/;

// Serializes concurrent writes: each call appends to this chain, so temp-file
// creation, replacement, and verification of one write never interleave with
// another. Failures of one operation do not break the chain.
let chain = Promise.resolve();

/**
 * Resolve the env file the process should read and write.
 *
 * WYVERN_ENV_FILE (trimmed) wins when non-empty; otherwise the default
 * server/.env next to the repository's server directory.
 */
function resolveEnvFile(env = process.env) {
  const override = env && env.WYVERN_ENV_FILE;
  if (typeof override === 'string' && override.trim() !== '') {
    return override.trim();
  }
  return path.join(__dirname, '..', '..', '.env');
}

/**
 * Unquote a raw value captured after `=` per dotenv rules: a value wrapped in
 * double quotes has backslash escapes expanded (`\(.)` -> `$1`); single quotes
 * are stripped verbatim. Nothing else is stripped (no inline comments).
 */
function unquoteValue(raw) {
  const end = raw.replace(/[ \t]+$/, '');
  if (end.length >= 2) {
    if (end[0] === '"' && end[end.length - 1] === '"') {
      return end.slice(1, -1).replace(/\\(.)/g, '$1');
    }
    if (end[0] === "'" && end[end.length - 1] === "'") {
      return end.slice(1, -1);
    }
  }
  return raw;
}

/** Parse one line. Returns { key, value } with the value unquoted, or null. */
function parseLine(line) {
  const text = line.endsWith('\r') ? line.slice(0, -1) : line;
  const m = LINE_RE.exec(text);
  if (!m) return null;
  return { key: m[1], value: unquoteValue(m[2]) };
}

/** Parse all lines, last definition of a key winning (dotenv semantics). */
function parseAll(content) {
  const parsed = Object.create(null);
  for (const line of content.split(/\r?\n/)) {
    const m = parseLine(line);
    if (m) parsed[m.key] = m.value;
  }
  return parsed;
}

/**
 * Render `KEY=value`, symmetric with unquoteValue: plain unless the value
 * contains whitespace or a shell-sensitive character, in which case it is
 * written double-quoted with `\` and `"` escaped.
 */
function renderLine(key, value) {
  if (NEEDS_QUOTING_RE.test(value)) {
    const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return `${key}="${escaped}"`;
  }
  return `${key}=${value}`;
}

function readFileIfPresent(envFile) {
  try {
    return fs.readFileSync(envFile, 'utf8');
  } catch {
    return '';
  }
}

function writeAll(fd, content) {
  const buf = Buffer.from(content, 'utf8');
  let offset = 0;
  while (offset < buf.length) {
    offset += fs.writeSync(fd, buf, offset, buf.length - offset);
  }
}

/**
 * Atomically replace envFile with the fully written temp file. On Windows a
 * rename over an existing target can fail; the closed target is then removed
 * and the same-directory temp file renamed again. The target is never exposed
 * as partial line content: it either holds the previous file or the new one.
 */
function replaceFile(tmp, envFile) {
  try {
    fs.renameSync(tmp, envFile);
  } catch {
    fs.rmSync(envFile, { force: true });
    fs.renameSync(tmp, envFile);
  }
}

function verifyWritten(envFile, values, keys) {
  let content;
  try {
    content = fs.readFileSync(envFile, 'utf8');
  } catch (err) {
    throw new Error(`Failed to verify ${envFile}: ${err.message}`);
  }
  const parsed = parseAll(content);
  for (const key of keys) {
    if (parsed[key] !== values[key]) {
      throw new Error(`Failed to verify ${key} in ${envFile}`);
    }
  }
}

function performWrite(envFile, values, keys) {
  const dir = path.dirname(envFile);
  fs.mkdirSync(dir, { recursive: true });

  const original = readFileIfPresent(envFile);
  const eol = original.indexOf('\r\n') !== -1 ? '\r\n' : '\n';
  const trailingEol = original.endsWith(eol);
  const body = trailingEol ? original.slice(0, -eol.length) : original;
  const lines = body === '' ? [] : body.split(eol);

  // Replace named KEY=value lines in place (dropping any `export` prefix and
  // quotes); keep every other line verbatim, comments and ordering included.
  const seen = new Set();
  for (let i = 0; i < lines.length; i++) {
    const m = parseLine(lines[i]);
    if (m && Object.prototype.hasOwnProperty.call(values, m.key)) {
      lines[i] = renderLine(m.key, values[m.key]);
      seen.add(m.key);
    }
  }
  for (const key of keys) {
    if (!seen.has(key)) lines.push(renderLine(key, values[key]));
  }

  let content;
  if (lines.length === 0) {
    content = '';
  } else {
    content = lines.join(eol) + (trailingEol || original === '' ? eol : '');
  }

  const tmp = path.join(
    dir,
    `.${path.basename(envFile)}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`
  );
  let fd;
  try {
    fd = fs.openSync(tmp, 'wx');
    writeAll(fd, content);
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    replaceFile(tmp, envFile);
  } finally {
    if (fd !== undefined) {
      try {
        fs.closeSync(fd);
      } catch {
        // Already closed or closed by the rename path; nothing to recover.
      }
    }
    try {
      fs.rmSync(tmp, { force: true });
    } catch {
      // Best-effort cleanup; the target is already in its final state.
    }
  }

  verifyWritten(envFile, values, keys);
  return { savedKeys: keys };
}

/**
 * Write a batch of KEY=value entries to the env file. All-or-nothing: either
 * every key lands or the original file is left unchanged. Values are validated
 * before any I/O. Concurrent calls serialize on a per-process chain.
 */
async function writeSetupValues({ envFile, values }) {
  const keys = Object.keys(values || {});
  if (keys.length === 0) return { savedKeys: [] };

  for (const key of keys) {
    const value = values[key];
    if (typeof value !== 'string') {
      throw new Error(`Value for ${key} must be a string`);
    }
    if (CONTROL_RE.test(value)) {
      throw new Error(`Value for ${key} contains control characters`);
    }
  }

  const operation = chain.then(() => performWrite(envFile, values, keys));
  chain = operation.catch(() => {});
  return operation;
}

/**
 * Report which keys are configured (a keyed line with a non-empty value after
 * unquoting) without ever exposing values. Missing or unreadable file -> {}.
 */
function readEnvPresence(envFile) {
  let content;
  try {
    content = fs.readFileSync(envFile, 'utf8');
  } catch {
    return {};
  }
  const parsed = parseAll(content);
  const presence = {};
  for (const key of Object.keys(parsed)) {
    if (parsed[key] !== '') {
      Object.defineProperty(presence, key, {
        value: true,
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
  }
  return presence;
}

module.exports = { resolveEnvFile, writeSetupValues, readEnvPresence };
