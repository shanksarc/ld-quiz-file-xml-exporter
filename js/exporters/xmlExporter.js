/**
 * LearnDash / WpProQuiz Template-Preserving XML Exporter
 */

import { buildFeedbackMessages } from '../parsers/pasteParser.js';

/**
 * Escapes CDATA content safely so that ']]>' never breaks the CDATA container.
 */
export function wrapInCData(text) {
  if (text === null || text === undefined) return '<![CDATA[]]>';
  const str = String(text);
  if (!str) return '<![CDATA[]]>';
  // Escape ]]> by splitting into ]]]]><![CDATA[>
  const safeStr = str.replace(/\]\]>/g, ']]]]><![CDATA[>');
  return `<![CDATA[${safeStr}]]>`;
}

/**
 * Serializes a Question object into a <question> XML element string
 */
export function serializeQuestion(q) {
  // Ensure feedback messages are present
  buildFeedbackMessages(q);

  const answerType = q.answerType || 'single';
  const points = Number.isFinite(q.points) ? q.points : 1;
  const qId = q.id || '';
  const qText = q.questionText || '';
  const correctMsg = q.correctMsg || '';
  const incorrectMsg = q.incorrectMsg || '';
  const tipMsg = q.tipMsg || '';
  const category = q.category || '';

  let answersXml = '<answers>';
  (q.answers || []).forEach(ans => {
    const isCorrect = Boolean(ans.correct);
    const ansPoints = isCorrect ? (ans.points > 0 ? ans.points : points) : 0;
    const ansText = ans.text || '';
    const hasHtml = /<[a-z][\s\S]*>/i.test(ansText);
    const htmlAttr = hasHtml ? 'true' : 'false';

    answersXml += `<answer points="${ansPoints}" correct="${isCorrect ? 'true' : 'false'}">`;
    answersXml += `<answerText html="${htmlAttr}">${wrapInCData(ansText)}</answerText>`;
    answersXml += `<stortText html="false"><![CDATA[]]></stortText>`;
    answersXml += `</answer>`;
  });
  answersXml += '</answers>';

  return `<question answerType="${answerType}">` +
    `<title>${wrapInCData(qId)}</title>` +
    `<points>${points}</points>` +
    `<questionText>${wrapInCData(qText)}</questionText>` +
    `<correctMsg>${wrapInCData(correctMsg)}</correctMsg>` +
    `<incorrectMsg>${wrapInCData(incorrectMsg)}</incorrectMsg>` +
    `<tipMsg enabled="${tipMsg ? 'true' : 'false'}">${wrapInCData(tipMsg)}</tipMsg>` +
    (category ? `<category>${wrapInCData(category)}</category>` : `<category/>`) +
    `<correctSameText>true</correctSameText>` +
    `<showPointsInBox>false</showPointsInBox>` +
    `<answerPointsActivated>false</answerPointsActivated>` +
    `<answerPointsDiffModusActivated>false</answerPointsDiffModusActivated>` +
    `<disableCorrect>false</disableCorrect>` +
    answersXml +
    `</question>`;
}

/**
 * Generates full LearnDash XML by inserting questions into the template
 */
