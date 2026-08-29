# Standalone LearnDash XML Question Importer
## Antigravity Product & Technical Specification

## 1. Purpose

Build a **standalone application** that solves the repetitive manual question-entry problem for a live WordPress website using LearnDash/WP Pro Quiz.

### Critical architectural constraint

**The application must NOT install a WordPress plugin, modify WordPress files, connect to the production WordPress database, or otherwise interfere with the live website.**

The application is completely independent of WordPress.

The only interaction with WordPress is:

1. The user prepares/imports questions in this application.
2. The application generates a LearnDash-compatible XML file.
3. The user manually uploads that XML into LearnDash using the existing LearnDash/WP Pro Quiz import functionality.

This separation is intentional because the WordPress website is a live production system and website stability is more important than eliminating the final manual XML upload.

---

# 2. Core Concept

The application should use an **existing LearnDash XML export as a template**.

The user already has a working LearnDash XML export:

`WpProQuiz_export_1788019126.xml`

This file is the authoritative reference for the XML format and should NOT be replaced by a guessed or simplified schema.

The central workflow is:

```text
Existing LearnDash XML
          ↓
     Read Template
          ↓
     Preserve Settings
          ↓
New Questions
(Word / Paste)
          ↓
       Parse
          ↓
      Validate
          ↓
    Review / Edit
          ↓
   Insert / Replace
      Questions
          ↓
   Generate XML
          ↓
    Validate XML
          ↓
     Download
          ↓
Manual LearnDash Import
```

---

# 3. Primary Design Principle

The application is NOT primarily an "XML generator."

It is a:

**LearnDash Question Preparation and XML Export Tool**

The XML generator is the final output component.

The most important requirement is:

> Never accidentally alter the LearnDash quiz configuration while adding or replacing questions.

Therefore, whenever an existing XML file is provided, preserve everything possible and modify only the intended question data.

---

# 4. Safety / Production Isolation

The application must be completely independent from the production WordPress website.

### It must NOT:

- Connect to WordPress database
- Connect to wp-admin automatically
- Install a WordPress plugin
- Modify WordPress files
- Modify `.htaccess`
- Modify PHP configuration
- Call WordPress REST APIs in Version 1
- Automatically publish questions to LearnDash
- Store WordPress credentials
- Require WordPress credentials

### It SHOULD:

- Work without any WordPress connection.
- Process files locally where practical.
- Generate a downloadable XML file.
- Allow the user to manually import the XML into LearnDash.

If the application fails, the production WordPress website must remain completely unaffected.

---

# 5. Main Workflow

The application should have four primary stages:

```text
1. TEMPLATE
2. QUESTIONS
3. REVIEW
4. EXPORT
```

A progress indicator should show the current stage.

Example:

```text
[1 Template] → [2 Questions] → [3 Review] → [4 Export]
```

---

# 6. Stage 1 — Select Template

The first screen should ask:

### "Choose a LearnDash XML Template"

Options:

### Option A — Upload Existing XML

Recommended.

User uploads an existing LearnDash XML export.

The application parses it and extracts:

- Quiz title
- Quiz settings
- Existing questions
- Question IDs
- Question settings
- Answers
- Feedback
- Categories
- Post metadata

### Option B — Start From Reference Template

Allow the supplied reference XML to be used as the initial template.

The application should ship with the supplied XML template during development/testing.

Do not assume that the supplied quiz title, IDs or WordPress metadata should be used permanently for every new quiz.

---

# 7. Template Inspection

After uploading the XML, display:

```text
Template Loaded ✓

Quiz:
Book 1 Section 1 Reading 01 - 07 | Test Round 2

Existing Questions:
50

Quiz Settings:
Time Limit: 1800 seconds
Questions per page: 2
Show Points: Yes
Question Randomization: No
Answer Randomization: No
```

The exact settings should be read from the XML rather than hard-coded.

The reference file contains quiz-level configuration such as time limit, points display, question randomization, answer randomization and quiz mode. Preserve these settings when using an existing XML template.

