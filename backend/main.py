"""FastAPI 后端:上传 → 对齐 → 取结果 → 导出。"""
import subprocess
import tempfile
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import FileResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles

import align
import storage
import textload

app = FastAPI(title="音视频笔记工具")

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"
AUDIO_EXTS = {".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg"}


def _ffmpeg_to_wav(src: str, dst: str) -> None:
    """统一转成 16kHz 单声道 wav,喂给对齐器最稳。"""
    cmd = [
        "ffmpeg", "-y", "-i", src,
        "-ac", "1", "-ar", "16000",
        dst,
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg 转码失败:{proc.stderr[-500:]}")


@app.post("/api/upload")
async def upload(audio: UploadFile = File(...), transcript: UploadFile = File(...)):
    audio_ext = Path(audio.filename or "").suffix.lower()
    if audio_ext not in AUDIO_EXTS:
        raise HTTPException(400, f"音频格式不支持:{audio_ext}")

    pid = storage.new_project_id()
    pdir = storage.project_dir(pid)

    # 暂存上传文件
    with tempfile.TemporaryDirectory() as tmp:
        raw_audio = Path(tmp) / f"in{audio_ext}"
        raw_audio.write_bytes(await audio.read())

        tr_ext = Path(transcript.filename or "").suffix.lower()
        raw_tr = Path(tmp) / f"tr{tr_ext}"
        raw_tr.write_bytes(await transcript.read())

        # 统一音频为 wav,存进项目目录
        wav_path = pdir / "audio.wav"
        _ffmpeg_to_wav(str(raw_audio), str(wav_path))

        # 读文稿 + 断句
        try:
            text = textload.load_text(str(raw_tr))
        except ValueError as e:
            raise HTTPException(400, str(e))
        sentences = textload.split_sentences(text)
        if not sentences:
            raise HTTPException(400, "文稿里没有可识别的句子。")

    # 对齐(耗时操作)
    try:
        aligned = align.align(str(wav_path), sentences)
    except Exception as e:
        raise HTTPException(500, f"对齐失败:{e}")

    data = {
        "id": pid,
        "title": Path(audio.filename or "未命名").stem,
        "audio": "audio.wav",
        "sentences": aligned,
        "marks": [],
    }
    storage.save(pid, data)
    return data


@app.get("/api/project/{pid}")
def get_project(pid: str):
    try:
        return storage.load(pid)
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))


@app.get("/api/audio/{pid}")
def get_audio(pid: str):
    path = storage.project_dir(pid) / "audio.wav"
    if not path.exists():
        raise HTTPException(404, "音频不存在")
    return FileResponse(str(path), media_type="audio/wav")


@app.post("/api/project/{pid}/marks")
def save_marks(pid: str, marks: list[dict]):
    try:
        data = storage.load(pid)
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))
    data["marks"] = marks
    storage.save(pid, data)
    return {"ok": True}


def _fmt_ts(seconds: float) -> str:
    seconds = int(round(seconds))
    return f"{seconds // 60:02d}:{seconds % 60:02d}"


@app.get("/api/project/{pid}/export")
def export_md(pid: str):
    try:
        data = storage.load(pid)
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))

    lines = [f"# 学习笔记:{data.get('title', '')}", "", "## 全文(带时间戳)", ""]
    for s in data["sentences"]:
        lines.append(f"- [{_fmt_ts(s['start'])}] {s['text']}")
    marks = data.get("marks", [])
    if marks:
        lines += ["", "## 标记的重点", ""]
        for m in marks:
            note = f" {m['note']}" if m.get("note") else ""
            lines.append(f"- [{_fmt_ts(m['time'])}]{note}")
    md = "\n".join(lines) + "\n"
    return PlainTextResponse(md, media_type="text/markdown")


# 前端静态文件(放最后,避免覆盖 /api)
app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
