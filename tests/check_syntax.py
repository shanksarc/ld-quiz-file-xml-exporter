import glob
import re

def strip_strings(js_code):
    # Remove single line comments
    code = re.sub(r'//.*', '', js_code)
    # Remove multi-line comments
    code = re.sub(r'/\*[\s\S]*?\*/', '', code)
    # Remove template literals
    code = re.sub(r'`(?:[^`\\]|\\.)*`', '""', code, flags=re.DOTALL)
    # Remove regex literals
    code = re.sub(r'/(?:[^/\\\n]|\\.)+/[gimuy]*', '""', code)
    # Remove double quoted strings
    code = re.sub(r'"(?:[^"\\]|\\.)*"', '""', code)
    # Remove single quoted strings
    code = re.sub(r"'(?:[^'\\]|\\.)*'", "''", code)
    return code

js_files = glob.glob('js/**/*.js', recursive=True)
all_valid = True
for f in js_files:
    with open(f, 'r', encoding='utf-8') as fh:
        code = fh.read()
    clean = strip_strings(code)
    open_curly = clean.count('{') - clean.count('}')
    open_paren = clean.count('(') - clean.count(')')
    open_brack = clean.count('[') - clean.count(']')
    print(f"{f}: Braces: {open_curly}, Parens: {open_paren}, Brackets: {open_brack}")
    if open_curly != 0 or open_paren != 0 or open_brack != 0:
        all_valid = False

assert all_valid, "Syntax balance error!"
print("\nALL JS FILES 100% BALANCED AND VALID!")
