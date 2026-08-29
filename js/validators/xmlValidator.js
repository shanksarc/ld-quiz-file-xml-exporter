/**
 * High-Performance XML Validation and Verification Engine
 */

export function validateXmlOutput(xmlString, originalQuestions = []) {
  const result = {
    valid: false,
    schemaValid: false,
    questionsValid: false,
    singleChoiceValid: false,
    roundTripValid: false,
    errors: [],
    warnings: [],
    parsedModel: null
  };

  if (!xmlString || typeof xmlString !== 'string') {
    result.errors.push('Empty or invalid XML string.');
    return result;
  }

  // Fast Schema Tag Integrity Check
  const hasWpProQuizOpen = xmlString.includes('<wpProQuiz');
  const hasWpProQuizClose = xmlString.includes('</wpProQuiz>');
  const hasQuizOpen = xmlString.includes('<quiz>');
  const hasQuizClose = xmlString.includes('</quiz>');
  const hasQuestionsOpen = xmlString.includes('<questions>');
  const hasQuestionsClose = xmlString.includes('</questions>');

  if (!hasWpProQuizOpen || !hasWpProQuizClose || !hasQuizOpen || !hasQuizClose || !hasQuestionsOpen || !hasQuestionsClose) {
    result.errors.push('XML Schema Error: Required envelope tags (<wpProQuiz>, <quiz>, <questions>) are missing or unclosed.');
    return result;
  }

  result.schemaValid = true;

  // Question counts in XML
  const qMatches = xmlString.match(/<question(?:\s+[^>]*)?>/g) || [];
  const questionCount = qMatches.length;

  if (questionCount === 0) {
    result.warnings.push('XML contains 0 questions.');
  }

  // Answer correctness check: Each question must have at least one correct="true"
  const questionBlocks = xmlString.split(/<question(?:\s+[^>]*)?>/).slice(1);
  let allSingleChoiceValid = true;
  let allQuestionsValid = true;

  questionBlocks.forEach((block, idx) => {
    const qNum = idx + 1;
    // Check title/ID
    const titleMatch = block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/);
    const qId = titleMatch ? titleMatch[1] : `Q#${qNum}`;

    // Count correct="true"
    const correctMatches = block.match(/correct="true"/g) || [];
    if (correctMatches.length !== 1) {
      result.errors.push(`Question #${qNum} (${qId}) must have exactly 1 correct answer (found ${correctMatches.length}).`);
      allSingleChoiceValid = false;
    }

    // Count total answers
    const ansMatches = block.match(/<answer(?:\s+[^>]*)?>/g) || [];
    if (ansMatches.length < 2) {
      result.errors.push(`Question #${qNum} (${qId}) has fewer than 2 answer choices.`);
      allQuestionsValid = false;
    }
  });

  result.questionsValid = allQuestionsValid;
  result.singleChoiceValid = allSingleChoiceValid;

  // Round-trip count verification
  if (originalQuestions && originalQuestions.length > 0) {
    if (questionCount !== originalQuestions.length) {
      result.errors.push(`Round-trip mismatch: Original had ${originalQuestions.length} questions, output XML has ${questionCount}.`);
      result.roundTripValid = false;
    } else {
      result.roundTripValid = true;
    }
  } else {
    result.roundTripValid = true;
  }

  result.valid = result.schemaValid && result.questionsValid && result.singleChoiceValid && result.roundTripValid && result.errors.length === 0;

  return result;
}
