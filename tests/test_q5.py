import xml.etree.ElementTree as ET
from runTests import parse_paste_text, generate_xml

user_input = """Q5. An investor purchases $2,000 of a mutual fund at the beginning of each month. The fund’s share prices over three months are $20, $25, and $40. Which measure is most appropriate for calculating the investor’s average cost per share?

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
= 27.27 approximately."""

qs = parse_paste_text(user_input)
print('Total Questions:', len(qs))
assert len(qs) == 1, f"Expected 1 question, got {len(qs)}"

q = qs[0]
print("ID:", q.get('id'))
print("Question Text:", q.get('questionText'))
print("Answers count:", len(q.get('answers', [])))
for a in q.get('answers', []):
    print(f"  [{a['label']}] correct={a['correct']} text={a['text']}")
print("Explanation:", q.get('explanation'))

# Assertions
assert q.get('id') == '5'
assert 'investor purchases $2,000' in q.get('questionText')
assert len(q.get('answers')) == 4
assert q['answers'][0]['label'] == 'A' and q['answers'][0]['text'] == 'Arithmetic mean' and not q['answers'][0]['correct']
assert q['answers'][1]['label'] == 'B' and q['answers'][1]['text'] == 'Geometric mean' and not q['answers'][1]['correct']
assert q['answers'][2]['label'] == 'C' and q['answers'][2]['text'] == 'Harmonic mean' and q['answers'][2]['correct']
assert q['answers'][3]['label'] == 'D' and q['answers'][3]['text'] == 'Weighted-average return' and not q['answers'][3]['correct']
assert 'Formula:' in q.get('explanation')
assert 'Harmonic Mean' in q.get('explanation')

# Template round trip
with open('WpProQuiz_export_1788019126.xml', 'r', encoding='utf-8') as f:
    tpl = f.read()

out_xml = generate_xml(tpl, qs)
tree = ET.fromstring(out_xml)
xml_q = tree.findall('data/quiz/questions/question')
assert len(xml_q) == 1

print("\nSUCCESS: User Question Q5 parsed and verified 100% perfectly!")
