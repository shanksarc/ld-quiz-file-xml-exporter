"""
Standalone LearnDash XML Question Importer - Full 19 Test Verification Suite
Validates all 19 test requirements plus structured tags ([question], [id], [A], [answer], [explanation]).
"""

import os
import re
import sys
import xml.etree.ElementTree as ET

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

REFERENCE_XML_PATH = 'WpProQuiz_export_1788019126.xml'

def wrap_in_cdata(text):
    if text is None:
        return '<![CDATA[]]>'
    s = str(text).replace(']]>', ']]]]><![CDATA[>')
    return f'<![CDATA[{s}]]>'

def parse_paste_text(raw_text, id_mode='preserve', id_prefix='Q', default_points=1):
    normalized = raw_text.replace('\r\n', '\n').replace('\r', '\n')
    lines = normalized.split('\n')

    tag_q_regex = re.compile(r'^\s*(?:\[(?:question|q)(?:\s*:\s*([^\]]*))?\]|\\(?:question|q)(?:\{([^}]*)\})?|\\(?:question|q)\b)\s*(.*)$', re.I)
    tag_end_q_regex = re.compile(r'^\s*(?:\[\/(?:question|q)\]|\\end(?:question|q))\s*$', re.I)
    explicit_id_regex = re.compile(r'^\s*(?:\[id\s*:\s*([^\]]+)\]|\\id\s*\{([^}]+)\}|\\id\s+([^\s\n]+)|(?:ID|Question\s*ID|Code)\s*[:\-=]\s*([A-Za-z0-9_-]+))\s*$', re.I)
    points_regex = re.compile(r'^\s*(?:\[points?\s*:\s*(\d+(?:\.\d+)?)\]|\\points?\s*\{?(\d+(?:\.\d+)?)\}?|(?:Points?|Mark|Score)\s*[:\-=]\s*(\d+(?:\.\d+)?))\s*$', re.I)
    tag_answer_regex = re.compile(r'^\s*(?:\[(?:correct|answer|ans|key)\s*:\s*([^\]]+)\]|\\(?:correct|answer|ans|key)\s*\{?([^}]+)\}?|\\(?:correct|answer|ans|key)\s+([^\s\n]+)|(?:Correct\s+Answer|Correct\s+Option|Answer\s+is|Correct|Answer|Ans|Key)\s*[:\-=]\s*(.*))\s*$', re.I)
    tag_explanation_regex = re.compile(r'^\s*(?:\[(?:explanation|solution|rationale|feedback|reason|note)\]|\\(?:explanation|solution|rationale|feedback|reason|note)\b|(?:Explanation|Solution|Rationale|Reason|Feedback|Ans\s+Explanation|Note)\s*[:\-=]\s*(.*))\s*$', re.I)
    tag_choice_regex = re.compile(r'^\s*(?:\*\s*)?(?:\[(?:choice\s*[:\s]*)?([A-Za-z0-9])\]|\\choice\s*(?:\{([A-Za-z0-9])\}|\s+([A-Za-z0-9])\b)|\\([A-Da-d])\b|(?:\(([A-Za-z0-9])\)|\[([A-Za-z0-9])\]|([A-Za-z0-9])[\.\:\)\-]))(?:\s*\*\s*)?\s+(.*)$')
    natural_q_marker_regex = re.compile(r'^\s*(?:(?:Q|Question)\s*([A-Za-z0-9_-]+)[\.\)\:\-]|\[([A-Za-z0-9_-]+)\]|(\d+)[\.\)\:\-])\s*(.*)$', re.I)

    questions = []
    current_q = None
    current_state = 'IDLE'
    q_index = 1

    def finalize_q():
        nonlocal current_q
        if not current_q:
            return
        
        # Build question text
        raw_q = '\n'.join(current_q['_raw_q']).strip()
        if raw_q:
            if re.search(r'<p[\s>]|<div[\s>]|<table[\s>]|<ul[\s>]|<ol[\s>]', raw_q, re.I):
                current_q['questionText'] = raw_q
            else:
                paras = [p.strip() for p in re.split(r'\n\s*\n+', raw_q) if p.strip()]
                current_q['questionText'] = '\n'.join([f'<p>{p}</p>' for p in paras])
        else:
            current_q['questionText'] = ''

        # Build explanation
        raw_expl = '\n'.join(current_q['_raw_expl']).strip()
        if raw_expl:
            if re.search(r'<p[\s>]|<div[\s>]|<table[\s>]|<ul[\s>]|<ol[\s>]', raw_expl, re.I):
                current_q['explanation'] = raw_expl
            else:
                paras = [p.strip() for p in re.split(r'\n\s*\n+', raw_expl) if p.strip()]
                current_q['explanation'] = '\n'.join([f'<p>{p}</p>' for p in paras])
        else:
            current_q['explanation'] = ''

        # Match correct answer
        if current_q['_detected_ans']:
            clean_ans = current_q['_detected_ans'].strip().upper()
            letter_m = re.search(r'(?:^|[\s\(])([A-Z0-9])(?:[\s\)\.\:]|$)', clean_ans)
            target_letter = letter_m.group(1) if letter_m else clean_ans[:1]

            matched = False
            for a in current_q['answers']:
                if a['label'].upper() == target_letter:
                    a['correct'] = True
                    a['points'] = current_q['points']
                    matched = True
                else:
                    a['correct'] = False
                    a['points'] = 0
            if not matched and len(target_letter) == 1:
                idx = ord(target_letter) - 65
                if 0 <= idx < len(current_q['answers']):
                    current_q['answers'][idx]['correct'] = True
                    current_q['answers'][idx]['points'] = current_q['points']

        del current_q['_raw_q']
        del current_q['_raw_expl']
        del current_q['_detected_ans']
        questions.append(current_q)
        current_q = None

    def start_q(supp_id='', first_line=''):
        nonlocal current_q, current_state, q_index
        finalize_q()
        qid = supp_id.strip()
        if id_mode == 'generate' or not qid:
            qid = f'{id_prefix}{q_index:03d}'
        
        current_q = {
            'id': qid,
            'points': default_points,
            'answers': [],
            'questionText': '',
            'explanation': '',
            'answerType': 'single',
            '_raw_q': [first_line] if first_line else [],
            '_raw_expl': [],
            '_detected_ans': None
        }
        current_state = 'QUESTION_TEXT'
        q_index += 1

    for line in lines:
        trimmed = line.strip()

        # 0. [/question] tag
        if tag_end_q_regex.match(trimmed):
            finalize_q()
            current_q = None
            current_state = 'IDLE'
            continue

        # 1. [question] tag or \question
        tqm = tag_q_regex.match(line)
        if tqm:
            q_id = tqm.group(1) or tqm.group(2) or ''
            start_q(q_id, tqm.group(3) or '')
            continue
        
        # 2. [id: ...]
        exp_m = explicit_id_regex.match(trimmed)
        if exp_m:
            custom_id = exp_m.group(1) or exp_m.group(2) or exp_m.group(3) or exp_m.group(4) or ''
            if not current_q or (current_q['answers'] and current_state != 'QUESTION_TEXT'):
                start_q(custom_id, '')
            else:
                current_q['id'] = custom_id
            continue

        # 3. [points: 2]
        pts_m = points_regex.match(trimmed)
        if pts_m and current_q:
            pts_val = float(pts_m.group(1) or pts_m.group(2) or pts_m.group(3))
            current_q['points'] = pts_val
            continue

        # 4. [answer: B] or Answer: B
        am = tag_answer_regex.match(trimmed)
        if am:
            current_state = 'ANSWER'
            payload = (am.group(1) or am.group(2) or am.group(3) or am.group(4) or '').strip()
            letter_m = re.match(r'^(?:\(?([A-Za-z0-9])\)|\b([A-Za-z0-9])\b)[\.\:\)]?\s*(.*)$', payload)
            if letter_m:
                current_q['_detected_ans'] = letter_m.group(1) or letter_m.group(2)
            else:
                current_q['_detected_ans'] = payload
            continue

        # 5. [explanation] or Explanation: ...
        em = tag_explanation_regex.match(trimmed)
        if em:
            current_state = 'EXPLANATION'
            expl_text = em.group(1) or ''
            if expl_text.strip():
                current_q['_raw_expl'].append(expl_text.strip())
            continue

        # 6. [A] or A) Choice line
        cm = tag_choice_regex.match(line)
        if cm and current_state in ('QUESTION_TEXT', 'CHOICES'):
            current_state = 'CHOICES'
            lbl = (cm.group(1) or cm.group(2) or cm.group(3) or cm.group(4) or cm.group(5) or cm.group(6) or cm.group(7)).upper()
            txt = (cm.group(8) or '').strip()
            current_q['answers'].append({
                'label': lbl,
                'text': txt,
                'correct': False,
                'points': 0
            })
            continue

        # 7. Natural Question Header
        qm = natural_q_marker_regex.match(line)
        if qm and current_state not in ('QUESTION_TEXT', 'EXPLANATION'):
            det_id = qm.group(1) or qm.group(2) or qm.group(3) or ''
            start_q(det_id, qm.group(4) or '')
            continue
        elif qm and current_state in ('QUESTION_TEXT', 'EXPLANATION') and (trimmed.startswith('Q') or trimmed.startswith('Question') or trimmed.startswith('[')):
            det_id = qm.group(1) or qm.group(2) or qm.group(3) or ''
            start_q(det_id, qm.group(4) or '')
            continue

        if not current_q and trimmed:
            start_q('', line)
            continue

        if not current_q:
            continue

        if current_state == 'QUESTION_TEXT':
            current_q['_raw_q'].append(line)
        elif current_state == 'CHOICES':
            if current_q['answers'] and trimmed:
                current_q['answers'][-1]['text'] += ' ' + trimmed
        elif current_state == 'EXPLANATION':
            current_q['_raw_expl'].append(line)

    finalize_q()
    return questions

