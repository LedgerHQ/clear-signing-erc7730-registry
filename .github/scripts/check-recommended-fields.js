#!/usr/bin/env node
/**
 * Reports optional improvements for the descriptors that a pull request adds or
 * changes: a display format with no "interpolatedIntent", and the deprecated
 * keys "context.contract.abi" and "context.eip712.schemas". None is an error.
 *
 * Reads the changed files from CHANGED_FILES and from the arguments. Writes a
 * Markdown comment body to stdout, or nothing. Does not resolve "includes".
 */

const fs = require('fs');

// The workflow looks for this line to find the comment it wrote before.
const MARKER = '<!-- erc7730-recommended-fields -->';

// GitHub refuses a comment body above 65536 characters.
const MAX_BODY = 60000;

/** Keeps a value from a descriptor inside one code span. */
function code(value) {
  return `\`${String(value).replace(/[`\r\n]+/g, ' ').slice(0, 200)}\``;
}

function section(title, note, items) {
  if (items.length === 0) return '';
  return `**${items.length} ${title}** ${note}\n\n${items.map((i) => `- ${i}`).join('\n')}\n\n`;
}

function main() {
  const changed = [...process.argv.slice(2), ...(process.env.CHANGED_FILES || '').split(/\s+/)]
    .map((f) => f.trim())
    .filter((f) => /^registry\/[^/]+\/(calldata|eip712)-.*\.json$/.test(f));

  const noIntent = [];
  const deprecated = [];

  for (const file of changed) {
    let doc;
    try {
      doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
      // A deleted file, or one that another check already rejects.
      process.stderr.write(`warning: cannot read ${file}: ${error.message}\n`);
      continue;
    }

    for (const key of ['context.contract.abi', 'context.eip712.schemas']) {
      const [, parent, field] = key.split('.');
      if (doc.context?.[parent] && field in doc.context[parent]) {
        deprecated.push(`${code(file)} — ${code(key)}`);
      }
    }

    for (const [selector, format] of Object.entries(doc.display?.formats ?? {})) {
      if (format && typeof format === 'object' && !('interpolatedIntent' in format)) {
        noIntent.push(`${code(file)} — ${code(selector)}`);
      }
    }
  }

  if (noIntent.length === 0 && deprecated.length === 0) return;

  let body =
    `${MARKER}\n## Clear signing recommendations\n\n` +
    'These are suggestions. They do not block this pull request.\n\n' +
    section(
      'format(s) have no `interpolatedIntent`.',
      'A wallet prefers it over `intent`, because it puts the values of the transaction in the sentence that the signer reads.',
      noIntent,
    ) +
    section(
      'deprecated field(s).',
      'Keep such a field only for backward compatibility. A new descriptor should use `display.formats`.',
      deprecated,
    );

  if (body.length > MAX_BODY) {
    body = `${body.slice(0, MAX_BODY)}\n\n… truncated.\n`;
  }
  process.stdout.write(body);
}

if (require.main === module) {
  main();
}
