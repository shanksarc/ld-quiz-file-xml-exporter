/**
 * Deterministic Modular Parser for Pasted / Tagged Questions
 * Fully supports:
 * - Structured tags: [question], [id: ...], [points: 1], [A], [B], [answer: C], [explanation], [/question]
 * - LaTeX / slash tags: \question, \id, \choice, \answer, \explanation
 * - Natural format: Q1., Question 1:, 1., A), (A), Answer: C, Explanation: ...
 * - Configurable Question ID formatting (Prefix + Number sequence with padding + Suffix)
 */

import { createQuestion, createAnswer } from '../models/questionModel.js';

/**
 * Formats a question ID from Prefix + Padded Number + Suffix
 * Example: formatQuestionId('F2B1MQ', 2, 3, 'CSD') -> 'F2B1MQ002CSD'
 */
export function formatQuestionId(prefix = '', num = 1, paddingDigits = 3, suffix = '') {
  const p = String(prefix !== undefined && prefix !== null ? prefix : '').trim();
  const s = String(suffix !== undefined && suffix !== null ? suffix : '').trim();
  const digits = parseInt(paddingDigits, 10) || 1;
  const numStr = String(num).padStart(digits, '0');
  return `${p}${numStr}${s}`;
}

export function extractCorrectAnswerLetter(payload) {
  if (!payload) return null;
  const str = String(payload).trim();

  // 1. Matches single letter at start or bracketed: "B", "B)", "(B)", "[B]", "B.", "B:", "b"
  let m = str.match(/^(?:\[|\()?([A-Za-z0-9])(?:\]|\))?(?:[\.\:\)]|\s|$)/);
  if (m) return m[1].toUpperCase();

  // 2. Matches "Option B" or "Choice B"
  m = str.match(/(?:option|choice)\s*[:\s]*([A-Za-z0-9])/i);
  if (m) return m[1].toUpperCase();

  // 3. Matches bracketed letter anywhere e.g. "(B)" or "[B]"
  m = str.match(/(?:\[|\()([A-Za-z0-9])(?:\]|\))/);
  if (m) return m[1].toUpperCase();

  // 4. Matches any first isolated single letter word
  m = str.match(/\b([A-Za-z])\b/);
  if (m) return m[1].toUpperCase();

  return str.charAt(0).toUpperCase();
}

export function extractChoice(line) {
  if (!line || !line.trim()) return null;
  const trimmed = line.trim();

  // 1. Bracketed tags: [A] Option text, [choice: A] Option text, [choice A] Option text
  let m = trimmed.match(/^\s*(?:\*\s*)?\[(?:choice\s*[:\s]*)?([A-Za-z0-9])\](?:\s*\*\s*)?\s+(.*)$/i);
  if (m) {
    return {
      label: m[1].toUpperCase(),
      text: m[2].trim(),
      isStarMarked: line.includes('*')
    };
  }

  // 2. LaTeX tags: \choice A Option text, \choice{A} Option text
  m = trimmed.match(/^\s*(?:\*\s*)?\\choice\s*(?:\{([A-Za-z0-9])\}|\s+([A-Za-z0-9])\b)(?:\s*\*\s*)?\s*(.*)$/i);
  if (m) {
    return {
      label: (m[1] || m[2]).toUpperCase(),
      text: (m[3] || '').trim(),
      isStarMarked: line.includes('*')
    };
  }

  // 3. Slash choice: \a Option text, \b Option text
  m = trimmed.match(/^\s*(?:\*\s*)?\\([A-Da-d])\b(?:\s*\*\s*)?\s+(.*)$/);
  if (m) {
    return {
      label: m[1].toUpperCase(),
      text: m[2].trim(),
      isStarMarked: line.includes('*')
    };
  }

  // 4. Standard format: A) Option text, A. Option text, (A) Option text, A: Option text, A - Option text
  m = trimmed.match(/^\s*(?:\*\s*)?(?:\(([A-Za-z0-9])\)|([A-Za-z0-9])[\.\:\)\-])(?:\s*\*\s*)?\s+(.*)$/);
  if (m) {
    return {
      label: (m[1] || m[2]).toUpperCase(),
      text: m[3].trim(),
      isStarMarked: line.includes('*')
    };
  }

  return null;
}

