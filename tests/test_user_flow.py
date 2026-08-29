import xml.etree.ElementTree as ET
from runTests import parse_paste_text, generate_xml, serialize_question

def test_user_scenario():
    print("Testing user scenario: Template + New Uploaded Questions only...")

    with open('WpProQuiz_export_1788019126.xml', 'r', encoding='utf-8') as f:
        template_xml = f.read()

    user_input = """[question]
[id: F2B1MQ02CSD]
A portfolio manager is evaluating the risk profile of a diverse portfolio.

[A] VaR(95%) = $1.2 million, VaR(99%) = $2.0 million
[B] VaR(95%) = $1.5 million, VaR(99%) = $2.3 million
[C] VaR(95%) = $1.8 million, VaR(99%) = $2.5 million
[D] VaR(95%) = $2.0 million, VaR(99%) = $2.8 million

[answer: B]

[explanation]
Formula: VaR = Portfolio Value × (Z × SD - Mean)
[/question]

[question]
[id: F2B1MQ05CSD]
When estimating a coherent risk measure, which properties must be satisfied?

[A] Subadditivity, Monotonicity, Positive Homogeneity, and Translation Invariance
[B] Value at Risk proportionality and strict normality
[C] Zero tail risk sensitivity and mean invariance
[D] Skewness symmetry and kurtosis boundedness

[answer: A]

[explanation]
A coherent risk measure must satisfy all 4 axioms.
[/question]"""

    parsed_questions = parse_paste_text(user_input)

    # 1. Verify question count is exactly 2
    assert len(parsed_questions) == 2, f"Expected 2 questions, got {len(parsed_questions)}"

    # 2. Verify Q1 has EXACTLY 4 choices and NO blank choices
    q1 = parsed_questions[0]
    assert len(q1['answers']) == 4, f"Expected exactly 4 choices in Q1, got {len(q1['answers'])}"
    assert all(a['text'] for a in q1['answers']), "Found empty choices in Q1!"
    assert q1['answers'][1]['correct'] == True, "Choice B should be marked correct in Q1"
    assert q1['answers'][0]['correct'] == False, "Choice A should be false in Q1"

    # 3. Verify Q2 has EXACTLY 4 choices
    q2 = parsed_questions[1]
    assert len(q2['answers']) == 4, f"Expected exactly 4 choices in Q2, got {len(q2['answers'])}"
    assert all(a['text'] for a in q2['answers']), "Found empty choices in Q2!"
    assert q2['answers'][0]['correct'] == True, "Choice A should be marked correct in Q2"

    # 4. Generate XML with ONLY the new questions (Replace mode)
    final_xml = generate_xml(template_xml, parsed_questions)

    # 5. Verify the generated XML contains exactly 2 questions
    tree = ET.fromstring(final_xml)
    xml_questions = tree.findall('data/quiz/questions/question')
    assert len(xml_questions) == 2, f"Expected 2 questions in XML, got {len(xml_questions)}"

    # 6. Verify quiz settings preserved
    assert tree.find('data/quiz/timeLimit').text == '1800'
    assert tree.find('data/quiz/showPoints').text == 'true'
    assert len(tree.findall('data/quiz/post_meta')) == 3

    print("ALL USER SCENARIO CHECKS PASSED PERFECTLY!")

if __name__ == '__main__':
    test_user_scenario()
