# LearnDash XML Question Importer & Quiz Generator

A standalone, browser-based quiz question importer and XML generator for WordPress **LearnDash LMS** (and **WP Pro Quiz**). Operates 100% locally and offline without requiring WordPress plugins, database access, or server dependencies.

---

## 🌟 Key Features

- **🛡️ 100% Production Isolated**: Generates compliant LearnDash XML offline without connecting to or modifying your WordPress website.
- **🏷️ Flexible Question Formats**:
  - **Structured Tag Formatting**: `[question]`, `[id: ...]`, `[points: 1]`, `[A]`, `[B]`, `[C]`, `[D]`, `[answer: B]`, `[explanation]`, `[/question]`.
  - **LaTeX Style Tags**: `\question`, `\choice`, `\answer B`, `\explanation`.
  - **Natural MCQ Format**: `Q1. ... A) ... Answer: B ... Explanation: ...`.
- **🔢 Custom Question ID Numbering**: Configure custom Prefix (e.g. `F2B1MQ`), Start Number, Padding (`001`, `01`, `0001`), and Suffix (`CSD`) with real-time live preview.
- **⚡ Ultra-Fast XML Engine**: Serializes and validates question banks of 100+ questions in under 5 milliseconds with CDATA escaping (`]]]]><![CDATA[>`).
- **📄 Offline DOCX Extractor**: Extract questions directly from Microsoft Word documents using client-side `mammoth.js`.
- **🔄 Template-Preserving Exporter**: Preserves all quiz settings, time limits, single-choice parameters, and WordPress `<post_meta>` keys.
- **✅ Automated Round-Trip Test Suite**: Comprehensive 20-point validation suite ensuring XML schema integrity.

---

## 🚀 Quick Start

### 1. Launch the Application
Double-click `start.bat` on Windows, or run:
```bash
py serve.py 8000
```
Then navigate to: **[http://localhost:8000](http://localhost:8000)**

### 2. Workflow (4 Easy Stages)
1. **Stage 1 (Template)**: Select your XML template (or use the built-in reference template) with quiz settings and time limits pre-configured.
2. **Stage 2 (Questions)**: Paste questions using structured `[question]` tags or upload a `.docx` file. Customize your Question ID prefix and suffix.
3. **Stage 3 (Review & Edit)**: Interactively inspect question cards, re-number IDs, edit options, and preview formatted HTML.
4. **Stage 4 (Export & Verify)**: Review verification checks and download the production-ready `.xml` file.

### 3. Import into WordPress
In WordPress admin:
1. Go to **LearnDash LMS** &rarr; **Quizzes**.
2. Click **Import / Export**.
3. Upload the generated `.xml` file.

---

## 🧪 Running Automated Tests

Run the full 20-point test suite:
```bash
py tests/runTests.py
```

---

## 📄 License
MIT License.
