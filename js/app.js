/**
 * LearnDash XML Question Importer - Main Application Controller
 */

import { DEFAULT_REFERENCE_XML } from './templates/defaultTemplate.js?v=2.3';
import { parseLearnDashXml } from './parsers/xmlParser.js?v=2.3';
import { parsePastedQuestions, formatToStructuredTags, formatQuestionId } from './parsers/pasteParser.js?v=2.3';
import { parseDocxFile } from './parsers/docxParser.js?v=2.3';
import { validateQuestionSet } from './validators/questionValidator.js?v=2.3';
import { generateLearnDashXml, sanitizeFilename } from './exporters/xmlExporter.js?v=2.3';
import { validateXmlOutput } from './validators/xmlValidator.js?v=2.3';
import { createQuestion, createAnswer, cloneQuestion } from './models/questionModel.js?v=2.3';

class LearnDashApp {
  constructor() {
    this.currentStage = 1;
    this.quizModel = null;
    this.questionHandlingMode = 'replace'; // 'replace' (default), 'append', 'insert'
    this.insertPosition = 1;
    this.parsedNewQuestions = [];
    this.workingQuestions = [];
    this.validationSummary = null;
    this.filterStatus = 'all'; // 'all', 'errors', 'warnings', 'valid'
    this.searchQuery = '';
    this.generatedXml = '';
    this.xmlValidation = null;
    this.showFullXml = false;

    this.init();
  }

  init() {
    this.loadDefaultTemplate();
    this.setupEventListeners();
    this.updateStageView();
    this.updateIdPreview();
  }

  loadDefaultTemplate() {
    try {
      this.quizModel = parseLearnDashXml(DEFAULT_REFERENCE_XML);
      this.renderTemplateInspection();
      this.showToast('Reference template loaded successfully', 'success');
    } catch (err) {
      console.error('Failed to load default template:', err);
      this.showToast('Failed to load default template: ' + err.message, 'error');
    }
  }