export function extractQuestionHeader(line) {
  if (!line || !line.trim()) return null;
  const trimmed = line.trim();

  // 1. Explicit tag: [question], [question: ID], [q], [q: ID], \question, \question{ID}
  let m = trimmed.match(/^\s*(?:\[(?:question|q)(?:\s*[:\s]\s*([^\]]*))?\]|\\(?:question|q)(?:\{([^}]*)\})?|\\(?:question|q)\b)\s*(.*)$/i);
  if (m) {
    return {
      id: (m[1] || m[2] || '').trim(),
      text: (m[3] || '').trim(),
      isTag: true
    };
  }

  // 2. Natural question header: Q1., Question 1:, Q5., Question 5., [Q1]
  m = trimmed.match(/^\s*(?:(?:Q|Question)\s*([A-Za-z0-9_-]+)[\.\)\:\-]|\[([A-Za-z0-9_-]+)\])\s*(.*)$/i);
  if (m) {
    return {
      id: (m[1] || m[2] || '').trim(),
      text: (m[3] || '').trim(),
      isTag: false
    };
  }

  // 3. Numeric question header: 1., 1), (1)
  m = trimmed.match(/^\s*(\d+)[\.\)\:\-]\s+(.*)$/);
  if (m) {
    return {
      id: m[1].trim(),
      text: (m[2] || '').trim(),
      isTag: false
    };
  }

  return null;
}

export function extractAnswerTag(line) {
  if (!line || !line.trim()) return null;
  const trimmed = line.trim();

  // [answer: C], [correct: C], \answer C, \correct C, Answer: C, Correct Answer: C, Ans: C, Key: C
  let m = trimmed.match(/^\s*(?:\[(?:correct|answer|ans|key)\s*[:\s]\s*([^\]]+)\]|\\(?:correct|answer|ans|key)\s*\{?([^}]+)\}?|\\(?:correct|answer|ans|key)\s+([^\s\n]+)|(?:Correct\s+Answer|Correct\s+Option|Answer\s+is|Correct|Answer|Ans|Key)\s*[:\-=]?\s*(.*))\s*$/i);
  if (m) {
    const payload = (m[1] || m[2] || m[3] || m[4] || '').trim();
    const letter = extractCorrectAnswerLetter(payload);
    return {
      payload,
      letter
    };
  }
  return null;
}

export function extractExplanationTag(line) {
  if (!line || !line.trim()) return null;
  const trimmed = line.trim();

  // [explanation], \explanation, Explanation:, Solution:, Rationale:, Reason:, Feedback:
  let m = trimmed.match(/^\s*(?:\[(?:explanation|solution|rationale|feedback|reason|note)\]|\\(?:explanation|solution|rationale|feedback|reason|note)\b|(?:Explanation|Solution|Rationale|Reason|Feedback|Ans\s+Explanation|Note)\s*[:\-=]\s*(.*))\s*$/i);
  if (m) {
    return {
      text: (m[1] || '').trim()
    };
  }
  return null;
}

