/**
 * LearnDash / WpProQuiz XML Parser
 */

import { createQuestion, createAnswer } from '../models/questionModel.js';
import { createQuizModel } from '../models/quizModel.js';

export function parseLearnDashXml(xmlString) {
  if (!xmlString || typeof xmlString !== 'string') {
    throw new Error('Invalid XML string provided.');
  }

  let xmlDoc;
  if (typeof window !== 'undefined' && window.DOMParser) {
    const parser = new DOMParser();
    xmlDoc = parser.parseFromString(xmlString, 'text/xml');
    const parseError = xmlDoc.querySelector('parsererror');
    if (parseError) {
      throw new Error('XML parsing failed: ' + parseError.textContent);
    }
  } else {
    // For test environments / non-browser fallback
    throw new Error('DOMParser is required for XML parsing in this context.');
  }

  const root = xmlDoc.documentElement;
  if (root.tagName !== 'wpProQuiz') {
    throw new Error('Invalid root element: Expected <wpProQuiz>, found <' + root.tagName + '>');
  }

  // Extract Header
  const headerElem = root.querySelector('header');
  const headerAttrs = {};
  if (headerElem) {
    for (let i = 0; i < headerElem.attributes.length; i++) {
      const attr = headerElem.attributes[i];
      headerAttrs[attr.name] = attr.value;
    }
  }

  const quizElem = root.querySelector('data > quiz');
  if (!quizElem) {
    throw new Error('Malformed XML: Missing <data><quiz> structure.');
  }

  // Extract Quiz Settings
  const settings = {};
  for (let i = 0; i < quizElem.children.length; i++) {
    const child = quizElem.children[i];
    const tag = child.tagName;
    if (tag !== 'questions' && tag !== 'post' && tag !== 'post_meta') {
      const text = child.textContent;
      if (tag === 'title') {
        settings.title = text;
        settings.titleHidden = child.getAttribute('titleHidden') || 'true';
      } else if (tag === 'timeLimit') {
        settings.timeLimit = parseInt(text, 10) || 0;
      } else if (tag === 'quizModus') {
        settings.quizModus = parseInt(text, 10) || 0;
        settings.questionsPerPage = parseInt(child.getAttribute('questionsPerPage'), 10) || 0;
      } else if (tag === 'questionRandom') {
        settings.questionRandom = text.trim() === 'true';
      } else if (tag === 'answerRandom') {
        settings.answerRandom = text.trim() === 'true';
      } else if (tag === 'showPoints') {
        settings.showPoints = text.trim() === 'true';
      } else {
        settings[tag] = text;
      }
    }
  }

  // Extract Post and Post Meta
  const postElem = quizElem.querySelector('post');
  const post = {
    post_title: postElem?.querySelector('post_title')?.textContent || settings.title || 'LearnDash Quiz',
    post_content: postElem?.querySelector('post_content')?.textContent || ''
  };

  const postMetas = [];
  const postMetaElems = quizElem.querySelectorAll('post_meta');
  postMetaElems.forEach(pm => {
    const key = pm.querySelector('meta_key')?.textContent || '';
    const value = pm.querySelector('meta_value')?.textContent || '';
    postMetas.push({ meta_key: key, meta_value: value });
  });

  // Extract Questions
  const questions = [];
  const questionElems = quizElem.querySelectorAll('questions > question');
  const labels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  questionElems.forEach((qEl, qIndex) => {
    const answerType = qEl.getAttribute('answerType') || 'single';
    const id = qEl.querySelector('title')?.textContent || `Q${String(qIndex + 1).padStart(3, '0')}`;
    const points = parseFloat(qEl.querySelector('points')?.textContent) || 1;
    const questionText = qEl.querySelector('questionText')?.textContent || '';
    const correctMsg = qEl.querySelector('correctMsg')?.textContent || '';
    const incorrectMsg = qEl.querySelector('incorrectMsg')?.textContent || '';
    const tipMsg = qEl.querySelector('tipMsg')?.textContent || '';
    const category = qEl.querySelector('category')?.textContent || '';

    // Extract Answers
    const answers = [];
    const answerElems = qEl.querySelectorAll('answers > answer');
    answerElems.forEach((aEl, aIndex) => {
      const isCorrect = aEl.getAttribute('correct') === 'true';
      const ansPoints = parseFloat(aEl.getAttribute('points')) || (isCorrect ? points : 0);
      const answerText = aEl.querySelector('answerText')?.textContent || '';
      const label = aIndex < labels.length ? labels[aIndex] : String(aIndex + 1);

      answers.push(createAnswer(label, answerText, isCorrect, ansPoints));
    });

    // Extract explanation if embedded inside correctMsg
    let explanation = '';
    if (correctMsg) {
      const explMatch = correctMsg.match(/<p>Explanation:\s*<\/p>\s*([\s\S]*)/i) ||
                         correctMsg.match(/Explanation:\s*([\s\S]*)/i);
      if (explMatch) {
        explanation = explMatch[1].trim();
      }
    }

    const questionObj = createQuestion({
      id,
      questionText,
      answers,
      explanation,
      points,
      answerType,
      category,
      tipMsg,
      correctMsg,
      incorrectMsg,
      sourceIndex: qIndex,
      isNew: false
    });

    questions.push(questionObj);
  });

  return createQuizModel({
    rawXml: xmlString,
    headerAttrs,
    settings,
    post,
    postMetas,
    existingQuestions: questions,
    questions: [...questions],
    templateSource: 'uploaded'
  });
}