---

# 8. Stage 2 — Add New Questions

Provide two input methods.

## Method A — Paste Questions

Large text editor.

Example:

```text
Q1. A portfolio manager enters into a futures contract...

A) ...
B) ...
C) ...
D) ...

Answer: B

Explanation: ...
```

Button:

**Parse Questions**

---

## Method B — Upload Word Document

Accept:

```text
.docx
```

Button:

**Upload Word File**

Then:

**Parse Questions**

---

# 9. Supported Question Format

The primary supported format should be:

```text
Q1. Question text

A) Option A
B) Option B
C) Option C
D) Option D

Answer: B

Explanation: Explanation text.
```

The parser should also recognize:

```text
Q1.
Q1)
Question 1.
Question 1:
```

Answer choices:

```text
A)
A.
A:
(A)
```

Correct answer:

```text
Answer: B
Correct Answer: B
Correct answer: B
Answer: B) Option text
```

Explanation:

```text
Explanation:
Solution:
Rationale:
```

The parser must support explanations spanning multiple paragraphs.

---

# 10. Question Parser

Do NOT implement the parser as one giant regular expression.

Use a deterministic parsing pipeline/state machine.

Conceptually:

```text
Raw Input
   ↓
Normalize whitespace
   ↓
Detect question boundaries
   ↓
Detect answer choices
   ↓
Detect correct answer
   ↓
Detect explanation
   ↓
Create Question Object
   ↓
Validate
```

Possible parser states:

```text
QUESTION
ANSWER_CHOICES
ANSWER
EXPLANATION
```

Question boundaries should primarily be identified using question markers such as:

```text
Q1.
Q2.
Q3.
```

Do not rely on blank lines.

---

# 11. Internal Question Model

Never directly generate XML from raw input.

Convert everything to an internal data structure first.

Example:

```json
{
  "id": "Q001",
  "questionText": "<p>Question text...</p>",
  "answers": [
    {
      "label": "A",
      "text": "Option A",
      "correct": false,
      "points": 0
    },
    {
      "label": "B",
      "text": "Option B",
      "correct": true,
      "points": 1
    },
    {
      "label": "C",
      "text": "Option C",
      "correct": false,
      "points": 0
    },
    {
      "label": "D",
      "text": "Option D",
      "correct": false,
      "points": 0
    }
  ],
  "explanation": "<p>Explanation...</p>",
  "points": 1,
  "answerType": "single"
}
```

The XML layer must consume this model.

---

# 12. Existing Question IDs

If the user supplies a question ID, preserve it.

For example:

```text
F2B1MQ02CSD
```

The reference XML uses IDs in this style inside `<title>`.

If no ID is supplied, generate:

```text
Q001
Q002
Q003
```

Provide a setting:

**Question ID Mode**

- Preserve supplied IDs
- Generate new IDs

Default:

**Preserve supplied IDs**

Always validate uniqueness.

---

# 13. Stage 3 — Review

This is a critical part of the application.

After parsing, show a summary:

```text
Questions detected: 50

Valid: 48
Warnings: 2
Errors: 0
```

Then show the questions.

---

# 14. Review Interface

Each question should appear as an editable card.

Example:

```text
┌────────────────────────────────────────────┐
│ Q001                         ✓ Valid        │
│                                            │
│ Question                                   │
│ ┌────────────────────────────────────────┐ │
│ │ A portfolio manager...                 │ │
│ └────────────────────────────────────────┘ │
│                                            │
│ A) [Option A............................] │
│ B) [Option B............................] │
│ C) [Option C............................] │
│ D) [Option D............................] │
│                                            │
│ Correct Answer: [ B ▼ ]                   │
│ Points: [ 1 ]                              │
│                                            │
│ Explanation                               │
│ ┌────────────────────────────────────────┐ │
│ │ Explanation...                         │ │
│ └────────────────────────────────────────┘ │
│                                            │
│ [Duplicate] [Delete]                      │
└────────────────────────────────────────────┘
```