export function generateLearnDashXml(quizModel, questionsToExport, options = {}) {
  const {
    updatedSettings = {}
  } = options;

  const rawTemplate = quizModel.rawXml;

  // If we have a raw XML template, we perform surgical replacement of the <questions> block
  // while preserving all other quiz settings, post metadata, and XML attributes.
  const serializedQuestions = questionsToExport.map(q => serializeQuestion(q)).join('');

  if (rawTemplate && rawTemplate.includes('<wpProQuiz>')) {
    let resultXml = rawTemplate;

    // Replace the <questions>...</questions> block
    const questionsRegex = /<questions[\s\S]*?<\/questions>/;
    if (questionsRegex.test(resultXml)) {
      resultXml = resultXml.replace(questionsRegex, `<questions>${serializedQuestions}</questions>`);
    } else {
      // Insert before <post> or </quiz>
      if (resultXml.includes('<post>')) {
        resultXml = resultXml.replace('<post>', `<questions>${serializedQuestions}</questions><post>`);
      } else {
        resultXml = resultXml.replace('</quiz>', `<questions>${serializedQuestions}</questions></quiz>`);
      }
    }

    // Apply updated settings if user modified quiz title or timeLimit in UI
    if (updatedSettings.title) {
      resultXml = resultXml.replace(/<title([^>]*)><!\[CDATA\[[\s\S]*?\]\]><\/title>/, `<title$1>${wrapInCData(updatedSettings.title)}</title>`);
      resultXml = resultXml.replace(/<post_title><!\[CDATA\[[\s\S]*?\]\]><\/post_title>/, `<post_title>${wrapInCData(updatedSettings.title)}</post_title>`);
    }
    if (updatedSettings.timeLimit !== undefined) {
      resultXml = resultXml.replace(/<timeLimit>\d+<\/timeLimit>/, `<timeLimit>${updatedSettings.timeLimit}</timeLimit>`);
    }
    if (updatedSettings.questionsPerPage !== undefined) {
      resultXml = resultXml.replace(/<quizModus questionsPerPage="\d+">(\d+)<\/quizModus>/, `<quizModus questionsPerPage="${updatedSettings.questionsPerPage}">$1</quizModus>`);
    }
    if (updatedSettings.questionRandom !== undefined) {
      resultXml = resultXml.replace(/<questionRandom>(?:true|false)<\/questionRandom>/, `<questionRandom>${updatedSettings.questionRandom ? 'true' : 'false'}</questionRandom>`);
    }
    if (updatedSettings.answerRandom !== undefined) {
      resultXml = resultXml.replace(/<answerRandom>(?:true|false)<\/answerRandom>/, `<answerRandom>${updatedSettings.answerRandom ? 'true' : 'false'}</answerRandom>`);
    }
    if (updatedSettings.showPoints !== undefined) {
      resultXml = resultXml.replace(/<showPoints>(?:true|false)<\/showPoints>/, `<showPoints>${updatedSettings.showPoints ? 'true' : 'false'}</showPoints>`);
    }

    return resultXml;
  }

  // Fallback: Construct complete valid LearnDash XML structure from model
  const s = { ...quizModel.settings, ...updatedSettings };
  const headerAttrs = quizModel.headerAttrs || {
    version: '0.28',
    exportVersion: '1',
    ld_version: '4.5.3',
    LEARNDASH_SETTINGS_DB_VERSION: '2.5'
  };

  const headerAttrStr = Object.entries(headerAttrs)
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ');

  let postMetasXml = '';
  (quizModel.postMetas || []).forEach(pm => {
    postMetasXml += `<post_meta><meta_key>${wrapInCData(pm.meta_key)}</meta_key><meta_value>${wrapInCData(pm.meta_value)}</meta_value></post_meta>`;
  });

  return '<?xml version="1.0" encoding="utf-8"?>\n' +
    `<wpProQuiz><header ${headerAttrStr}/><data><quiz>` +
    `<title titleHidden="${s.titleHidden ?? 'true'}">${wrapInCData(s.title || 'LearnDash Quiz')}</title>` +
    `<text>${wrapInCData(s.text || ' AAZZAAZZ')}</text>` +
    `<resultText gradeEnabled="true"><text prozent="0"><![CDATA[]]></text></resultText>` +
    `<btnRestartQuizHidden>${s.btnRestartQuizHidden ?? 'false'}</btnRestartQuizHidden>` +
    `<btnViewQuestionHidden>${s.btnViewQuestionHidden ?? 'false'}</btnViewQuestionHidden>` +
    `<questionRandom>${s.questionRandom ? 'true' : 'false'}</questionRandom>` +
    `<answerRandom>${s.answerRandom ? 'true' : 'false'}</answerRandom>` +
    `<timeLimit>${s.timeLimit || 1800}</timeLimit>` +
    `<showPoints>${s.showPoints ? 'true' : 'false'}</showPoints>` +
    `<statistic activated="true" ipLock="0"/>` +
    `<quizRunOnce type="1" cookie="true" time="0">true</quizRunOnce>` +
    `<numberedAnswer>${s.numberedAnswer ? 'true' : 'false'}</numberedAnswer>` +
    `<hideAnswerMessageBox>${s.hideAnswerMessageBox ? 'true' : 'false'}</hideAnswerMessageBox>` +
    `<disabledAnswerMark>${s.disabledAnswerMark ? 'true' : 'false'}</disabledAnswerMark>` +
    `<showMaxQuestion showMaxQuestionValue="0" showMaxQuestionPercent="false">false</showMaxQuestion>` +
    `<toplist activated="true"><toplistDataAddPermissions>1</toplistDataAddPermissions><toplistDataSort>1</toplistDataSort><toplistDataAddMultiple>false</toplistDataAddMultiple><toplistDataAddBlock>0</toplistDataAddBlock><toplistDataShowLimit>0</toplistDataShowLimit><toplistDataShowIn>0</toplistDataShowIn><toplistDataCaptcha>false</toplistDataCaptcha><toplistDataAddAutomatic>false</toplistDataAddAutomatic></toplist>` +
    `<showAverageResult>${s.showAverageResult ? 'true' : 'false'}</showAverageResult>` +
    `<prerequisite>false</prerequisite>` +
    `<showReviewQuestion>${s.showReviewQuestion ? 'true' : 'false'}</showReviewQuestion>` +
    `<quizSummaryHide>false</quizSummaryHide>` +
    `<skipQuestionDisabled>false</skipQuestionDisabled>` +
    `<emailNotification>0</emailNotification>` +
    `<userEmailNotification>false</userEmailNotification>` +
    `<showCategoryScore>${s.showCategoryScore ? 'true' : 'false'}</showCategoryScore>` +
    `<hideResultCorrectQuestion>false</hideResultCorrectQuestion>` +
    `<hideResultQuizTime>false</hideResultQuizTime>` +
    `<hideResultPoints>false</hideResultPoints>` +
    `<autostart>${s.autostart ? 'true' : 'false'}</autostart>` +
    `<forcingQuestionSolve>${s.forcingQuestionSolve ? 'true' : 'false'}</forcingQuestionSolve>` +
    `<hideQuestionPositionOverview>${s.hideQuestionPositionOverview ? 'true' : 'false'}</hideQuestionPositionOverview>` +
    `<hideQuestionNumbering>${s.hideQuestionNumbering ? 'true' : 'false'}</hideQuestionNumbering>` +
    `<sortCategories>false</sortCategories>` +
    `<showCategory>false</showCategory>` +
    `<quizModus questionsPerPage="${s.questionsPerPage || 0}">${s.quizModus || 2}</quizModus>` +
    `<startOnlyRegisteredUser>false</startOnlyRegisteredUser>` +
    `<forms activated="false" position="0"/>` +
    `<questions>${serializedQuestions}</questions>` +
    `<post><post_title>${wrapInCData(s.title || 'LearnDash Quiz')}</post_title><post_content><![CDATA[]]></post_content></post>` +
    postMetasXml +
    `</quiz></data></wpProQuiz>`;
}

/**
 * Sanitizes a title string into a safe file name
 */
export function sanitizeFilename(title) {
  const clean = (title || 'Quiz')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\s+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `LD_Quiz_${clean || 'Export'}.xml`;
}
