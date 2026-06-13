# 🎧 audio-notes

[简体中文](README.zh-CN.md) · **English**

Automatically aligns **an audio file** with its **matching transcript** down to the second, so you can read along with live highlighting while you listen, mark anything that strikes you with one key, and export timestamped study notes.

> Solves one specific pain point: when you *listen* instead of *read*, a sentence suddenly sparks an idea — but you don't know where it is in the book, and the moment passes before you can write it down. This tool lets you **press one key and automatically record "which sentence in the book this moment of audio corresponds to."**

Everything runs **locally on your own machine**. Your audio and notes are never uploaded to any server — free, offline, and private.

---

## What it does

- **Upload**: 1 audio file (mp3 / wav / m4a / aac / flac / ogg) + 1 transcript (txt or text-based pdf)
- **Auto-align**: maps every sentence of the transcript to its start/end time in the audio (works for both Chinese and English)
- **Read-along highlight**: the sentence being spoken is highlighted and auto-scrolled to the center of the screen
- **Click to jump**: click any sentence to jump the audio to that moment and play
- **One-key mark**: press `M` on anything important to record the current time + your note
- **Export notes**: one click to export Markdown — the full text with per-sentence timestamps plus everything you marked

---

## Where its "brain" comes from (about the model)

The alignment is done by an AI model (~1.2 GB). This model is **not stored in this repo** — it is **automatically downloaded from [Hugging Face](https://huggingface.co/deskpai/ctc_forced_aligner)** to your machine on first run, then works offline afterwards.

- Source: based on Meta's open-source MMS multilingual speech model, repackaged by a third party.
- License: `CC-BY-NC` (free for personal study/use; commercial use requires a different model).
- You don't need to download anything manually — the program handles it. The first alignment is slower (download + compute); it's fast after that.

---

## How to use it (easiest way on macOS)

### Setup (one time only)

You need Python 3.10+ and ffmpeg. Once installed, create the environment and install dependencies in the project folder:

```bash
cd audio-notes
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

If ffmpeg isn't installed: `brew install ffmpeg`

### Daily use (every time)

**Double-click `启动.command`** in the project folder:

1. A black terminal window pops up (this is the backend service — don't close it)
2. After a few seconds your browser opens the tool automatically
3. Upload an audio file + transcript in the page and start using it

> On the first double-click, macOS may warn "from an unidentified developer." Fix: right-click `启动.command` → Open → click "Open" again. Only needed once.

**To stop**: just close that black terminal window (close the window, the page stops).

### Manual start (fallback)

If you'd rather not use the script:

```bash
source .venv/bin/activate
cd backend
uvicorn main:app --port 8000
```

Then open http://localhost:8000 in your browser.

---

## How to prepare audio and transcript

1. **Audio**: an audiobook, a podcast, or audio generated from an ebook with a text-to-speech (TTS) tool such as [ebook2audiobook](https://github.com/DrewThomasson/ebook2audiobook).
2. **Transcript**: a txt or text-based pdf whose **content and order match the audio**.

> ⚠️ **Key point: the audio and transcript must be a matching pair.**
> The aligner spreads *all* the text you give it across the *entire* audio you give it. So:
> - If you only converted **Chapter 1's audio**, give it **only Chapter 1's text** — not the whole book. Otherwise it will wrongly spread the whole book across Chapter 1's audio and the timestamps will be completely off.
> - Recommended: **one project per chapter** — convert a chapter, listen to it, mark it. Each chapter has its own independent timestamps and notes, with no interference.

---

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| Space | Play / Pause |
| ← / → | Back / Forward 5 seconds |
| M | Mark the current moment |

---

## Project structure

```
audio-notes/
├── 启动.command       # Double-click to launch (macOS)
├── backend/
│   ├── main.py        # FastAPI: upload, align, fetch results, export
│   ├── align.py       # Forced-alignment wrapper (points to local model)
│   ├── textload.py    # txt/pdf reading + sentence splitting
│   └── storage.py     # Project JSON read/write
├── frontend/          # Plain HTML/CSS/JS, no build step
│   ├── index.html
│   ├── app.js
│   └── style.css
├── models/            # Alignment model (auto-downloaded on first run, not in git)
├── data/              # Uploaded audio + alignment results (auto-generated, not in git)
└── requirements.txt
```

---

## Known limitations

- **pdf must be text-based** (text you can select/copy); scanned (image) pdfs have no extractable text and will show an error.
- The default alignment model is `CC-BY-NC` licensed — fine for personal use, but commercial use requires a different model.
- This version only does "audio + transcript → alignment." Speech recognition (audio without a transcript), text-to-speech, video/YouTube import, AI summaries, multi-chapter merge management, etc. will come later.
- Verified on macOS + Python 3.13 so far.

---

## Tech stack

- Backend: Python + [FastAPI](https://fastapi.tiangolo.com/) + [uvicorn](https://www.uvicorn.org/)
- Alignment: [ctc-forced-aligner](https://pypi.org/project/ctc-forced-aligner/) (ONNX, Meta MMS model)
- Audio processing: ffmpeg
- Frontend: vanilla HTML / CSS / JavaScript (no framework, no build)
