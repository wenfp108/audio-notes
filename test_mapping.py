"""map_units_to_sentences 的单元测试(不依赖模型)。"""
import sys
sys.path.insert(0, "backend")
from align import map_units_to_sentences


def test_chinese_char_units():
    # 模拟中文按字对齐:每个字一个单元
    sents = ["你好世界。", "再见。"]
    units = [
        {"text": "你", "start": 0.0, "end": 0.3},
        {"text": "好", "start": 0.3, "end": 0.6},
        {"text": "世", "start": 0.6, "end": 0.9},
        {"text": "界", "start": 0.9, "end": 1.2},
        {"text": "再", "start": 1.5, "end": 1.8},
        {"text": "见", "start": 1.8, "end": 2.1},
    ]
    out = map_units_to_sentences(sents, units)
    assert len(out) == 2, out
    assert out[0]["start"] == 0.0 and out[0]["end"] == 1.2, out[0]
    assert out[1]["start"] == 1.5 and out[1]["end"] == 2.1, out[1]
    print("PASS test_chinese_char_units")


def test_skips_blank_units():
    # 句间空格单元不应污染句首时间
    sents = ["甲乙", "丙丁"]
    units = [
        {"text": "甲", "start": 0.0, "end": 0.2},
        {"text": "乙", "start": 0.2, "end": 0.4},
        {"text": " ", "start": 0.4, "end": 0.4},
        {"text": "丙", "start": 1.0, "end": 1.2},
        {"text": "丁", "start": 1.2, "end": 1.4},
    ]
    out = map_units_to_sentences(sents, units)
    assert out[0]["end"] == 0.4, out[0]
    assert out[1]["start"] == 1.0, out[1]  # 不是 0.4(空格)
    print("PASS test_skips_blank_units")


def test_english_word_units():
    sents = ["Hello world.", "Bye."]
    units = [
        {"text": "hello", "start": 0.0, "end": 0.5},
        {"text": "world", "start": 0.5, "end": 1.0},
        {"text": "bye", "start": 1.3, "end": 1.6},
    ]
    out = map_units_to_sentences(sents, units)
    assert len(out) == 2
    assert out[0]["start"] == 0.0 and out[0]["end"] == 1.0
    assert out[1]["start"] == 1.3
    print("PASS test_english_word_units")


if __name__ == "__main__":
    test_chinese_char_units()
    test_skips_blank_units()
    test_english_word_units()
    print("\n全部通过 ✅")
