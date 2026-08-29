/**
 * Quiz Model definitions and factory functions
 */

export function createQuizModel(params = {}) {
  return {
    rawXml: params.rawXml || '',
    templateDoc: params.templateDoc || null,
    headerAttrs: params.headerAttrs || {
      version: '0.28',
      exportVersion: '1',
      ld_version: '4.5.3',
      LEARNDASH_SETTINGS_DB_VERSION: '2.5'
    },
    settings: {
      title: params.settings?.title || 'LearnDash Quiz',
      titleHidden: params.settings?.titleHidden ?? 'true',
      text: params.settings?.text || ' AAZZAAZZ',
      timeLimit: params.settings?.timeLimit || 1800,
      showPoints: params.settings?.showPoints ?? true,
      questionRandom: params.settings?.questionRandom ?? false,
      answerRandom: params.settings?.answerRandom ?? false,
      quizModus: params.settings?.quizModus ?? 2,
      questionsPerPage: params.settings?.questionsPerPage ?? 0,
      numberedAnswer: params.settings?.numberedAnswer ?? true,
      hideAnswerMessageBox: params.settings?.hideAnswerMessageBox ?? false,
      disabledAnswerMark: params.settings?.disabledAnswerMark ?? false,
      showAverageResult: params.settings?.showAverageResult ?? true,
      showReviewQuestion: params.settings?.showReviewQuestion ?? true,
      forcingQuestionSolve: params.settings?.forcingQuestionSolve ?? true,
      hideQuestionPositionOverview: params.settings?.hideQuestionPositionOverview ?? true,
      hideQuestionNumbering: params.settings?.hideQuestionNumbering ?? true,
      showCategoryScore: params.settings?.showCategoryScore ?? true,
      autostart: params.settings?.autostart ?? false,
      passingPercentage: params.settings?.passingPercentage || 50,
      ...params.settings
    },
    post: params.post || {
      post_title: 'LearnDash Quiz',
      post_content: ''
    },
    postMetas: params.postMetas || [],
    existingQuestions: params.existingQuestions || [],
    newQuestions: params.newQuestions || [],
    questions: params.questions || [],
    templateSource: params.templateSource || 'default' // 'default' or 'uploaded'
  };
}
