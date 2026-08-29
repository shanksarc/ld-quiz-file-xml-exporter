/**
 * Question & Question-Set Validation Engine
 */

export function validateQuestion(q, existingIds = new Set(), seenIdsThisRun = new Map()) {
  const errors = [];
  const warnings = [];

  // Check Question ID
  const qId = (q.id || '').trim();
  if (!qId) {
    errors.push('Question ID is missing.');
  } else {
    // Check duplicate ID
    if (seenIdsThisRun.has(qId)) {
      errors.push(`Duplicate Question ID: "${qId}" is used by multiple questions.`);
    } else {
      seenIdsThisRun.set(qId, true);
    }
  }

  // Check Question Text
  const strippedText = (q.questionText || '').replace(/<[^>]*>/g, '').trim();
  if (!strippedText) {
    errors.push('Question text is missing or empty.');
  }

  // Check Answers
  const answers = q.answers || [];
  if (!answers.length) {
    errors.push('No answer choices provided.');
  } else if (answers.length < 2) {
    errors.push(`At least 2 answer choices required (found ${answers.length}).`);
  } else if (answers.length === 3) {
    warnings.push('Only 3 answer choices provided (standard is 4).');
  }

  // Check empty choice text
  const emptyChoices = answers.filter(a => !(a.text || '').trim());
  if (emptyChoices.length > 0) {
    errors.push(`${emptyChoices.length} answer choice(s) have empty text.`);
  }

  // Check Correct Answer
  const correctAnswers = answers.filter(a => a.correct);
  if (q.answerType === 'single') {
    if (correctAnswers.length === 0) {
      errors.push('No correct answer is selected.');
    } else if (correctAnswers.length > 1) {
      errors.push(`Single-choice question has ${correctAnswers.length} correct answers marked.`);
    }
  }

  // Check Points
  if (!Number.isFinite(q.points) || q.points < 0) {
    warnings.push('Invalid points value. Defaulting to 1.');
  }

  // Check Explanation
  const strippedExplanation = (q.explanation || '').replace(/<[^>]*>/g, '').trim();
  if (!strippedExplanation) {
    warnings.push('No explanation provided.');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

export function validateQuestionSet(questions) {
  const seenIds = new Map();
  const textHashMap = new Map();
  const summary = {
    total: questions.length,
    valid: 0,
    errorCount: 0,
    warningCount: 0,
    duplicateIdCount: 0,
    duplicateTextWarnings: [],
    items: []
  };

  questions.forEach((q, index) => {
    const res = validateQuestion(q, new Set(), seenIds);
    q.validation = res;

    // Check duplicate question text
    const cleanText = (q.questionText || '')
      .replace(/<[^>]*>/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 120);

    if (cleanText.length > 20) {
      if (textHashMap.has(cleanText)) {
        const prevIdx = textHashMap.get(cleanText);
        const warnMsg = `Possible duplicate question text with Question #${prevIdx + 1} (${questions[prevIdx].id || 'Unnamed'}).`;
        res.warnings.push(warnMsg);
        summary.duplicateTextWarnings.push({ qIndex: index, prevIndex: prevIdx });
      } else {
        textHashMap.set(cleanText, index);
      }
    }

    if (res.valid) {
      summary.valid++;
    } else {
      summary.errorCount++;
    }
    if (res.warnings.length > 0) {
      summary.warningCount += res.warnings.length;
    }

    summary.items.push({
      index,
      id: q.id || `Question #${index + 1}`,
      valid: res.valid,
      errors: res.errors,
      warnings: res.warnings
    });
  });

  return summary;
}
