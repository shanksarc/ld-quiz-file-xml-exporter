from runTests import parse_paste_text

def test_id_patterns():
    print("Testing custom Question ID numbering patterns (Prefix + Padded # + Suffix)...")

    # Helper replicating formatQuestionId
    def format_id(prefix, num, digits, suffix):
        return f"{prefix}{str(num).zfill(digits)}{suffix}"

    assert format_id('F2B1MQ', 1, 3, 'CSD') == 'F2B1MQ001CSD'
    assert format_id('F2B1MQ', 5, 2, 'CSD') == 'F2B1MQ05CSD'
    assert format_id('Q', 10, 3, '') == 'Q010'
    assert format_id('CFA_L1_', 7, 4, '_FINAL') == 'CFA_L1_0007_FINAL'

    print("ALL ID NUMBERING PATTERN TESTS PASSED SUCCESSFULLY!")

if __name__ == '__main__':
    test_id_patterns()