Allow:

- Edit question
- Edit options
- Change correct answer
- Edit explanation
- Change points
- Add option
- Delete option
- Delete question
- Duplicate question
- Reorder questions

---

# 15. Validation

Validation must occur before export.

## Errors

Block export if:

- Question text is missing.
- No answers exist.
- Fewer than two answers exist.
- No correct answer is identified.
- More than one correct answer exists for `single`.
- Question ID is duplicated.
- XML serialization fails.
- Template structure is invalid.

## Warnings

Do not necessarily block export for:

- Missing explanation.
- Only three answer choices.
- Question ID generated automatically.
- Unsupported/complex HTML.
- Unrecognized text.
- Empty optional feedback.

Warnings should be visible.

---

# 16. Error Navigation

If 50 questions are imported and 2 have errors:

```text
50 questions detected

✓ 48 valid
⚠ 2 require attention
```

Show:

```text
Q014 — Correct answer not detected
Q019 — Only 3 answer choices detected
```

Clicking an error should jump directly to that question.

---

# 17. Existing Template Question Handling

When the user uploads an existing XML, there should be an explicit choice:

### What should happen to existing questions?

Options:

1. **Replace all existing questions**
2. **Keep existing questions and append new questions**
3. **Keep existing questions and insert new questions at selected position**

Default:

**Keep existing questions and append new questions**

This prevents accidental deletion of an existing question bank.

---

# 18. Duplicate Detection

When adding questions to an existing XML, check for:

### Duplicate IDs

Example:

```text
F2B1MQ02CSD
```

### Optional duplicate question text

Warn if two questions have highly similar/identical question text.

Do NOT automatically delete duplicates.

Show:

```text
Possible duplicate detected:
Q021
Q087

[Review]
```

The user decides what to do.

---

# 19. Stage 4 — XML Generation

The XML generator must be template-based.

Do NOT create an entirely new XML document from scratch when an existing template is available.

Instead:

```text
Existing XML
     ↓
Parse
     ↓
Preserve XML structure/settings
     ↓
Replace or append questions
     ↓
Serialize
```

This is one of the most important architectural requirements.

---

# 20. Reference XML Structure

The supplied reference XML has:

```xml
<wpProQuiz>
    <header ... />
    <data>
        <quiz>
            <title ... />
            <text ... />
            <resultText ... />
            ...
            <questions>
                <question ...>
                    ...
                </question>
            </questions>
            <post>...</post>
            <post_meta>...</post_meta>
            ...
        </quiz>
    </data>
</wpProQuiz>
```

The reference file contains:

```xml
<question answerType="single">
```

and question fields including:

```xml
<title>
<points>
<questionText>
<correctMsg>
<incorrectMsg>
<tipMsg>
<category>
<answers>
```

The answers contain:

```xml
<answer points="..." correct="...">
    <answerText html="false">
    <stortText html="false">
```

These structures must be preserved.

---

# 21. Question XML Mapping

For each internal question:

```xml
<question answerType="single">
```

ID:

```xml
<title><![CDATA[Q001]]></title>
```

Points:

```xml
<points>1</points>
```

Question text:

```xml
<questionText><![CDATA[
<p>Question text...</p>
]]></questionText>
```

Answers:

```xml
<answers>
    <answer points="0" correct="false">
        <answerText html="false"><![CDATA[Option A]]></answerText>
        <stortText html="false"><![CDATA[]]></stortText>
    </answer>

    <answer points="1" correct="true">
        <answerText html="false"><![CDATA[Option B]]></answerText>
        <stortText html="false"><![CDATA[]]></stortText>
    </answer>
</answers>
```

The `correct` attribute must match the selected correct answer.

---

# 22. Correct and Incorrect Feedback

The reference XML contains both:

```xml
<correctMsg>
<incorrectMsg>
```

and the sample export duplicates the correct answer/explanation in both fields.

Follow the template behavior.

For example:

```xml
<correctMsg><![CDATA[
<p>Correct Answer: B) Option B</p>
<p>Explanation: ...</p>
]]></correctMsg>

<incorrectMsg><![CDATA[
<p>Correct Answer: B) Option B</p>
<p>Explanation: ...</p>
]]></incorrectMsg>
```

If no explanation is supplied, do not invent content.

---

# 23. Template Preservation Rules

When modifying an existing XML:

### Preserve exactly where possible:

- Header attributes
- Quiz title attributes
- Quiz settings
- Time limit
- Quiz mode
- Randomization settings
- Display settings
- Result settings
- Toplist settings
- Forms
- Post metadata
- WordPress/LearnDash metadata
- Other unknown fields

### Modify only what the user requested:

- Questions
- Question-related content
- Question IDs
- Answers
- Feedback associated with those questions

Do not normalize or rewrite unrelated XML.

---

# 24. XML Serializer

Use a proper XML library.

Do NOT concatenate XML strings manually.

Requirements:

- Correct XML encoding
- Proper element creation
- Proper attributes
- CDATA handling
- Unicode support
- Valid escaping
- Preservation of XML structure

Special attention must be given to:

```text
]]>
```

inside user text because it cannot appear unescaped inside a CDATA block.

---

# 25. HTML in Question Text

The reference XML stores HTML inside CDATA.

Support at least:

```html
<p>
<br>
<strong>
<b>
<em>
<i>
<u>
<sub>
<sup>
<ul>
<ol>
<li>
```

Preserve useful formatting from Word where practical.

For answer choices, default to plain text unless HTML is explicitly present.

---

# 26. DOCX Processing

When a Word file is uploaded:

1. Read paragraphs.
2. Preserve paragraph boundaries.
3. Identify question markers.
4. Identify answer markers.
5. Identify Answer/Correct Answer.
6. Identify Explanation/Solution/Rationale.
7. Convert basic formatting to HTML if practical.

Do not assume that visual Word formatting alone defines structure.

Text markers should be the primary parsing mechanism.

If tables are present and cannot be reliably interpreted:

```text
Warning:
A table in the Word document could not be confidently converted.
Please review the affected question.
```

Never silently discard important question content.

---

# 27. Quiz Settings

When using an existing XML template:

**Existing settings should be preserved automatically.**

Optionally provide:

```text
Quiz Settings

☑ Preserve template settings

Quiz Title: [....................]
Time Limit: [1800]
Questions per page: [2]
Randomize Questions: [No]
Randomize Answers: [No]
Show Points: [Yes]
Passing Percentage: [50]
```

If the user edits a setting, only that setting should be changed.

---

# 28. Export Preview

Before download, show:

```text
Export Ready

Quiz: FRM Part I — Derivatives
Questions: 75

Existing Questions: 50
New Questions: 25

Errors: 0
Warnings: 1

Template Settings: Preserved ✓
XML Structure: Valid ✓
Round-trip Validation: Passed ✓

[Generate XML]
```

---

# 29. XML Verification

After generating XML:

### Step 1
Parse the generated XML.

### Step 2
Validate:

```text
<wpProQuiz>
    <data>
        <quiz>
            <questions>
```

### Step 3
Validate every question.

Every question should have:

- title
- points
- questionText
- correctMsg
- incorrectMsg
- answers

### Step 4

For `answerType="single"`:

Exactly one answer must have:

```xml
correct="true"
```

### Step 5

Validate that the selected correct answer has the appropriate point value.

### Step 6

Perform a round-trip:

```text
Generated XML
      ↓
Parse XML
      ↓
Question Model
```

Confirm that questions and answers remain intact.

Only then enable:

**Download XML**

---

# 30. File Naming

Generated filename:

```text
LearnDash_Quiz_<QuizTitle>.xml
```

Example:

```text
LearnDash_Quiz_FRM_Part_1_Derivatives.xml
```

Sanitize invalid filename characters.

---

# 31. Optional Backup

