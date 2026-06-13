"""读取 txt / pdf 文稿,并切分成句子。

句子是后续"跟读高亮"的最小单位。
"""
import re
from pathlib import Path


def load_text(path: str) -> str:
    """从 txt 或 pdf 读出纯文本。

    pdf 仅支持文本型(可复制文字的);扫描件(图片型)抽不出文字,会抛错提示。
    """
    suffix = Path(path).suffix.lower()
    if suffix == ".txt":
        return _read_txt(path)
    if suffix == ".pdf":
        return _read_pdf(path)
    raise ValueError(f"不支持的文稿格式:{suffix}(只支持 .txt / .pdf)")


def _read_txt(path: str) -> str:
    # 尝试常见编码,优先 utf-8
    for enc in ("utf-8", "gb18030", "utf-16"):
        try:
            return Path(path).read_text(encoding=enc)
        except UnicodeDecodeError:
            continue
    # 兜底:忽略无法解码的字节
    return Path(path).read_text(encoding="utf-8", errors="ignore")


def _read_pdf(path: str) -> str:
    from pypdf import PdfReader

    reader = PdfReader(path)
    parts = [page.extract_text() or "" for page in reader.pages]
    text = "\n".join(parts).strip()
    if not text:
        raise ValueError(
            "这个 PDF 抽不出文字,可能是扫描件(图片型)。"
            "请改用文本型 PDF 或 txt。"
        )
    return text


# 句末标点:中英文都覆盖
_SENT_END = "。！？!?；;…\n"
_SPLIT_RE = re.compile(rf"[^{re.escape(_SENT_END)}]+[{re.escape(_SENT_END)}]?")


def split_sentences(text: str) -> list[str]:
    """按中英文标点把文本切成句子,去掉空白句。"""
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    sentences = []
    for raw in _SPLIT_RE.findall(text):
        s = raw.strip()
        if s:
            sentences.append(s)
    return sentences
