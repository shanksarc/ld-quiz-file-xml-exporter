/**
 * Question Model definitions and factory functions
 */

export function createAnswer(label = 'A', text = '', correct = false, points = 0) {
  return {
    label: String(label).toUpperCase(),
    text: String(text || '').trim(),
    correct: Boolean(correct),
    points: correct ? (points > 0 ? points : 1) : 0
  };
}

export function createQuestion(params = {}) {
  // CRITICAL FIX: Only use default blank answers if params.answers is NOT provided at all.
  // If params.answers is provided (even as empty array []), preserve it.
  const answers = Array.isArray(params.answers) 
    ? params.answers 
    : [
        createAnswer('A', '', false, 0),
        createAnswer('B', '', false, 0),
        createAnswer('C', '', false, 0),
        createAnswer('D', '', false, 0)
      ];

  return {
    id: params.id || '',
    questionText: params.questionText || '',
    answers,
    explanation: params.explanation || '',
    points: Number.isFinite(params.points) ? params.points : 1,
    answerType: params.answerType || 'single',
    category: params.category || '',
    tipMsg: params.tipMsg || '',
    correctMsg: params.correctMsg || '',
    incorrectMsg: params.incorrectMsg || '',
    sourceIndex: params.sourceIndex || 0,
    isNew: params.isNew !== undefined ? params.isNew : true,
    validation: params.validation || { valid: true, errors: [], warnings: [] }
  };
}

export function cloneQuestion(q) {
  return {
    ...q,
    answers: (q.answers || []).map(a => ({ ...a })),
    validation: {
      valid: q.validation ? q.validation.valid : true,
      errors: [...(q.validation?.errors || [])],
      warnings: [...(q.validation?.warnings || [])]
    }
  };
}