Before exporting modified questions, allow:

**Download Backup of Original XML**

This is particularly useful when the user is modifying an existing quiz template.

The original XML must never be overwritten automatically.

---

# 32. Local-First Architecture

Preferred implementation:

```text
Frontend
   ↓
Parser
   ↓
Question Model
   ↓
Validator
   ↓
XML Engine
   ↓
Download
```

If possible, process `.docx` and XML entirely locally in the browser or local application.

No question content should need to leave the user's machine.

If a server component is technically required, clearly separate it from WordPress and do not store question content permanently unless explicitly required.

---

# 33. Recommended Project Structure

```text
src/
│
├── components/
│   ├── TemplateUploader
│   ├── PasteEditor
│   ├── DocxUploader
│   ├── QuestionList
│   ├── QuestionEditor
│   ├── ValidationPanel
│   ├── QuizSettings
│   └── ExportPanel
│
├── parsers/
│   ├── pasteParser
│   ├── docxParser
│   └── learnDashXmlParser
│
├── models/
│   ├── questionModel
│   └── quizModel
│
├── validators/
│   ├── questionValidator
│   └── xmlValidator
│
├── exporters/
│   └── learnDashXmlExporter
│
├── services/
│   ├── templateService
│   ├── duplicateDetection
│   └── cdataService
│
└── tests/
    ├── parserTests
    ├── xmlTests
    └── roundTripTests
```

Keep these concerns separate.

---

# 34. Version 1 Scope

Version 1 should contain:

### Required

- Existing XML template upload
- Reference XML template
- Paste questions
- DOCX upload
- Question parser
- Question validation
- Review/edit interface
- Append questions
- Replace questions
- Question reordering
- Correct-answer editing
- Explanation editing
- XML generation
- XML validation
- Round-trip validation
- XML download

### Do NOT include initially

- WordPress API
- WordPress plugin
- Automatic WordPress login
- Automatic publishing
- AI question generation
- AI rewriting
- Complex analytics
- User accounts
- Cloud synchronization

Keep Version 1 focused.

---

# 35. Future Features

Once Version 1 is reliable, possible additions include:

### Question Bank

Store questions locally with:

- Subject
- Chapter
- Reading
- Learning Outcome
- Difficulty
- Question ID
- Tags

### Mock Exam Builder

Example:

```text
FRM Part I
Derivatives
50 questions
Difficulty:
20 Easy
20 Medium
10 Hard
```

Then:

**Generate LearnDash XML**

### AI Repair

For questions that cannot be parsed:

```text
Q17 could not be parsed.

[Repair with AI]
```

AI returns a structured question.

The user must approve the result.

AI must never silently modify questions.

### Multiple Export Formats

Eventually:

```text
LearnDash XML
CSV
Excel
JSON
PDF
```

---

# 36. Important Development Rule

Do not optimize for the easiest coding approach.

Optimize for:

**Reliability of LearnDash import.**

The application should never produce an XML file that looks correct but silently loses:

- questions
- answers
- correct-answer status
- explanations
- quiz settings
- metadata

---

# 37. Testing

Create tests for:

### Test 1
One standard 4-option MCQ.

### Test 2
50 MCQs pasted at once.

### Test 3
100+ MCQs pasted at once.

### Test 4
DOCX with 50+ questions.

### Test 5
Question with multiple paragraphs.

### Test 6
Explanation with multiple paragraphs.

### Test 7
Question containing:

```text
VaR = $10 million × 2.33 × 15%
```

### Test 8
HTML question content.

### Test 9
Unicode characters.

### Test 10
Question containing:

```text
&
<
>
"
'
```

### Test 11
Missing answer.

### Test 12
Missing correct answer.

### Test 13
Duplicate question ID.

### Test 14
Question without ID.

### Test 15
Three answer choices.

### Test 16
Existing XML + append 10 questions.

### Test 17
Existing XML + replace all questions.

### Test 18
Existing XML + insert questions.

### Test 19
Existing XML → import → export without changes.

