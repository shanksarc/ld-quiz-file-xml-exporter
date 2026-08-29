import time
import xml.etree.ElementTree as ET
from runTests import generate_xml, serialize_question

def benchmark_100_questions():
    with open('WpProQuiz_export_1788019126.xml', 'r', encoding='utf-8') as f:
        template_xml = f.read()

    # Generate 150 mock questions
    questions = []
    for i in range(1, 151):
        questions.append({
            'id': f'F2B1MQ{i:03d}CSD',
            'points': 1,
            'questionText': f'<p>This is question number {i} evaluating financial risk measures and portfolio variance.</p>',
            'answerType': 'single',
            'category': '',
            'tipMsg': '',
            'correctMsg': f'<p>Correct Answer: B</p><p>Explanation: Detailed solution for question {i}.</p>',
            'incorrectMsg': f'<p>Correct Answer: B</p><p>Explanation: Detailed solution for question {i}.</p>',
            'explanation': f'Detailed explanation and formula solution for question {i}.',
            'answers': [
                {'label': 'A', 'text': f'Option A text for question {i}', 'correct': False, 'points': 0},
                {'label': 'B', 'text': f'Option B correct answer for question {i}', 'correct': True, 'points': 1},
                {'label': 'C', 'text': f'Option C text for question {i}', 'correct': False, 'points': 0},
                {'label': 'D', 'text': f'Option D text for question {i}', 'correct': False, 'points': 0},
            ]
        })

    t0 = time.perf_counter()
    xml_out = generate_xml(template_xml, questions)
    t1 = time.perf_counter()

    print(f"Generated XML for {len(questions)} questions in {(t1 - t0)*1000:.2f} ms ({len(xml_out)} bytes)")
    assert len(xml_out) > 50000
    assert '<questions>' in xml_out

if __name__ == '__main__':
    benchmark_100_questions()