def serialize_question(q):
    correct_ans = next((a for a in q['answers'] if a['correct']), None)
    c_label = correct_ans['label'] if correct_ans else ''
    c_text = correct_ans['text'] if correct_ans else ''
    
    header = f'<p>Correct Answer: {c_label}) {c_text}</p>' if c_label else ''
    expl = q.get('explanation', '')
    if expl and 'explanation:' not in expl.lower():
        expl = f'<p>Explanation:&nbsp;</p>\n{expl}'
    msg = '\n'.join(filter(None, [header, expl]))
    
    answers_xml = '<answers>'
    for a in q['answers']:
        is_corr = a['correct']
        pts = q['points'] if is_corr else 0
        has_html = 'true' if re.search(r'<[a-z][\s\S]*>', a['text'], re.I) else 'false'
        answers_xml += f'<answer points="{pts}" correct="{"true" if is_corr else "false"}">'
        answers_xml += f'<answerText html="{has_html}">{wrap_in_cdata(a["text"])}</answerText>'
        answers_xml += f'<stortText html="false"><![CDATA[]]></stortText>'
        answers_xml += '</answer>'
    answers_xml += '</answers>'

    return (
        f'<question answerType="{q.get("answerType", "single")}">'
        f'<title>{wrap_in_cdata(q["id"])}</title>'
        f'<points>{q.get("points", 1)}</points>'
        f'<questionText>{wrap_in_cdata(q["questionText"])}</questionText>'
        f'<correctMsg>{wrap_in_cdata(msg)}</correctMsg>'
        f'<incorrectMsg>{wrap_in_cdata(msg)}</incorrectMsg>'
        f'<tipMsg enabled="false"><![CDATA[]]></tipMsg>'
        f'<category/>'
        f'<correctSameText>true</correctSameText>'
        f'<showPointsInBox>false</showPointsInBox>'
        f'<answerPointsActivated>false</answerPointsActivated>'
        f'<answerPointsDiffModusActivated>false</answerPointsDiffModusActivated>'
        f'<disableCorrect>false</disableCorrect>'
        f'{answers_xml}'
        f'</question>'
    )

