"""强制对齐:把已知文稿的每句话对齐到音频时间点。

用 ctc-forced-aligner(1.0.2,基于 ONNX 的 MMS wav2vec2 模型)。流程对照该包源码:
  1. AlignmentSingleton 懒加载 ONNX 模型 + tokenizer(首次联网下载约 1GB,之后离线);
  2. 把全部句子拼成一段文本喂进去,中文按"字"对齐(language="chi" 时库内部强制按字符切);
  3. 拿到字/词级时间戳后,按字符长度贪心地归并回每个句子,得到句级 start/end。

注意:语言码必须用 "chi"(不是 "zho"),否则中文不会按字符切分,对齐会失败。
"""
import re
import threading
from pathlib import Path

# ctc-forced-aligner 用这个 iso 码触发中文按字符切分(见其 __init__.preprocess_text)
DEFAULT_LANGUAGE = "chi"

# 模型放在项目内 models/model.onnx,而不是库默认的 ~/ctc_forced_aligner/model.onnx,
# 避免在 home 根目录乱放 1.2GB 文件。用 __file__ 定位,无论从哪个目录启动都能找到。
# 已存在则直接用,不会重新下载。
_MODEL_PATH = str(Path(__file__).resolve().parent.parent / "models" / "model.onnx")

_aligner = None
_lock = threading.Lock()


def _ensure_aligner():
    """懒加载对齐模型,进程内只加载一次。"""
    global _aligner
    if _aligner is not None:
        return _aligner
    with _lock:
        if _aligner is None:
            from ctc_forced_aligner import AlignmentSingleton
            _aligner = AlignmentSingleton(model_path=_MODEL_PATH)
    return _aligner


def align(audio_path: str, sentences: list[str], language: str = DEFAULT_LANGUAGE) -> list[dict]:
    """对齐音频与句子,返回 [{text, start, end}, ...](时间单位:秒)。"""
    sentences = [s for s in sentences if s.strip()]
    if not sentences:
        return []

    aligner = _ensure_aligner()
    from ctc_forced_aligner import (
        load_audio,
        generate_emissions,
        preprocess_text,
        get_alignments,
        get_spans,
        postprocess_results,
    )

    # 句子间用空格分隔拼成整段;中文会被库按字符切分,空格不产生有效字符。
    text = " ".join(sentences)

    audio_waveform = load_audio(audio_path)
    emissions, stride = generate_emissions(aligner.model, audio_waveform, batch_size=8)
    tokens_starred, text_starred = preprocess_text(
        text, romanize=True, language=language
    )
    segments, scores, blank_token = get_alignments(
        emissions, tokens_starred, aligner.tokenizer
    )
    spans = get_spans(tokens_starred, segments, blank_token)
    units = postprocess_results(text_starred, spans, stride, scores)

    return map_units_to_sentences(sentences, units)


def _norm(s: str) -> str:
    """归一化:只保留可对齐字符(CJK + 字母数字),去掉空白和标点,转小写。

    对齐器内部会用 text_normalize 把标点去掉,产出的单元只含可对齐字符;
    所以这里按相同口径归一,句子的目标长度才能和单元数对得上。
    """
    return re.sub(r"[\W_]", "", s, flags=re.UNICODE).lower()


def map_units_to_sentences(sentences: list[str], units: list[dict]) -> list[dict]:
    """把按顺序排列的字/词级时间戳,贪心地归并回每个句子。

    units 每项形如 {text, start, end}(start/end 单位秒),顺序与 sentences 拼接一致。
    纯函数,便于单测。
    """
    result = []
    ui = 0
    n = len(units)
    for sent in sentences:
        target = _norm(sent)
        if not target:
            continue
        consumed = 0
        start_t = None
        end_t = None
        while ui < n and consumed < len(target):
            u = units[ui]
            ut = _norm(str(u.get("text", "")))
            if ut:  # 跳过空白单元,避免把句首时间设成空格
                if start_t is None:
                    start_t = float(u.get("start", 0.0))
                end_t = float(u.get("end", 0.0))
                consumed += len(ut)
            ui += 1
        result.append({
            "text": sent,
            "start": round(start_t if start_t is not None else 0.0, 3),
            "end": round(end_t if end_t is not None else 0.0, 3),
        })
    return result
