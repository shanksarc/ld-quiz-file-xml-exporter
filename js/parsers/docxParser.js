/**
 * Word Document (.docx) Parser using Mammoth.js
 */

import { parsePastedQuestions } from './pasteParser.js';

export async function parseDocxFile(fileOrBuffer, options = {}) {
  // Check if Mammoth is loaded globally in window or available
  let mammothLib = typeof window !== 'undefined' ? window.mammoth : null;

  if (!mammothLib && typeof require !== 'undefined') {
    try {
      mammothLib = require('mammoth');
    } catch (e) {
      // Ignore
    }
  }

  if (!mammothLib) {
    throw new Error('Mammoth.js library is required for DOCX parsing.');
  }

  let arrayBuffer;
  if (fileOrBuffer instanceof ArrayBuffer) {
    arrayBuffer = fileOrBuffer;
  } else if (fileOrBuffer.arrayBuffer) {
    arrayBuffer = await fileOrBuffer.arrayBuffer();
  } else {
    throw new Error('Invalid file or buffer format for DOCX parsing.');
  }

  // Convert docx to HTML with formatting preserved
  const result = await mammothLib.convertToHtml(
    { arrayBuffer },
    {
      styleMap: [
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
        "r[style-name='Strong'] => strong",
        "r[style-name='Emphasis'] => em"
      ]
    }
  );

  const html = result.value || '';
  const messages = result.messages || [];

  // Check for table elements and generate warning
  const hasTables = /<table[\s>]/i.test(html);
  const warnings = [];
  if (hasTables) {
    warnings.push('A table was detected in the Word document. Please review affected questions to ensure formatting integrity.');
  }

  // Convert HTML into text stream while preserving paragraph and formatting tags
  // Replace <p>...</p> with linebreaks
  let text = html
    .replace(/<\/p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[\s>]/gi, '• ')
    .replace(/<\/h[1-6]>/gi, '\n');

  // Strip unsupported block tags but keep inline formatting (<strong>, <em>, <sub>, <sup>, etc.)
  text = text.replace(/<div[\s>]/gi, '').replace(/<\/div>/gi, '\n');
  text = text.replace(/<p[\s>][^>]*>/gi, '');

  // Decode basic HTML entities for markers
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  const parsed = parsePastedQuestions(text, options);

  if (warnings.length > 0) {
    parsed.warnings = [...(parsed.warnings || []), ...warnings];
  }

  return parsed;
}