export function parsePastedQuestions(rawText, options = {}) {
  const {
    idMode = 'preserve', // 'preserve', 'custom', 'generate'
    idPrefix = '',
    idStartNum = 1,
    idPadding = 3,
    idSuffix = '',
    defaultPoints = 1
  } = options;

  if (!rawText || !rawText.trim()) {
    return { questions: [], rawCount: 0, errors: [] };
  }

  // Normalize newlines and typography artifacts
  const normalized = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u00A0/g, ' '); // Non-breaking space

  const lines = normalized.split('\n');

  const questions = [];
  let currentQ = null;
  let currentState = 'IDLE'; // 'IDLE', 'QUESTION_TEXT', 'CHOICES', 'EXPLANATION'
  let currentChoiceLabel = null;
  let questionIndex = 1;

  const tagEndQuestionRegex = /^\s*(?:\[\/(?:question|q)\]|\\end(?:question|q))\s*$/i;
  const explicitIdRegex = /^\s*(?:\[id\s*[:\s]\s*([^\]]+)\]|\\id\s*\{([^}]+)\}|\\id\s+([^\s\n]+)|(?:ID|Question\s*ID|Code)\s*[:\-=]\s*([A-Za-z0-9_-]+))\s*$/i;
  const pointsRegex = /^\s*(?:\[points?\s*[:\s]\s*(\d+(?:\.\d+)?)\]|\\points?\s*\{?(\d+(?:\.\d+)?)\}?|(?:Points?|Mark|Score)\s*[:\-=]\s*(\d+(?:\.\d+)?))\s*$/i;

  function finalizeCurrentQuestion() {
    if (!currentQ) return;

    // Process Question Text HTML
    currentQ.questionText = formatHtmlParagraphs(currentQ._rawQuestionLines);

    // Process Explanation HTML
    currentQ.explanation = formatHtmlParagraphs(currentQ._rawExplanationLines);

    // If answer letter was found, mark the correct answer in choices
    if (currentQ._detectedAnswerLetter) {
      const targetLetter = currentQ._detectedAnswerLetter.toUpperCase();

      let matched = false;
      for (const ans of currentQ.answers) {
        if (ans.label.toUpperCase() === targetLetter) {
          ans.correct = true;
          ans.points = currentQ.points;
          matched = true;
        } else {
          ans.correct = false;
          ans.points = 0;
        }
      }
      // If none matched label directly, check if letter matches answer index (A=0, B=1, etc.)
      if (!matched && targetLetter && targetLetter.length === 1) {
        const idx = targetLetter.charCodeAt(0) - 65; // A -> 0, B -> 1
        if (idx >= 0 && idx < currentQ.answers.length) {
          currentQ.answers[idx].correct = true;
          currentQ.answers[idx].points = currentQ.points;
        }
      }
    }

    // If no correct answer was marked yet, but an answer choice had star marker
    const hasAnyCorrect = currentQ.answers.some(a => a.correct);
    if (!hasAnyCorrect && currentQ.answers.length > 0 && currentQ._detectedAnswerLetter) {
      const targetLower = String(currentQ._detectedAnswerLetter).toLowerCase();
      const matchByText = currentQ.answers.find(a => a.text.toLowerCase().includes(targetLower));
      if (matchByText) {
        matchByText.correct = true;
        matchByText.points = currentQ.points;
      }
    }

    // Build correctMsg and incorrectMsg
    buildFeedbackMessages(currentQ);

    // Clean internal temporary fields
    delete currentQ._rawQuestionLines;
    delete currentQ._rawExplanationLines;
    delete currentQ._detectedAnswerLetter;

    questions.push(currentQ);
  }

  function startNewQuestion(suppliedId = '', firstLineText = '') {
    finalizeCurrentQuestion();

    let qId = '';
    const currentSeqNum = questionIndex - 1 + (parseInt(idStartNum, 10) || 1);

    if (idMode === 'custom' || idMode === 'generate') {
      qId = formatQuestionId(idPrefix, currentSeqNum, idPadding, idSuffix);
    } else {
      // idMode === 'preserve'
      qId = (suppliedId || '').trim();
      if (!qId) {
        qId = formatQuestionId(idPrefix || 'Q', currentSeqNum, idPadding, idSuffix);
      }
    }

    currentQ = createQuestion({
      id: qId,
      points: defaultPoints,
      sourceIndex: questionIndex - 1,
      answers: [] // Explicitly empty choices array
    });

    currentQ._rawQuestionLines = firstLineText ? [firstLineText] : [];
    currentQ._rawExplanationLines = [];
    currentQ._detectedAnswerLetter = null;
    currentState = 'QUESTION_TEXT';
    currentChoiceLabel = null;
    questionIndex++;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // 0. End of question tag [/question]
    if (tagEndQuestionRegex.test(trimmed)) {
      finalizeCurrentQuestion();
      currentQ = null;
      currentState = 'IDLE';
      continue;
    }

    // 1. Check if line starts an explicit [question] tag or natural question header
    const qHeader = extractQuestionHeader(line);
    if (qHeader) {
      if (qHeader.isTag || currentState === 'IDLE' || currentState === 'CHOICES' || currentState === 'ANSWER' || currentState === 'EXPLANATION') {
        startNewQuestion(qHeader.id, qHeader.text);
        continue;
      }
    }

    // 2. Explicit ID tag: [id: Q101] or ID: Q101
    const explicitIdMatch = trimmed.match(explicitIdRegex);
    if (explicitIdMatch) {
      const customId = (explicitIdMatch[1] || explicitIdMatch[2] || explicitIdMatch[3] || explicitIdMatch[4] || '').trim();
      if (!currentQ || (currentQ.answers.length > 0 && currentState !== 'QUESTION_TEXT')) {
        startNewQuestion(customId, '');
      } else {
        currentQ.id = customId;
      }
      continue;
    }

    // 3. Explicit Points tag: [points: 2] or Points: 2
    const ptsMatch = trimmed.match(pointsRegex);
    if (ptsMatch && currentQ) {
      const ptsVal = parseFloat(ptsMatch[1] || ptsMatch[2] || ptsMatch[3]);
      if (Number.isFinite(ptsVal)) {
        currentQ.points = ptsVal;
      }
      continue;
    }

    // 4. Answer / Correct Choice tag: [answer: C] or Answer: C
    const ansTag = extractAnswerTag(line);
    if (ansTag) {
      currentState = 'ANSWER';
      currentChoiceLabel = null;
      if (currentQ) {
        currentQ._detectedAnswerLetter = ansTag.letter || ansTag.payload;
      }
      continue;
    }

    // 5. Explanation tag: [explanation] or Explanation: ...
    const explTag = extractExplanationTag(line);
    if (explTag) {
      currentState = 'EXPLANATION';
      currentChoiceLabel = null;
      if (explTag.text && currentQ) {
        currentQ._rawExplanationLines.push(explTag.text);
      }
      continue;
    }

    // 6. Choice line: [A] Text, A) Text, (A) Text, \choice A Text
    const choiceObj = extractChoice(line);
    if (choiceObj && (currentState === 'QUESTION_TEXT' || currentState === 'CHOICES')) {
      currentState = 'CHOICES';
      currentChoiceLabel = choiceObj.label;

      const newAnswer = createAnswer(
        choiceObj.label,
        choiceObj.text,
        choiceObj.isStarMarked,
        choiceObj.isStarMarked ? (currentQ ? currentQ.points : 1) : 0
      );

      if (choiceObj.isStarMarked && currentQ) {
        currentQ._detectedAnswerLetter = choiceObj.label;
      }

      if (currentQ) {
        currentQ.answers.push(newAnswer);
      }
      continue;
    }

    // If no active question yet and line has text, start Question 1 implicitly
    if (!currentQ && trimmed) {
      startNewQuestion('', line);
      continue;
    }

    if (!currentQ) continue;

    // Handle continuation lines based on state
    if (currentState === 'QUESTION_TEXT') {
      currentQ._rawQuestionLines.push(line);
    } else if (currentState === 'CHOICES') {
      if (currentChoiceLabel && currentQ.answers.length > 0 && trimmed) {
        const lastChoice = currentQ.answers[currentQ.answers.length - 1];
        lastChoice.text = (lastChoice.text + ' ' + trimmed).trim();
      }
    } else if (currentState === 'EXPLANATION') {
      currentQ._rawExplanationLines.push(line);
    }
  }

  // Finalize the last question
  finalizeCurrentQuestion();

  return {
    questions,
    rawCount: questions.length,
    errors: []
  };
}

