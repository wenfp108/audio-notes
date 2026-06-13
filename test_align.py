"""第 1 步验证脚本:跑通对齐,打印每句的时间戳。"""
import sys
import time
sys.path.insert(0, "backend")

import textload
import align

audio = "data/_test/sample.wav"
text = textload.load_text("data/_test/transcript.txt")
sentences = textload.split_sentences(text)
print(f"[文稿] {len(sentences)} 句:")
for s in sentences:
    print("   ", s)

print("\n[对齐] 开始(首次会下载模型)……")
t0 = time.time()
result = align.align(audio, sentences)
print(f"[对齐] 完成,用时 {time.time() - t0:.1f}s\n")

print("[结果] 句级时间戳:")
ok = True
prev_end = -1
for r in result:
    print(f"   [{r['start']:6.2f} - {r['end']:6.2f}]  {r['text']}")
    # 基本合理性检查
    if r["end"] < r["start"]:
        ok = False
        print("       !! end < start")
    if r["start"] < prev_end - 0.5:
        ok = False
        print("       !! 时间倒退")
    prev_end = r["end"]

print(f"\n[验收] 句数匹配: {len(result) == len(sentences)} | 时间单调且合理: {ok}")