  setupEventListeners() {
    // Stepper navigation
    document.querySelectorAll('.step-item').forEach(item => {
      item.addEventListener('click', () => {
        const stageNum = parseInt(item.dataset.stage, 10);
        this.goToStage(stageNum);
      });
    });

    // Stage 1: Template Upload Dropzone
    const templateDropzone = document.getElementById('templateDropzone');
    const templateFileInput = document.getElementById('templateFileInput');

    if (templateDropzone && templateFileInput) {
      templateDropzone.addEventListener('click', () => templateFileInput.click());
      templateFileInput.addEventListener('change', (e) => this.handleTemplateFileUpload(e.target.files[0]));

      templateDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        templateDropzone.classList.add('dragover');
      });
      templateDropzone.addEventListener('dragleave', () => templateDropzone.classList.remove('dragover'));
      templateDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        templateDropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
          this.handleTemplateFileUpload(e.dataTransfer.files[0]);
        }
      });
    }

    // Reset to reference template button
    const btnUseRefTemplate = document.getElementById('btnUseRefTemplate');
    if (btnUseRefTemplate) {
      btnUseRefTemplate.addEventListener('click', () => {
        this.loadDefaultTemplate();
      });
    }

    // Download original backup button
    const btnDownloadBackup = document.getElementById('btnDownloadBackup');
    if (btnDownloadBackup) {
      btnDownloadBackup.addEventListener('click', () => this.downloadOriginalBackup());
    }

    // Question handling mode radio change
    document.querySelectorAll('input[name="handlingMode"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.questionHandlingMode = e.target.value;
        const insertGroup = document.getElementById('insertPosGroup');
        if (insertGroup) {
          insertGroup.style.display = this.questionHandlingMode === 'insert' ? 'block' : 'none';
        }
      });
    });

    // Stage 1 Next button
    const btnStage1Next = document.getElementById('btnStage1Next');
    if (btnStage1Next) {
      btnStage1Next.addEventListener('click', () => this.goToStage(2));
    }

    // Stage 2: Tabs (Paste vs Word Upload)
    document.querySelectorAll('.tab-btn:not(.filter-btn)').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!btn.dataset.tab) return;
        document.querySelectorAll('.tab-btn:not(.filter-btn)').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
        btn.classList.add('active');
        const targetTab = document.getElementById(btn.dataset.tab);
        if (targetTab) targetTab.style.display = 'block';
      });
    });

    // Stage 2: Syntax Reference Toggle
    const btnToggleSyntaxRef = document.getElementById('btnToggleSyntaxRef');
    const tagReferenceBox = document.getElementById('tagReferenceBox');
    if (btnToggleSyntaxRef && tagReferenceBox) {
      btnToggleSyntaxRef.addEventListener('click', () => {
        tagReferenceBox.classList.toggle('active');
      });
    }

    // Stage 2: Tag Insertion Chips
    document.querySelectorAll('.tag-chip[data-insert]').forEach(chip => {
      chip.addEventListener('click', () => {
        const textToInsert = chip.getAttribute('data-insert');
        this.insertTextIntoPasteEditor(textToInsert);
      });
    });

    // Stage 2: Format to Structured Tags button
    const btnFormatToTags = document.getElementById('btnFormatToTags');
    if (btnFormatToTags) {
      btnFormatToTags.addEventListener('click', () => {
        const textarea = document.getElementById('pasteTextarea');
        if (!textarea || !textarea.value.trim()) {
          this.showToast('Please paste or type questions first.', 'warning');
          return;
        }
        const formatted = formatToStructuredTags(textarea.value);
        textarea.value = formatted;
        this.updateLiveParseStatus(formatted);
        this.showToast('Questions converted into structured [question] tags!', 'success');
      });
    }

    // Stage 2: Load Sample Questions buttons
    const btnLoadSample = document.getElementById('btnLoadSample');
    if (btnLoadSample) {
      btnLoadSample.addEventListener('click', () => this.loadSampleQuestions('natural'));
    }

    const btnLoadTaggedSample = document.getElementById('btnLoadTaggedSample');
    if (btnLoadTaggedSample) {
      btnLoadTaggedSample.addEventListener('click', () => this.loadSampleQuestions('tagged'));
    }

    // Stage 2: Clear paste text
    const btnClearPaste = document.getElementById('btnClearPaste');
    if (btnClearPaste) {
      btnClearPaste.addEventListener('click', () => {
        const textarea = document.getElementById('pasteTextarea');
        if (textarea) {
          textarea.value = '';
          this.updateLiveParseStatus('');
        }
      });
    }

    // Stage 2: Live parser input listener
    const pasteTextarea = document.getElementById('pasteTextarea');
    if (pasteTextarea) {
      pasteTextarea.addEventListener('input', (e) => {
        this.updateLiveParseStatus(e.target.value);
      });
    }

    // Stage 2: Question ID configuration live inputs
    ['idCustomPrefix', 'idCustomStart', 'idCustomPadding', 'idCustomSuffix', 'selectIdMode'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => this.updateIdPreview());
        el.addEventListener('change', () => this.updateIdPreview());
      }
    });

    // Stage 2: Parse Paste button
    const btnParsePaste = document.getElementById('btnParsePaste');
    if (btnParsePaste) {
      btnParsePaste.addEventListener('click', () => this.handleParsePaste());
    }

    // Stage 2: Word docx dropzone & file input
    const docxDropzone = document.getElementById('docxDropzone');
    const docxFileInput = document.getElementById('docxFileInput');

    if (docxDropzone && docxFileInput) {
      docxDropzone.addEventListener('click', () => docxFileInput.click());
      docxFileInput.addEventListener('change', (e) => this.handleDocxFileUpload(e.target.files[0]));

      docxDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        docxDropzone.classList.add('dragover');
      });
      docxDropzone.addEventListener('dragleave', () => docxDropzone.classList.remove('dragover'));
      docxDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        docxDropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
          this.handleDocxFileUpload(e.dataTransfer.files[0]);
        }
      });
    }

    // Stage 3: Toolbar events (Search, Filter, Batch actions)
    const searchQuestionsInput = document.getElementById('searchQuestionsInput');
    if (searchQuestionsInput) {
      searchQuestionsInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase();
        this.renderQuestionsList();
      });
    }

    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.filterStatus = btn.dataset.filter;
        this.renderQuestionsList();
      });
    });

    const btnAddNewQuestion = document.getElementById('btnAddNewQuestion');
    if (btnAddNewQuestion) {
      btnAddNewQuestion.addEventListener('click', () => this.addNewBlankQuestion());
    }

    // Stage 3: Batch Renumber Panel Toggle & Actions
    const btnToggleRenumberPanel = document.getElementById('btnToggleRenumberPanel');
    const batchRenumberPanel = document.getElementById('batchRenumberPanel');
    const btnCloseRenumberPanel = document.getElementById('btnCloseRenumberPanel');
    const btnApplyBatchRenumber = document.getElementById('btnApplyBatchRenumber');

    if (btnToggleRenumberPanel && batchRenumberPanel) {
      btnToggleRenumberPanel.addEventListener('click', () => {
        const isHidden = batchRenumberPanel.style.display === 'none';
        batchRenumberPanel.style.display = isHidden ? 'block' : 'none';
        if (isHidden) {
          // Sync with stage 2 inputs
          const p = document.getElementById('idCustomPrefix')?.value || 'F2B1MQ';
          const s = document.getElementById('idCustomSuffix')?.value || 'CSD';
          const start = document.getElementById('idCustomStart')?.value || '1';
          const pad = document.getElementById('idCustomPadding')?.value || '3';
          
          const bp = document.getElementById('batchPrefix');
          const bs = document.getElementById('batchSuffix');
          const bstart = document.getElementById('batchStart');
          const bpad = document.getElementById('batchPadding');
          if (bp) bp.value = p;
          if (bs) bs.value = s;
          if (bstart) bstart.value = start;
          if (bpad) bpad.value = pad;
        }
      });
    }

    if (btnCloseRenumberPanel && batchRenumberPanel) {
      btnCloseRenumberPanel.addEventListener('click', () => {
        batchRenumberPanel.style.display = 'none';
      });
    }

    if (btnApplyBatchRenumber) {
      btnApplyBatchRenumber.addEventListener('click', () => this.applyBatchRenumber());
    }

    const btnStage3Next = document.getElementById('btnStage3Next');
    if (btnStage3Next) {
      btnStage3Next.addEventListener('click', () => this.prepareStage4Export());
    }

    // Stage 4: Export actions
    const btnDownloadXml = document.getElementById('btnDownloadXml');
    if (btnDownloadXml) {
      btnDownloadXml.addEventListener('click', () => this.downloadGeneratedXml());
    }

    const btnCopyXml = document.getElementById('btnCopyXml');
    if (btnCopyXml) {
      btnCopyXml.addEventListener('click', () => this.copyXmlToClipboard());
    }

    const btnToggleFullXml = document.getElementById('btnToggleFullXml');
    if (btnToggleFullXml) {
      btnToggleFullXml.addEventListener('click', () => {
        this.showFullXml = !this.showFullXml;
        btnToggleFullXml.textContent = this.showFullXml ? 'Show Compact View' : 'Show Full XML';
        this.renderXmlPreview();
      });
    }
  }

  updateIdPreview() {
    const mode = document.getElementById('selectIdMode')?.value || 'custom';
    const prefix = document.getElementById('idCustomPrefix')?.value || '';
    const startNum = parseInt(document.getElementById('idCustomStart')?.value, 10) || 1;
    const padding = parseInt(document.getElementById('idCustomPadding')?.value, 10) || 3;
    const suffix = document.getElementById('idCustomSuffix')?.value || '';
    const previewEl = document.getElementById('idPreviewBadge');
    const fieldsRow = document.getElementById('customIdFieldsRow');

    if (fieldsRow) {
      fieldsRow.style.opacity = mode === 'custom' ? '1' : '0.5';
    }

    if (!previewEl) return;

    if (mode === 'preserve') {
      previewEl.textContent = 'Mode: Preserving existing question IDs in text';
    } else {
      const ex1 = formatQuestionId(prefix, startNum, padding, suffix);
      const ex2 = formatQuestionId(prefix, startNum + 1, padding, suffix);
      const ex3 = formatQuestionId(prefix, startNum + 2, padding, suffix);
      previewEl.textContent = `ID Preview: ${ex1}, ${ex2}, ${ex3}...`;
    }
  }

  insertTextIntoPasteEditor(text) {
    const textarea = document.getElementById('pasteTextarea');
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentVal = textarea.value;

    textarea.value = currentVal.substring(0, start) + text + currentVal.substring(end);
    textarea.focus();
    textarea.selectionStart = textarea.selectionEnd = start + text.length;
    this.updateLiveParseStatus(textarea.value);
  }

  updateLiveParseStatus(text) {
    const countEl = document.getElementById('liveParseCount');
    const validEl = document.getElementById('liveParseValid');
    const errorsEl = document.getElementById('liveParseErrors');
    const tipsEl = document.getElementById('liveParseTips');

    if (!text || !text.trim()) {
      if (countEl) countEl.textContent = '0 Questions detected';
      if (validEl) validEl.style.display = 'none';
      if (errorsEl) errorsEl.style.display = 'none';
      if (tipsEl) tipsEl.textContent = 'Type or paste questions above to see live parsing feedback.';
      return;
    }

    const idMode = document.getElementById('selectIdMode')?.value || 'custom';
    const idPrefix = document.getElementById('idCustomPrefix')?.value || '';
    const idStartNum = parseInt(document.getElementById('idCustomStart')?.value, 10) || 1;
    const idPadding = parseInt(document.getElementById('idCustomPadding')?.value, 10) || 3;
    const idSuffix = document.getElementById('idCustomSuffix')?.value || '';

    const parsed = parsePastedQuestions(text, { idMode, idPrefix, idStartNum, idPadding, idSuffix });
    const count = parsed.questions.length;

    let validCount = 0;
    let errorCount = 0;
    let missingAnsCount = 0;

    parsed.questions.forEach((q) => {
      const hasCorrect = (q.answers || []).some(a => a.correct);
      const hasChoices = (q.answers || []).length >= 2;
      const hasText = Boolean(q.questionText && q.questionText.trim());

      if (hasCorrect && hasChoices && hasText) {
        validCount++;
      } else {
        errorCount++;
        if (!hasCorrect) missingAnsCount++;
      }
    });

    if (countEl) {
      countEl.textContent = `${count} Question${count === 1 ? '' : 's'} detected`;
    }
    if (validEl) {
      validEl.style.display = 'inline-block';
      validEl.textContent = `${validCount} Valid ✓`;
    }
    if (errorsEl) {
      if (errorCount > 0) {
        errorsEl.style.display = 'inline-block';
        errorsEl.textContent = `${errorCount} Need Attention`;
      } else {
        errorsEl.style.display = 'none';
      }
    }
    if (tipsEl) {
      if (errorCount === 0 && count > 0) {
        tipsEl.innerHTML = `<span style="color: var(--color-success);">All ${count} questions are structured and ready to parse!</span>`;
      } else if (missingAnsCount > 0) {
        tipsEl.innerHTML = `<span style="color: var(--color-warning);">${missingAnsCount} question(s) need a correct answer tag (e.g. <code>[answer: B]</code> or <code>Answer: B</code>).</span>`;
      } else {
        tipsEl.textContent = 'Use [question], [A], [B], [answer: B] for structured formatting.';
      }
    }
  }

  goToStage(stageNum) {
    if (stageNum < 1 || stageNum > 4) return;
    this.currentStage = stageNum;
    this.updateStageView();

    if (stageNum === 3) {
      this.buildWorkingQuestions();
      this.revalidateAndRenderStage3();
    } else if (stageNum === 4) {
      this.prepareStage4Export();
    }
  }

  updateStageView() {
    // Update Stepper
    document.querySelectorAll('.step-item').forEach(item => {
      const num = parseInt(item.dataset.stage, 10);
      item.classList.remove('active', 'completed');
      if (num === this.currentStage) {
        item.classList.add('active');
      } else if (num < this.currentStage) {
        item.classList.add('completed');
      }
    });

    // Update Sections
    document.querySelectorAll('.stage-section').forEach(sec => sec.classList.remove('active'));
    const currentSec = document.getElementById(`stage${this.currentStage}`);
    if (currentSec) {
      currentSec.classList.add('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // --- STAGE 1: TEMPLATE HANDLING ---
  handleTemplateFileUpload(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target.result;
        this.quizModel = parseLearnDashXml(content);
        this.renderTemplateInspection();
        this.showToast(`Template "${file.name}" loaded successfully`, 'success');
      } catch (err) {
        console.error(err);
        this.showToast('XML Template parsing error: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
  }

  renderTemplateInspection() {
    if (!this.quizModel) return;
    const s = this.quizModel.settings;
    const existingCount = this.quizModel.existingQuestions.length;

    const quizTitleEl = document.getElementById('inspectQuizTitle');
    const questionCountEl = document.getElementById('inspectQuestionCount');
    const timeLimitEl = document.getElementById('inspectTimeLimit');
    const showPointsEl = document.getElementById('inspectShowPoints');
    const qRandomEl = document.getElementById('inspectQRandom');
    const aRandomEl = document.getElementById('inspectARandom');
    const qPerPageEl = document.getElementById('inspectQPerPage');

    if (quizTitleEl) quizTitleEl.textContent = s.title || 'Untitled Quiz';
    if (questionCountEl) questionCountEl.textContent = `${existingCount} question${existingCount === 1 ? '' : 's'}`;
    if (timeLimitEl) timeLimitEl.textContent = s.timeLimit ? `${s.timeLimit} seconds (${Math.round(s.timeLimit / 60)} mins)` : 'No limit';
    if (showPointsEl) showPointsEl.textContent = s.showPoints ? 'Yes' : 'No';
    if (qRandomEl) qRandomEl.textContent = s.questionRandom ? 'Yes' : 'No';
    if (aRandomEl) aRandomEl.textContent = s.answerRandom ? 'Yes' : 'No';
    if (qPerPageEl) qPerPageEl.textContent = s.questionsPerPage ? `${s.questionsPerPage} per page` : 'All on one page';

    // Populate editable quiz title in Stage 1 & Stage 4
    const editQuizTitle = document.getElementById('editQuizTitle');
    if (editQuizTitle) editQuizTitle.value = s.title || '';
  }

  downloadOriginalBackup() {
    if (!this.quizModel || !this.quizModel.rawXml) {
      this.showToast('No XML template available to back up.', 'error');
      return;
    }
    const filename = `Backup_${sanitizeFilename(this.quizModel.settings.title)}`;
    this.triggerDownload(this.quizModel.rawXml, filename);
    this.showToast('Backup XML downloaded.', 'success');
  }

  // --- STAGE 2: QUESTION INPUT & PARSING ---
  loadSampleQuestions(format = 'tagged') {
    let sampleText = '';

    if (format === 'tagged') {
      sampleText = `[question]
[points: 1]
A portfolio manager is evaluating the risk profile of a portfolio. Returns are normally distributed with mean 8% and standard deviation 15%. 

What is the parametric VaR at 95% and 99% confidence levels for a $10 million portfolio?

[A] VaR(95%) = $1.2 million, VaR(99%) = $2.0 million
[B] VaR(95%) = $1.5 million, VaR(99%) = $2.3 million
[C] VaR(95%) = $1.8 million, VaR(99%) = $2.5 million
[D] VaR(95%) = $2.0 million, VaR(99%) = $2.8 million

[answer: B]

[explanation]
Formula: VaR = Portfolio Value × (Z × SD - Mean)
For $10M: VaR(95%) = $10M × (1.65 × 15% - 8%) = $1.5M.
VaR(99%) = $10M × (2.33 × 15% - 8%) = $2.3M.
[/question]

[question]
When estimating a coherent risk measure for a multi-asset portfolio, which of the following properties must be satisfied?

[A] Subadditivity, Monotonicity, Positive Homogeneity, and Translation Invariance
[B] Value at Risk proportionality and strict normality
[C] Zero tail risk sensitivity and mean invariance
[D] Skewness symmetry and kurtosis boundedness

[answer: A]

[explanation]
A risk measure is defined as coherent if it satisfies Subadditivity, Monotonicity, Positive Homogeneity, and Translation Invariance.
[/question]

[question]
What distinguishes the Peaks-Over-Threshold (POT) extreme value theory method from Generalized Extreme Value (GEV) block maxima?

[A] POT models all values below the mean, while GEV models tail percentiles.
[B] POT analyzes only observations exceeding a specified high threshold using the Generalized Pareto Distribution.
[C] GEV requires no historical data, while POT requires 500 years of daily returns.
[D] POT eliminates fat tails from financial return series.

[answer: B]

[explanation]
The Peaks-Over-Threshold (POT) approach models excess losses over a chosen high threshold, fitting them to a Generalized Pareto Distribution (GPD).
[/question]`;
    } else {
      sampleText = `Q1. A portfolio manager is evaluating the risk profile of a portfolio. Returns are normally distributed with mean 8% and standard deviation 15%. What is the parametric VaR at 95% and 99% confidence levels for a $10 million portfolio?

A) Arithmetic mean
B) Geometric mean
C) Harmonic mean
D) Weighted-average return

Answer: C

Explanation: 
When an investor makes equal periodic monetary investments, the harmonic mean is the appropriate measure for calculating the average price paid per share.

Formula:
Harmonic Mean = N / [(1/X₁) + (1/X₂) + ... + (1/Xₙ)]
= 3 / [(1/20) + (1/25) + (1/40)]
= 27.27 approximately.`;
    }

    const textarea = document.getElementById('pasteTextarea');
    if (textarea) {
      textarea.value = sampleText;
      this.updateLiveParseStatus(sampleText);
      this.showToast(`Sample questions (${format}) loaded into editor.`, 'info');
    }
  }

  handleParsePaste() {
    const textarea = document.getElementById('pasteTextarea');
    const text = textarea?.value || '';

    if (!text.trim()) {
      this.showToast('Please paste question text before parsing.', 'error');
      return;
    }

    const idMode = document.getElementById('selectIdMode')?.value || 'custom';
    const idPrefix = document.getElementById('idCustomPrefix')?.value || '';
    const idStartNum = parseInt(document.getElementById('idCustomStart')?.value, 10) || 1;
    const idPadding = parseInt(document.getElementById('idCustomPadding')?.value, 10) || 3;
    const idSuffix = document.getElementById('idCustomSuffix')?.value || '';

    const parsed = parsePastedQuestions(text, { idMode, idPrefix, idStartNum, idPadding, idSuffix });

    if (parsed.questions.length === 0) {
      this.showToast('No questions could be identified. Use [question] ... [A] ... [answer: B] tags or Q1. format.', 'error');
      return;
    }

    this.parsedNewQuestions = parsed.questions;
    this.showToast(`Parsed ${parsed.questions.length} questions successfully!`, 'success');
    this.goToStage(3);
  }

  async handleDocxFileUpload(file) {
    if (!file) return;
    try {
      this.showToast('Reading Word document...', 'info');
      const idMode = document.getElementById('selectIdMode')?.value || 'custom';
      const idPrefix = document.getElementById('idCustomPrefix')?.value || '';
      const idStartNum = parseInt(document.getElementById('idCustomStart')?.value, 10) || 1;
      const idPadding = parseInt(document.getElementById('idCustomPadding')?.value, 10) || 3;
      const idSuffix = document.getElementById('idCustomSuffix')?.value || '';

      const parsed = await parseDocxFile(file, { idMode, idPrefix, idStartNum, idPadding, idSuffix });

      if (parsed.questions.length === 0) {
        this.showToast('No questions found in Word document. Check question headers (Q1., Answer:).', 'error');
        return;
      }

      this.parsedNewQuestions = parsed.questions;
      if (parsed.warnings && parsed.warnings.length) {
        parsed.warnings.forEach(w => this.showToast(w, 'warning'));
      }
      this.showToast(`Imported ${parsed.questions.length} questions from DOCX!`, 'success');
      this.goToStage(3);
    } catch (err) {
      console.error(err);
      this.showToast('DOCX Parsing Error: ' + err.message, 'error');
    }
  }

  // --- STAGE 3: REVIEW & EDITING ---
  buildWorkingQuestions() {
    const existing = (this.quizModel?.existingQuestions || []).map(cloneQuestion);
    const newQs = (this.parsedNewQuestions || []).map(cloneQuestion);

    if (this.questionHandlingMode === 'replace') {
      // Use newly parsed questions only (Default)
      this.workingQuestions = newQs.length > 0 ? newQs : existing;
    } else if (this.questionHandlingMode === 'insert') {
      const pos = Math.max(0, Math.min(this.insertPosition - 1, existing.length));
      this.workingQuestions = [
        ...existing.slice(0, pos),
        ...newQs,
        ...existing.slice(pos)
      ];
    } else {
      // 'append'
      this.workingQuestions = [...existing, ...newQs];
    }

    // If workingQuestions is empty, add a clean blank question
    if (this.workingQuestions.length === 0) {
      this.workingQuestions.push(createQuestion({ id: 'Q001', points: 1, answers: [] }));
    }
  }

  revalidateAndRenderStage3() {
    this.validationSummary = validateQuestionSet(this.workingQuestions);
    this.renderValidationBanner();
    this.renderErrorJumpBar();
    this.renderQuestionsList();
  }

  renderValidationBanner() {
    if (!this.validationSummary) return;
    const v = this.validationSummary;

    const totalEl = document.getElementById('statTotalQuestions');
    const validEl = document.getElementById('statValidQuestions');
    const warnEl = document.getElementById('statWarningQuestions');
    const errEl = document.getElementById('statErrorQuestions');

    if (totalEl) totalEl.textContent = v.total;
    if (validEl) validEl.textContent = v.valid;
    if (warnEl) warnEl.textContent = v.warningCount;
    if (errEl) errEl.textContent = v.errorCount;

    // Filter button counts
    const btnFilterAll = document.querySelector('.filter-btn[data-filter="all"]');
    const btnFilterErrors = document.querySelector('.filter-btn[data-filter="errors"]');
    const btnFilterWarnings = document.querySelector('.filter-btn[data-filter="warnings"]');
    const btnFilterValid = document.querySelector('.filter-btn[data-filter="valid"]');

    if (btnFilterAll) btnFilterAll.textContent = `All (${v.total})`;
    if (btnFilterErrors) btnFilterErrors.textContent = `Errors (${v.errorCount})`;
    if (btnFilterWarnings) btnFilterWarnings.textContent = `Warnings (${v.warningCount})`;
    if (btnFilterValid) btnFilterValid.textContent = `Valid (${v.valid})`;
  }

  renderErrorJumpBar() {
    const bar = document.getElementById('errorJumpBar');
    const list = document.getElementById('errorJumpList');
    if (!bar || !list) return;

    const errorItems = (this.validationSummary?.items || []).filter(item => !item.valid);

    if (errorItems.length === 0) {
      bar.style.display = 'none';
      list.innerHTML = '';
      return;
    }

    bar.style.display = 'flex';
    list.innerHTML = '';

    errorItems.forEach(item => {
      const btn = document.createElement('span');
      btn.className = 'error-jump-item';
      btn.textContent = `${item.id}: ${item.errors[0] || 'Error'}`;
      btn.addEventListener('click', () => {
        const card = document.getElementById(`qcard-${item.index}`);
        if (card) {
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          card.classList.add('highlight');
          setTimeout(() => card.classList.remove('highlight'), 2000);
        }
      });
      list.appendChild(btn);
    });
  }

  renderQuestionsList() {
    const container = document.getElementById('questionsListContainer');
    if (!container) return;

    container.innerHTML = '';

    const filtered = this.workingQuestions.map((q, index) => ({ q, index })).filter(({ q }) => {
      // Filter tab
      if (this.filterStatus === 'errors' && q.validation.valid) return false;
      if (this.filterStatus === 'warnings' && (q.validation.warnings || []).length === 0) return false;
      if (this.filterStatus === 'valid' && !q.validation.valid) return false;

      // Search query
      if (this.searchQuery) {
        const textToSearch = `${q.id} ${q.questionText} ${q.explanation} ${(q.answers || []).map(a => a.text).join(' ')}`.toLowerCase();
        if (!textToSearch.includes(this.searchQuery)) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="card" style="text-align: center; padding: 3rem 1rem;">
          <p style="color: var(--text-secondary); font-size: 1rem;">No questions match the current filter or search criteria.</p>
        </div>
      `;
      return;
    }

    filtered.forEach(({ q, index }) => {
      const card = this.createQuestionCardElement(q, index);
      container.appendChild(card);
    });
  }

  createQuestionCardElement(q, index) {
    const card = document.createElement('div');
    card.id = `qcard-${index}`;
    card.className = `question-card ${q.validation.valid ? (q.validation.warnings.length ? 'has-warning' : 'is-valid') : 'has-error'}`;

    // Badge
    let badgeHtml = '';
    if (!q.validation.valid) {
      badgeHtml = `<span class="badge badge-error">✕ ${q.validation.errors.length} Error${q.validation.errors.length > 1 ? 's' : ''}</span>`;
    } else if (q.validation.warnings.length > 0) {
      badgeHtml = `<span class="badge badge-warning">⚠ ${q.validation.warnings.length} Warning${q.validation.warnings.length > 1 ? 's' : ''}</span>`;
    } else {
      badgeHtml = `<span class="badge badge-success">✓ Valid</span>`;
    }

    // Answers rows
    let answersHtml = '';
    (q.answers || []).forEach((ans, aIdx) => {
      const isChecked = ans.correct ? 'checked' : '';
      answersHtml += `
        <div class="answer-row ${ans.correct ? 'correct' : ''}">
          <input type="radio" name="correctRadio_${index}" class="answer-radio" data-qidx="${index}" data-aidx="${aIdx}" ${isChecked} title="Mark as correct answer">
          <span class="answer-label">${ans.label})</span>
          <input type="text" class="answer-input" data-qidx="${index}" data-aidx="${aIdx}" value="${this.escapeHtmlAttr(ans.text)}" placeholder="Choice ${ans.label} text...">
          <button type="button" class="answer-delete-btn" data-qidx="${index}" data-aidx="${aIdx}" title="Delete choice">✕</button>
        </div>
      `;
    });

    // Error and warning messages list
    let alertsHtml = '';
    if (q.validation.errors.length > 0) {
      alertsHtml += `<div style="background: var(--color-error-bg); border-left: 3px solid var(--color-error); padding: 0.5rem 0.75rem; border-radius: 4px; font-size: 0.8rem; color: var(--color-error); margin-bottom: 0.5rem;">
        ${q.validation.errors.map(e => `<div>✕ ${e}</div>`).join('')}
      </div>`;
    }
    if (q.validation.warnings.length > 0) {
      alertsHtml += `<div style="background: var(--color-warning-bg); border-left: 3px solid var(--color-warning); padding: 0.5rem 0.75rem; border-radius: 4px; font-size: 0.8rem; color: var(--color-warning); margin-bottom: 0.5rem;">
        ${q.validation.warnings.map(w => `<div>⚠ ${w}</div>`).join('')}
      </div>`;
    }

    card.innerHTML = `
      <div class="q-card-header">
        <div class="q-card-meta">
          <span class="q-card-index">#${index + 1}</span>
          <span class="q-card-id">${this.escapeHtml(q.id || 'No ID')}</span>
          ${q.isNew ? '<span class="badge badge-info">New</span>' : '<span class="badge" style="background: var(--bg-card); color: var(--text-secondary);">Template</span>'}
        </div>
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          ${badgeHtml}
        </div>
      </div>
      <div class="q-card-body">
        ${alertsHtml}
        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1rem;">
          <div class="form-group" style="margin: 0;">
            <label class="form-label">Question ID / Title</label>
            <input type="text" class="form-control q-id-input" data-qidx="${index}" value="${this.escapeHtmlAttr(q.id)}">
          </div>
          <div class="form-group" style="margin: 0;">
            <label class="form-label">Points</label>
            <input type="number" step="1" min="0" class="form-control q-points-input" data-qidx="${index}" value="${q.points}">
          </div>
        </div>

        <div class="form-group" style="margin: 0;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
            <label class="form-label" style="margin: 0;">Question Text</label>
            <button type="button" class="btn btn-secondary btn-sm toggle-preview-btn" data-qidx="${index}">Preview HTML</button>
          </div>
          <textarea class="form-control q-text-input" data-qidx="${index}" rows="4">${this.escapeHtml(q.questionText)}</textarea>
          <div class="q-text-preview" style="display: none; padding: 0.75rem; background: var(--bg-input); border-radius: var(--radius-md); border: 1px solid var(--border-card); font-size: 0.9rem;"></div>
        </div>

        <div class="form-group" style="margin: 0;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <label class="form-label" style="margin: 0;">Answer Choices</label>
            <button type="button" class="btn btn-secondary btn-sm add-choice-btn" data-qidx="${index}">+ Add Choice</button>
          </div>
          <div class="answers-container">
            ${answersHtml}
          </div>
        </div>

        <div class="form-group" style="margin: 0;">
          <label class="form-label">Explanation / Solution</label>
          <textarea class="form-control q-expl-input" data-qidx="${index}" rows="3" placeholder="Explanation for correct and incorrect feedback...">${this.escapeHtml(q.explanation)}</textarea>
        </div>

        <div class="q-card-footer">
          <div class="q-footer-left">
            <button type="button" class="btn btn-secondary btn-sm move-up-btn" data-qidx="${index}" ${index === 0 ? 'disabled' : ''}>↑ Move Up</button>
            <button type="button" class="btn btn-secondary btn-sm move-down-btn" data-qidx="${index}" ${index === this.workingQuestions.length - 1 ? 'disabled' : ''}>↓ Move Down</button>
          </div>
          <div class="q-footer-right">
            <button type="button" class="btn btn-secondary btn-sm duplicate-q-btn" data-qidx="${index}">Duplicate</button>
            <button type="button" class="btn btn-danger btn-sm delete-q-btn" data-qidx="${index}">Delete</button>
          </div>
        </div>
      </div>
    `;

    // Bind card event listeners
    this.bindQuestionCardEvents(card, index);

    return card;
  }

  bindQuestionCardEvents(card, index) {
    // ID Input
    const idInput = card.querySelector('.q-id-input');
    idInput?.addEventListener('input', (e) => {
      this.workingQuestions[index].id = e.target.value;
      this.revalidateAndRenderStage3();
    });

    // Points Input
    const ptsInput = card.querySelector('.q-points-input');
    ptsInput?.addEventListener('input', (e) => {
      this.workingQuestions[index].points = parseFloat(e.target.value) || 1;
      this.revalidateAndRenderStage3();
    });

    // Question Text Input
    const textInput = card.querySelector('.q-text-input');
    textInput?.addEventListener('input', (e) => {
      this.workingQuestions[index].questionText = e.target.value;
      this.revalidateAndRenderStage3();
    });

    // Explanation Input
    const explInput = card.querySelector('.q-expl-input');
    explInput?.addEventListener('input', (e) => {
      this.workingQuestions[index].explanation = e.target.value;
      this.revalidateAndRenderStage3();
    });

    // Radio button changes
    card.querySelectorAll('.answer-radio').forEach(radio => {
      radio.addEventListener('change', (e) => {
        const aidx = parseInt(e.target.dataset.aidx, 10);
        this.workingQuestions[index].answers.forEach((ans, i) => {
          ans.correct = (i === aidx);
          ans.points = ans.correct ? this.workingQuestions[index].points : 0;
        });
        this.revalidateAndRenderStage3();
      });
    });

    // Answer text input
    card.querySelectorAll('.answer-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const aidx = parseInt(e.target.dataset.aidx, 10);
        if (this.workingQuestions[index].answers[aidx]) {
          this.workingQuestions[index].answers[aidx].text = e.target.value;
        }
        this.revalidateAndRenderStage3();
      });
    });

    // Delete choice
    card.querySelectorAll('.answer-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const aidx = parseInt(btn.dataset.aidx, 10);
        this.workingQuestions[index].answers.splice(aidx, 1);
        // Refresh labels
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        this.workingQuestions[index].answers.forEach((a, i) => {
          a.label = i < letters.length ? letters[i] : String(i + 1);
        });
        this.revalidateAndRenderStage3();
      });
    });

    // Add Choice button
    const btnAddChoice = card.querySelector('.add-choice-btn');
    btnAddChoice?.addEventListener('click', () => {
      const q = this.workingQuestions[index];
      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const nextLabel = q.answers.length < letters.length ? letters[q.answers.length] : String(q.answers.length + 1);
      q.answers.push(createAnswer(nextLabel, '', false, 0));
      this.revalidateAndRenderStage3();
    });

    // Toggle Preview
    const btnTogglePreview = card.querySelector('.toggle-preview-btn');
    const previewBox = card.querySelector('.q-text-preview');
    btnTogglePreview?.addEventListener('click', () => {
      if (!previewBox || !textInput) return;
      if (previewBox.style.display === 'none') {
        previewBox.innerHTML = this.workingQuestions[index].questionText;
        previewBox.style.display = 'block';
        textInput.style.display = 'none';
        btnTogglePreview.textContent = 'Edit HTML';
      } else {
        previewBox.style.display = 'none';
        textInput.style.display = 'block';
        btnTogglePreview.textContent = 'Preview HTML';
      }
    });

    // Move Up / Move Down
    const btnMoveUp = card.querySelector('.move-up-btn');
    btnMoveUp?.addEventListener('click', () => {
      if (index > 0) {
        const temp = this.workingQuestions[index];
        this.workingQuestions[index] = this.workingQuestions[index - 1];
        this.workingQuestions[index - 1] = temp;
        this.revalidateAndRenderStage3();
      }
    });

    const btnMoveDown = card.querySelector('.move-down-btn');
    btnMoveDown?.addEventListener('click', () => {
      if (index < this.workingQuestions.length - 1) {
        const temp = this.workingQuestions[index];
        this.workingQuestions[index] = this.workingQuestions[index + 1];
        this.workingQuestions[index + 1] = temp;
        this.revalidateAndRenderStage3();
      }
    });

    // Duplicate Question
    const btnDuplicate = card.querySelector('.duplicate-q-btn');
    btnDuplicate?.addEventListener('click', () => {
      const cloned = cloneQuestion(this.workingQuestions[index]);
      cloned.id = `${cloned.id}_copy`;
      cloned.isNew = true;
      this.workingQuestions.splice(index + 1, 0, cloned);
      this.revalidateAndRenderStage3();
      this.showToast(`Duplicated ${cloned.id}`, 'info');
    });

    // Delete Question
    const btnDelete = card.querySelector('.delete-q-btn');
    btnDelete?.addEventListener('click', () => {
      const qid = this.workingQuestions[index].id;
      this.workingQuestions.splice(index, 1);
      this.revalidateAndRenderStage3();
      this.showToast(`Deleted question ${qid}`, 'info');
    });
  }

  addNewBlankQuestion() {
    const nextIdx = this.workingQuestions.length + 1;
    const prefix = document.getElementById('idCustomPrefix')?.value || 'F2B1MQ';
    const padding = parseInt(document.getElementById('idCustomPadding')?.value, 10) || 3;
    const suffix = document.getElementById('idCustomSuffix')?.value || 'CSD';

    const newQ = createQuestion({
      id: formatQuestionId(prefix, nextIdx, padding, suffix),
      points: 1,
      isNew: true,
      answers: []
    });
    this.workingQuestions.push(newQ);
    this.revalidateAndRenderStage3();
    this.showToast(`Added new question #${nextIdx}`, 'success');
  }

  applyBatchRenumber() {
    const prefix = document.getElementById('batchPrefix')?.value || '';
    const startNum = parseInt(document.getElementById('batchStart')?.value, 10) || 1;
    const padding = parseInt(document.getElementById('batchPadding')?.value, 10) || 3;
    const suffix = document.getElementById('batchSuffix')?.value || '';

    this.workingQuestions.forEach((q, i) => {
      q.id = formatQuestionId(prefix, startNum + i, padding, suffix);
    });

    this.revalidateAndRenderStage3();
    const panel = document.getElementById('batchRenumberPanel');
    if (panel) panel.style.display = 'none';

    const sampleId = formatQuestionId(prefix, startNum, padding, suffix);
    this.showToast(`Re-numbered all questions (e.g. ${sampleId})!`, 'success');
  }

  // --- STAGE 4: EXPORT & VALIDATION ---
  prepareStage4Export() {
    // Re-validate
    this.validationSummary = validateQuestionSet(this.workingQuestions);
    if (this.validationSummary.errorCount > 0) {
      this.showToast(`Cannot export: ${this.validationSummary.errorCount} blocking errors exist. Please fix them in Review.`, 'error');
      this.goToStage(3);
      return;
    }

    const startTime = performance.now();

    const editQuizTitle = document.getElementById('editQuizTitle');
    const updatedSettings = {
      title: editQuizTitle?.value || this.quizModel.settings.title
    };

    // Ultra-fast XML Generation
    try {
      this.generatedXml = generateLearnDashXml(this.quizModel, this.workingQuestions, { updatedSettings });
      this.xmlValidation = validateXmlOutput(this.generatedXml, this.workingQuestions);

      const endTime = performance.now();
      const elapsedMs = Math.max(1, Math.round(endTime - startTime));

      const perfBadge = document.getElementById('exportPerfBadge');
      if (perfBadge) {
        perfBadge.textContent = `⚡ Ready (Generated in ${elapsedMs}ms)`;
      }

      this.renderStage4Scorecard();
      this.renderXmlPreview();
      this.goToStage(4);
    } catch (err) {
      console.error(err);
      this.showToast('XML Generation Failed: ' + err.message, 'error');
    }
  }

  renderStage4Scorecard() {
    const s = this.quizModel.settings;
    const editQuizTitle = document.getElementById('editQuizTitle');
    const finalTitle = editQuizTitle?.value || s.title || 'LearnDash Quiz';

    const exportQuizTitle = document.getElementById('exportQuizTitle');
    const exportTotalQ = document.getElementById('exportTotalQuestions');
    const exportExistingQ = document.getElementById('exportExistingCount');
    const exportNewQ = document.getElementById('exportNewCount');
    const exportErrors = document.getElementById('exportErrorCount');
    const exportWarnings = document.getElementById('exportWarningCount');

    const newCount = this.workingQuestions.filter(q => q.isNew).length;
    const existingCount = this.workingQuestions.length - newCount;

    if (exportQuizTitle) exportQuizTitle.textContent = finalTitle;
    if (exportTotalQ) exportTotalQ.textContent = this.workingQuestions.length;
    if (exportExistingQ) exportExistingQ.textContent = existingCount;
    if (exportNewQ) exportNewQ.textContent = newCount;
    if (exportErrors) exportErrors.textContent = this.xmlValidation.errors.length;
    if (exportWarnings) exportWarnings.textContent = this.xmlValidation.warnings.length;

    // Check icons
    const checkTemplate = document.getElementById('checkTemplateSettings');
    const checkSchema = document.getElementById('checkXmlSchema');
    const checkSingleChoice = document.getElementById('checkSingleChoice');
    const checkRoundTrip = document.getElementById('checkRoundTrip');

    if (checkTemplate) checkTemplate.className = 'check-icon pass';
    if (checkSchema) checkSchema.className = `check-icon ${this.xmlValidation.schemaValid ? 'pass' : 'fail'}`;
    if (checkSingleChoice) checkSingleChoice.className = `check-icon ${this.xmlValidation.singleChoiceValid ? 'pass' : 'fail'}`;
    if (checkRoundTrip) checkRoundTrip.className = `check-icon ${this.xmlValidation.roundTripValid ? 'pass' : 'fail'}`;

    const btnDownload = document.getElementById('btnDownloadXml');
    if (btnDownload) {
      btnDownload.disabled = !this.xmlValidation.valid;
    }
  }

  renderXmlPreview() {
    const viewer = document.getElementById('xmlPreviewViewer');
    if (!viewer) return;

    if (!this.generatedXml) {
      viewer.textContent = '<!-- XML output will appear here -->';
      return;
    }

    if (this.showFullXml) {
      viewer.textContent = this.generatedXml;
    } else {
      const PREVIEW_LIMIT = 4000;
      if (this.generatedXml.length > PREVIEW_LIMIT) {
        viewer.textContent = this.generatedXml.slice(0, PREVIEW_LIMIT) + 
          `\n\n<!-- ... [Showing first 4,000 characters of ${this.generatedXml.length.toLocaleString()} bytes. Click 'Show Full XML' or 'Download XML' for full file] ... -->`;
      } else {
        viewer.textContent = this.generatedXml;
      }
    }
  }

  downloadGeneratedXml() {
    if (!this.generatedXml) return;
    const editQuizTitle = document.getElementById('editQuizTitle');
    const title = editQuizTitle?.value || this.quizModel.settings.title;
    const filename = sanitizeFilename(title);

    this.triggerDownload(this.generatedXml, filename);
    this.showToast(`Downloaded "${filename}"! Ready for manual LearnDash import.`, 'success');
  }

  copyXmlToClipboard() {
    if (!this.generatedXml) return;
    navigator.clipboard.writeText(this.generatedXml).then(() => {
      this.showToast('XML copied to clipboard!', 'success');
    }).catch(err => {
      this.showToast('Failed to copy: ' + err.message, 'error');
    });
  }

  triggerDownload(content, filename) {
    const blob = new Blob([content], { type: 'application/xml;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = '0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  escapeHtmlAttr(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}

// Bootstrap on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.learnDashApp = new LearnDashApp();
});