/**
 * Converts unstructured / loose text into structured [question] tags
 */
export function formatToStructuredTags(rawText) {
  const parsed = parsePastedQuestions(rawText, { idMode: 'preserve' });
  if (!parsed.questions.length) return rawText;

  const blocks = [];
  parsed.questions.forEach((q) => {
    let block = `[question]\n`;
    if (q.id) block += `[id: ${q.id}]\n`;
    if (q.points && q.points !== 1) block += `[points: ${q.points}]\n`;

    const cleanQText = q.questionText.replace(/<\/?p>/gi, '\n').trim();
    block += `${cleanQText}\n\n`;

    // Choices
    (q.answers || []).forEach(a => {
      block += `[${a.label}] ${a.text}\n`;
    });

    // Correct Answer
    const correctAns = (q.answers || []).find(a => a.correct);
    if (correctAns) {
      block += `\n[answer: ${correctAns.label}]\n`;
    }

    // Explanation
    if (q.explanation) {
      const cleanExpl = q.explanation.replace(/<\/?p>/gi, '\n').replace(/Explanation:\s*/gi, '').trim();
      if (cleanExpl) {
        block += `\n[explanation]\n${cleanExpl}\n`;
      }
    }

    block += `[/question]`;
    blocks.push(block);
  });

  return blocks.join('\n\n');
}

/**
 * Converts an array of text lines to LearnDash-compatible HTML paragraphs
 */
export function formatHtmlParagraphs(lines) {
  if (!lines || !lines.length) return '';

  const rawCombined = lines.join('\n').trim();
  if (!rawCombined) return '';

  // If already contains block HTML tags (<p>, <div>, <table>, <ul>, <ol>), return as is
  if (/<p[\s>]|<div[\s>]|<table[\s>]|<ul[\s>]|<ol[\s>]/i.test(rawCombined)) {
    return rawCombined;
  }

  // Split by double newline or blank lines
  const paragraphs = rawCombined.split(/\n\s*\n+/);
  const formatted = paragraphs
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => {
      const cleaned = p.replace(/\n+/g, ' ');
      return `<p>${cleaned}</p>`;
    });

  return formatted.join('\n');
}

/**
 * Builds standard correctMsg and incorrectMsg with explanation
 */
export function buildFeedbackMessages(question) {
  const correctChoice = (question.answers || []).find(a => a.correct);
  const correctLabel = correctChoice ? correctChoice.label : '';
  const correctText = correctChoice ? correctChoice.text : '';

  let header = '';
  if (correctLabel) {
    header = `<p>Correct Answer: ${correctLabel}${correctText ? ') ' + correctText : ''}</p>`;
  }

  let explHtml = question.explanation ? question.explanation.trim() : '';
  if (explHtml && !explHtml.toLowerCase().includes('explanation:')) {
    explHtml = `<p>Explanation:&nbsp;</p>\n${explHtml}`;
  }

  const combinedFeedback = [header, explHtml].filter(Boolean).join('\n');

  if (!question.correctMsg) {
    question.correctMsg = combinedFeedback;
  }
  if (!question.incorrectMsg) {
    question.incorrectMsg = combinedFeedback;
  }
}
