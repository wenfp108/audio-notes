# 🎧 音视频笔记工具 (audio-notes)

**简体中文** · [English](README.md)

把**一段音频**和它**对应的文字稿**自动对齐到时间点,让你能边听边看高亮跟读,听到精彩处一键标记,最后导出带时间戳的学习笔记。

> 解决一个具体痛点:用"听"代替"读"时,听到某句话突然有灵感,却不知道它在书里哪个位置、来不及记。这个工具让你**只按一下,就自动记下"这段声音对应书里的哪句话"**。

全程**在你自己电脑上运行**,音频和笔记都不上传到任何服务器,免费、离线、隐私安全。

---

## 它能做什么

- **上传**:1 个音频(mp3 / wav / m4a / aac / flac / ogg)+ 1 份文字稿(txt 或文本型 pdf)
- **自动对齐**:把文字稿的每句话,对齐到音频里的起止秒数(中英文都支持)
- **跟读高亮**:播到哪句,哪句就高亮,并自动滚到屏幕中央
- **点句跳转**:点文字里任意一句,音频跳到那一刻播放
- **一键标记**:听到重点按 `M`,记下当前时间 + 你的备注
- **导出笔记**:一键导出 Markdown,含逐句时间戳全文 + 你标记的重点

---

## 它的"大脑"从哪来(关于模型)

对齐这件事由一个 AI 模型完成(约 1.2GB)。这个模型**不在本仓库里**,而是**首次运行时自动从 [Hugging Face](https://huggingface.co/deskpai/ctc_forced_aligner) 下载**到你电脑,之后离线可用。

- 模型来源:基于 Meta 开源的 MMS 多语言语音模型,由第三方打包发布。
- 许可:`CC-BY-NC`(个人学习自用免费;商用需另换模型)。
- 你无需手动下载,程序会自动处理。第一次对齐会比较慢(下模型 + 计算),之后就快了。

---

## 怎么用(macOS 最简方式)

### 准备(只做一次)

需要 Python 3.10+ 和 ffmpeg。装好后,在项目目录里建好环境并装依赖:

```bash
cd audio-notes
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

ffmpeg 如果没装:`brew install ffmpeg`

### 日常使用(每次)

**双击项目里的 `start.command`** 即可:

1. 会弹出一个黑色终端窗口(这是后端服务,别关)
2. 几秒后浏览器自动打开工具页面
3. 在页面里上传音频 + 文字稿,开始使用

> 第一次双击时,macOS 可能提示"来自身份不明的开发者"。解决:右键 `start.command` → 打开 → 再点"打开"。只需做一次。

**关闭**:直接关掉那个黑色终端窗口即可(窗口关了,网页就停了)。

### 手动启动(备用)

如果不想用脚本,也可以手动:

```bash
source .venv/bin/activate
cd backend
uvicorn main:app --port 8000
```

然后浏览器打开 http://localhost:8000

---

## 怎么准备音频和文字稿

1. **音频**:可以是有声书、播客,或用文字转语音(TTS)工具(如 [ebook2audiobook](https://github.com/DrewThomasson/ebook2audiobook))把电子书转成的音频。
2. **文字稿**:和音频**内容一致、顺序一致**的 txt 或文本型 pdf。

> ⚠️ **关键:音频和文字稿必须"配套"。**
> 对齐器会把你给的全部文字,摊到你给的整段音频上。所以:
> - 如果你只转了**第 1 章的音频**,就只给**第 1 章的文字**,不要给整本书的文字 —— 否则会把整本书错误地摊到第 1 章音频上,时间戳全乱。
> - 推荐**一章一个项目**:转一章、听一章、标一章。每章各自有独立的时间戳和笔记,互不干扰。

---

## 键盘快捷键

| 键 | 作用 |
|----|------|
| 空格 | 播放 / 暂停 |
| ← / → | 后退 / 前进 5 秒 |
| M | 标记当前时刻 |

---

## 目录结构

```
audio-notes/
├── start.command       # 双击启动(macOS)
├── backend/
│   ├── main.py        # FastAPI:上传、对齐、取结果、导出
│   ├── align.py       # 强制对齐封装(指向本地模型)
│   ├── textload.py    # txt/pdf 读取 + 断句
│   └── storage.py     # 项目 JSON 存取
├── frontend/          # 纯 HTML/CSS/JS,无需打包
│   ├── index.html
│   ├── app.js
│   └── style.css
├── models/            # 对齐模型(首次运行自动下载,不进 git)
├── data/              # 上传的音频 + 对齐结果(自动生成,不进 git)
└── requirements.txt
```

---

## 已知限制

- **pdf 仅支持文本型**(能复制文字的);扫描件(图片型)抽不出文字,会提示。
- 默认对齐模型为 `CC-BY-NC` 许可,个人自用没问题,商用需换模型。
- 这一版只做"音频 + 文字稿 → 对齐"。语音识别(无文稿音频)、文字转语音、视频/YouTube 导入、AI 摘要、多章节合并管理等,未来再加。
- 目前在 macOS + Python 3.13 上验证通过。

---

## 技术栈

- 后端:Python + [FastAPI](https://fastapi.tiangolo.com/) + [uvicorn](https://www.uvicorn.org/)
- 对齐:[ctc-forced-aligner](https://pypi.org/project/ctc-forced-aligner/)(ONNX,Meta MMS 模型)
- 音频处理:ffmpeg
- 前端:原生 HTML / CSS / JavaScript(无框架、无构建)