The last test is particularly important.

If:

```text
Existing XML
    ↓
Application
    ↓
Export
```

is performed without changing anything, the resulting XML should remain structurally compatible and preserve the relevant quiz configuration.

---

# 38. Reference XML

The supplied file:

```text
WpProQuiz_export_1788019126.xml
```

must be inspected in full before implementation.

It is the primary reference for the XML structure.

The reference export includes a `<wpProQuiz>` root, a `<header>` containing version-related attributes, `<data><quiz>`, quiz settings, `<questions>`, and question/answer structures.

The question structure includes:

```text
question
 ├── title
 ├── points
 ├── questionText
 ├── correctMsg
 ├── incorrectMsg
 ├── tipMsg
 ├── category
 └── answers
      └── answer
           ├── answerText
           └── stortText
```

It also contains `<post>` and multiple `<post_meta>` elements containing WordPress/LearnDash-related metadata.

These fields should be preserved when modifying an existing XML.

---

# 39. Antigravity Initial Instruction

Use the following instruction when starting the project:

---

I want you to build a standalone LearnDash XML Question Importer based on the attached specification and reference XML.

The application MUST NOT connect to or modify my WordPress website.

My WordPress website is a live production website, so production isolation is a hard requirement.

The application must work independently and only produce a LearnDash XML file that I will manually upload into WordPress.

I have provided:

1. `LearnDash_XML_Generator_Antigravity_Spec.md`
2. `WpProQuiz_export_1788019126.xml`

The XML file is an actual LearnDash/WP Pro Quiz export and is the authoritative reference for the XML structure.

Before coding:

1. Inspect the complete reference XML.
2. Identify all major XML structures and attributes.
3. Determine which fields are quiz-level settings.
4. Determine which fields are question-level fields.
5. Determine which fields belong to WordPress/LearnDash post metadata.
6. Explain how you will preserve the existing template.
7. Explain the internal Question Model.
8. Explain the paste parser.
9. Explain the DOCX parser.
10. Explain the XML serializer.
11. Explain XML validation and round-trip testing.

Do not guess the LearnDash XML structure.

Do not simplify the reference XML.

The safest architecture is:

Existing XML
→ Parse Template
→ Preserve Template
→ Parse New Questions
→ Validate
→ Review
→ Append/Replace Questions
→ Serialize XML
→ Validate Again
→ Download

The application must not modify unrelated quiz settings or metadata.

Build the project incrementally.

First build and test the XML parsing/template engine.

Then build the paste parser.

Then build the review interface.

Then build DOCX import.

Then build export and round-trip validation.

Do not add WordPress API integration or a WordPress plugin.

Do not add AI functionality in Version 1.

The primary acceptance test is:

I can take 50 questions in the format I normally prepare, paste them or upload a Word document, review them, and produce an XML file that can be imported into my LearnDash installation without manually entering the questions.

---

# 40. Definition of Done

The application is complete when:

- It runs independently of WordPress.
- No WordPress plugin is required.
- No WordPress credentials are required.
- Existing LearnDash XML can be uploaded as a template.
- Quiz settings are preserved.
- Existing questions can be retained, replaced or appended.
- Questions can be pasted directly.
- DOCX files can be imported.
- Questions are parsed accurately.
- Correct answers are mapped accurately.
- Explanations are preserved.
- Basic HTML is preserved.
- Validation catches malformed questions.
- The user can edit parsed questions.
- Duplicate IDs are detected.
- XML is generated using the reference structure.
- XML syntax is validated.
- Generated XML can be parsed back successfully.
- Original template files are never overwritten.
- The final XML can be downloaded.
- The production WordPress website remains completely untouched.

# 41. Final Product Principle

The application should follow this philosophy:

> **Prepare safely outside WordPress. Validate everything before export. Use the user's existing LearnDash XML as the template. Make the final WordPress interaction a simple manual XML import.**

Reliability and data integrity are more important than eliminating the final manual upload step.