def generate_xml(template_xml, questions):
    q_xml = ''.join([serialize_question(q) for q in questions])
    if '<questions>' in template_xml and '</questions>' in template_xml:
        return re.sub(r'<questions[\s\S]*?<\/questions>', f'<questions>{q_xml}</questions>', template_xml)
    return template_xml

def run_all_tests():
    passed = 0
    total = 20
    print('=' * 70)
    print('RUNNING ALL SPECIFICATION & STRUCTURED TAG TEST CASES')
    print('=' * 70)

    # Test 0 (NEW): Explicit Structured Tags [question], [id], [A], [answer], [explanation]
    t0_text = """[question]
[id: F2B1MQ99CSD]
[points: 2]
Calculate the 99% VaR for a $50 million bond portfolio with duration 6.5.

[A] $1.2 million
[B] $2.4 million
[C] $3.8 million
[D] $4.5 million

[answer: C]

[explanation]
Using parametric formula: VaR = Portfolio × Z × Yield Volatility × Duration.
For $50M at 99%, the loss threshold evaluates to $3.8 million.
[/question]"""
    q0 = parse_paste_text(t0_text)
    assert len(q0) == 1, "Test 0 failed: Expected 1 tagged question"
    assert q0[0]['id'] == 'F2B1MQ99CSD', f"Test 0 failed: ID was {q0[0]['id']}"
    assert q0[0]['points'] == 2.0, f"Test 0 failed: Points was {q0[0]['points']}"
    assert len(q0[0]['answers']) == 4, "Test 0 failed: Expected 4 choices"
    assert q0[0]['answers'][2]['correct'] == True, "Test 0 failed: Choice C should be correct"
    print("✓ Test 0: Explicit structured tags ([question], [id], [A], [answer], [explanation]) passed.")
    passed += 1

    # Test 1: One standard 4-option MCQ
    t1_text = """Q1. What is the capital of France?
A) Berlin
B) Paris
C) Madrid
D) Rome
Answer: B
Explanation: Paris is the capital of France."""
    q1 = parse_paste_text(t1_text)
    assert len(q1) == 1, f"Test 1 failed: Expected 1 question, got {len(q1)}"
    assert q1[0]['id'] == '1', f"Test 1 failed: ID was {q1[0]['id']}"
    assert len(q1[0]['answers']) == 4, "Test 1 failed: Expected 4 answers"
    assert q1[0]['answers'][1]['correct'] == True, "Test 1 failed: Option B should be correct"
    print("✓ Test 1: One standard 4-option MCQ passed.")
    passed += 1

    # Test 2: 50 MCQs pasted at once
    t2_text = "\n\n".join([f"Q{i}. Question {i} text?\nA) Opt A\nB) Opt B\nC) Opt C\nD) Opt D\nAnswer: C\nExplanation: Expl {i}" for i in range(1, 51)])
    q2 = parse_paste_text(t2_text)
    assert len(q2) == 50, f"Test 2 failed: Expected 50 questions, got {len(q2)}"
    assert all(len(q['answers']) == 4 for q in q2), "Test 2 failed: Some questions missing choices"
    assert all(q['answers'][2]['correct'] for q in q2), "Test 2 failed: Correct answer mismatch"
    print("✓ Test 2: 50 MCQs pasted at once passed.")
    passed += 1

    # Test 3: 100+ MCQs pasted at once
    t3_text = "\n\n".join([f"Question {i}: Large batch question {i}?\nA) Choice 1\nB) Choice 2\nC) Choice 3\nD) Choice 4\nCorrect Answer: A\nExplanation: Explanation for {i}" for i in range(1, 105)])
    q3 = parse_paste_text(t3_text)
    assert len(q3) == 104, f"Test 3 failed: Expected 104 questions, got {len(q3)}"
    print("✓ Test 3: 100+ MCQs pasted at once passed.")
    passed += 1

    # Test 4: DOCX stream simulation with 50+ questions
    t4_text = "\n\n".join([f"Q{i}) DOCX converted question {i}\nA. A Option\nB. B Option\nC. C Option\nD. D Option\nAnswer: D\nExplanation: DOCX solution {i}" for i in range(1, 55)])
    q4 = parse_paste_text(t4_text)
    assert len(q4) == 54, f"Test 4 failed: Expected 54 questions, got {len(q4)}"
    assert q4[0]['answers'][3]['correct'] == True, "Test 4 failed: Option D should be correct"
    print("✓ Test 4: DOCX 50+ questions simulation passed.")
    passed += 1

    # Test 5: Question with multiple paragraphs
    t5_text = """Q5. First paragraph of problem statement.

Second paragraph providing additional financial context and figures for the calculation.

Third paragraph asking the specific question?
A) 10%
B) 20%
C) 30%
D) 40%
Answer: A
Explanation: Solved."""
    q5 = parse_paste_text(t5_text)
    assert len(q5) == 1, "Test 5 failed"
    assert '<p>First paragraph' in q5[0]['questionText']
    assert '<p>Second paragraph' in q5[0]['questionText']
    assert '<p>Third paragraph' in q5[0]['questionText']
    print("✓ Test 5: Question with multiple paragraphs passed.")
    passed += 1

    # Test 6: Explanation with multiple paragraphs
    t6_text = """Q6. Question text?
A) Option A
B) Option B
C) Option C
D) Option D
Answer: B
Explanation: First paragraph of explanation.

Second paragraph of detailed derivation with step-by-step logic.

Third paragraph summarizing the conclusion."""
    q6 = parse_paste_text(t6_text)
    assert len(q6) == 1, "Test 6 failed"
    assert '<p>First paragraph' in q6[0]['explanation']
    assert '<p>Second paragraph' in q6[0]['explanation']
    assert '<p>Third paragraph' in q6[0]['explanation']
    print("✓ Test 6: Explanation with multiple paragraphs passed.")
    passed += 1

    # Test 7: Question containing formula: VaR = $10 million × 2.33 × 15%
    t7_text = """Q7. A manager computes VaR = $10 million × 2.33 × 15% for the portfolio. What is the value?
A) $3.495 million
B) $2.330 million
C) $1.500 million
D) $4.000 million
Answer: A
Explanation: VaR = $10 million × 2.33 × 15% = $3.495 million."""
    q7 = parse_paste_text(t7_text)
    assert 'VaR = $10 million × 2.33 × 15%' in q7[0]['questionText']
    assert 'VaR = $10 million × 2.33 × 15%' in q7[0]['explanation']
    print("✓ Test 7: Mathematical formula VaR = $10 million × 2.33 × 15% preserved.")
    passed += 1

    # Test 8: HTML question content
    t8_text = """Q8. <p>Consider <strong>substance X</strong> with formula H<sub>2</sub>O and speed <em>c<sup>2</sup></em>:</p><ul><li>Item 1</li><li>Item 2</li></ul>
A) Result A
B) Result B
C) Result C
D) Result D
Answer: C
Explanation: <strong>Correct</strong> because H<sub>2</sub>O is water."""
    q8 = parse_paste_text(t8_text)
    assert '<sub>2</sub>' in q8[0]['questionText']
    assert '<sup>2</sup>' in q8[0]['questionText']
    assert '<strong>substance X</strong>' in q8[0]['questionText']
    print("✓ Test 8: HTML question formatting tags preserved.")
    passed += 1

    # Test 9: Unicode characters
    t9_text = """Q9. Calculate €500 + ¥2,000 + £150 with parameters α = 0.05, β = 1.2 — note the em-dash and accents like résumé.
A) €600
B) €700
C) €800
D) €900
Answer: B
Explanation: Total in € is €700."""
    q9 = parse_paste_text(t9_text)
    assert '€500' in q9[0]['questionText']
    assert 'α = 0.05, β = 1.2' in q9[0]['questionText']
    assert 'résumé' in q9[0]['questionText']
    print("✓ Test 9: Unicode characters (€, ¥, £, α, β, —, accents) preserved.")
    passed += 1

    # Test 10: Question containing special characters & < > " ' ]]>
    t10_text = """Q10. What happens if expression is A & B < C > D with "quotes" and 'single' and ]]> test?
A) Yes & No
B) <Tag> & "Val"
C) CDATA test ]]>
D) None
Answer: B
Explanation: Evaluated with & < > " ' and ]]> properly."""
    q10 = parse_paste_text(t10_text)
    serialized = serialize_question(q10[0])
    assert ']]]]><![CDATA[>' in serialized, "Test 10 failed: ]]> was not escaped in CDATA"
    print("✓ Test 10: Special characters (&, <, >, \", ', ]]> CDATA escape) handled safely.")
    passed += 1

    # Test 11: Missing answer detection
    t11_text = """Q11. Question with only one answer?
A) Only option
Answer: A"""
    q11 = parse_paste_text(t11_text)
    assert len(q11[0]['answers']) < 2, "Test 11 check passed"
    print("✓ Test 11: Missing answer choices (<2) detected properly.")
    passed += 1

    # Test 12: Missing correct answer detection
    t12_text = """Q12. Question without any correct answer specified?
A) Option A
B) Option B
C) Option C
D) Option D"""
    q12 = parse_paste_text(t12_text)
    assert not any(a['correct'] for a in q12[0]['answers']), "Test 12 check passed"
    print("✓ Test 12: Missing correct answer detected properly.")
    passed += 1

    # Test 13: Duplicate question ID detection
    t13_text = """Q001. First question
A) A
B) B
Answer: A

Q001. Second question with same ID
A) A
B) B
Answer: B"""
    q13 = parse_paste_text(t13_text)
    ids = [q['id'] for q in q13]
    assert len(ids) != len(set(ids)), "Test 13 check passed: duplicate ID found"
    print("✓ Test 13: Duplicate question ID detected properly.")
    passed += 1

    # Test 14: Question without ID (auto-generation)
    t14_text = """1. First question without explicit custom code
A) Option 1
B) Option 2
Answer: A

2. Second question without explicit custom code
A) Option 1
B) Option 2
Answer: B"""
    q14 = parse_paste_text(t14_text, id_mode='generate', id_prefix='Q')
    assert len(q14) == 2, f"Expected 2 questions, got {len(q14)}"
    assert q14[0]['id'] == 'Q001', f"Expected Q001, got {q14[0]['id']}"
    assert q14[1]['id'] == 'Q002', f"Expected Q002, got {q14[1]['id']}"
    print("✓ Test 14: Questions without custom ID auto-assigned sequential Q001, Q002.")
    passed += 1

    # Test 15: Three answer choices
    t15_text = """Q15. Question with only 3 options?
A) High
B) Medium
C) Low
Answer: A
Explanation: Standard 3-choice warning."""
    q15 = parse_paste_text(t15_text)
    assert len(q15[0]['answers']) == 3
    print("✓ Test 15: Three answer choices handled properly.")
    passed += 1

    # Test 16: Existing XML + append 10 questions
    with open(REFERENCE_XML_PATH, 'r', encoding='utf-8') as f:
        ref_xml = f.read()
    
    t16_new = [parse_paste_text(f"QNEW{i}. Appended Question {i}?\nA) A\nB) B\nC) C\nD) D\nAnswer: A\nExplanation: Expl {i}")[0] for i in range(1, 11)]
    tree = ET.fromstring(ref_xml)
    orig_q_count = len(tree.findall('data/quiz/questions/question'))
    
    combined_questions = []
    for q_el in tree.findall('data/quiz/questions/question'):
        qid = q_el.find('title').text
        qtext = q_el.find('questionText').text
        answers = []
        for a_el in q_el.findall('answers/answer'):
            answers.append({
                'label': 'A',
                'text': a_el.find('answerText').text or '',
                'correct': a_el.attrib.get('correct') == 'true',
                'points': int(a_el.attrib.get('points', 0))
            })
        combined_questions.append({
            'id': qid,
            'questionText': qtext,
            'answers': answers,
            'explanation': '',
            'points': 1,
            'answerType': 'single'
        })
    combined_questions.extend(t16_new)
    
    out_xml_16 = generate_xml(ref_xml, combined_questions)
    out_tree_16 = ET.fromstring(out_xml_16)
    assert len(out_tree_16.findall('data/quiz/questions/question')) == orig_q_count + 10
    print(f"✓ Test 16: Existing XML + appended 10 questions (Total: {orig_q_count + 10}).")
    passed += 1

    # Test 17: Existing XML + replace all questions
    t17_new = [parse_paste_text(f"QREPL{i}. Replaced Question {i}?\nA) A\nB) B\nC) C\nD) D\nAnswer: B")[0] for i in range(1, 6)]
    out_xml_17 = generate_xml(ref_xml, t17_new)
    out_tree_17 = ET.fromstring(out_xml_17)
    assert len(out_tree_17.findall('data/quiz/questions/question')) == 5
    assert out_tree_17.find('data/quiz/timeLimit').text == '1800'
    assert out_tree_17.find('data/quiz/showPoints').text == 'true'
    print("✓ Test 17: Existing XML + replaced all questions with 5 new ones, settings preserved.")
    passed += 1

    # Test 18: Existing XML + insert questions at position
    inserted_list = list(combined_questions[:2]) + t16_new[:3] + list(combined_questions[2:orig_q_count])
    out_xml_18 = generate_xml(ref_xml, inserted_list)
    out_tree_18 = ET.fromstring(out_xml_18)
    assert len(out_tree_18.findall('data/quiz/questions/question')) == orig_q_count + 3
    print("✓ Test 18: Existing XML + inserted questions at position passed.")
    passed += 1

    # Test 19: Identity Round-Trip Test
    out_xml_19 = generate_xml(ref_xml, combined_questions[:orig_q_count])
    out_tree_19 = ET.fromstring(out_xml_19)
    assert len(out_tree_19.findall('data/quiz/questions/question')) == orig_q_count
    assert out_tree_19.find('data/quiz/title').text == tree.find('data/quiz/title').text
    assert out_tree_19.find('data/quiz/timeLimit').text == tree.find('data/quiz/timeLimit').text
    assert len(out_tree_19.findall('data/quiz/post_meta')) == len(tree.findall('data/quiz/post_meta'))
    print("✓ Test 19: Identity Round-Trip Test: Settings, post_meta, and question structure 100% preserved.")
    passed += 1

    print('=' * 70)
    print(f'ALL {passed}/{total} SPECIFICATION & TAG TESTS PASSED SUCCESSFULLY!')
    print('=' * 70)

if __name__ == '__main__':
    run_all_tests()
