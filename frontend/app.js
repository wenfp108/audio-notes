"use strict";

/* ---------------- state ---------------- */
let project = null;      // { id, title, sentences: [{start,end,text}], marks }
let marks = [];          // [{ time, note }]
let curIdx = -1;
let dragging = false;
let demo = new URLSearchParams(location.search).has("demo");
let demoTimer = null;

const $ = (id) => document.getElementById(id);
const player = $("player");
const transcriptEl = $("transcript");

/* ---------------- utils ---------------- */
function fmt(sec) {
  sec = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(sec / 3600);
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return h ? `${h}:${m}:${s}` : `${m}:${s}`;
}

function fmtSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let n = bytes / 1024, i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n >= 10 ? 0 : 1)} ${units[i]}`;
}

let toastTimer = null;
function toast(msg) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
}

/* ---------------- file pickers ---------------- */
function wireDrop(dropId, inputId, nameId) {
  const drop = $(dropId);
  const input = $(inputId);
  const name = $(nameId);

  const showFile = () => {
    const f = input.files[0];
    name.textContent = f ? `${f.name} · ${fmtSize(f.size)}` : "";
    drop.classList.toggle("has-file", !!f);
  };

  input.addEventListener("change", showFile);

  ["dragenter", "dragover"].forEach((ev) =>
    drop.addEventListener(ev, (e) => {
      e.preventDefault();
      drop.classList.add("dragover");
    })
  );
  ["dragleave", "dragend", "drop"].forEach((ev) =>
    drop.addEventListener(ev, (e) => {
      e.preventDefault();
      drop.classList.remove("dragover");
    })
  );
  drop.addEventListener("drop", (e) => {
    const f = e.dataTransfer?.files?.[0];
    if (!f) return;
    try {
      const dt = new DataTransfer();
      dt.items.add(f);
      input.files = dt.files;
      showFile();
    } catch (_) {
      /* 老浏览器不支持直接赋值，忽略 */
    }
  });
}
wireDrop("drop-audio", "audio-file", "audio-name");
wireDrop("drop-transcript", "transcript-file", "transcript-name");

/* ---------------- upload ---------------- */
$("upload-btn").addEventListener("click", async () => {
  const audio = $("audio-file").files[0];
  const transcript = $("transcript-file").files[0];
  const status = $("upload-status");
  const btn = $("upload-btn");
  const spinner = $("upload-spinner");

  if (!audio || !transcript) {
    status.textContent = "请同时选择音频和文稿。";
    status.className = "status error";
    return;
  }

  status.textContent = "正在对齐，首次运行需要下载模型，可能要几分钟…";
  status.className = "status";
  btn.disabled = true;
  spinner.hidden = false;

  try {
    const fd = new FormData();
    fd.append("audio", audio);
    fd.append("transcript", transcript);

    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "对齐失败");
    }
    project = await res.json();
    status.textContent = "";
    openWorkspace();
    toast("对齐完成，开始学习吧");
  } catch (e) {
    status.textContent = "出错：" + e.message;
    status.className = "status error";
  } finally {
    btn.disabled = false;
    spinner.hidden = true;
  }
});

/* ---------------- workspace ---------------- */
function openWorkspace() {
  demo = demo || project.id === "demo";
  marks = (project.marks || []).slice();
  curIdx = -1;

  $("proj-title").textContent = project.title || "学习";
  $("upload-panel").classList.add("hidden");
  $("workspace").classList.remove("hidden");

  if (!demo) player.src = `/api/audio/${project.id}`;

  renderTranscript();
  renderMarks();
  setPlaying(false);
}

/* ---------------- transcript ---------------- */
function renderTranscript() {
  transcriptEl.innerHTML = "";
  const frag = document.createDocumentFragment();

  project.sentences.forEach((s, i) => {
    const row = document.createElement("div");
    row.className = "sentence";
    row.dataset.idx = i;
    row.dataset.start = s.start;
    row.dataset.end = s.end;

    const ts = document.createElement("span");
    ts.className = "ts";
    ts.textContent = fmt(s.start);

    const txt = document.createElement("span");
    txt.className = "txt";
    txt.textContent = s.text;

    row.append(ts, txt);
    row.addEventListener("click", () => seekTo(s.start));
    frag.appendChild(row);
  });

  transcriptEl.appendChild(frag);
  highlight(currentTime(), true);
}

function seekTo(t) {
  if (demo) {
    setDemoTime(t);
    return;
  }
  player.currentTime = Math.max(0, t);
  player.play().catch(() => {});
}

/* ---------------- playback ---------------- */
function setPlaying(playing) {
  $("play-btn").classList.toggle("playing", playing);
  $("play-btn").querySelector(".play-label").textContent = playing ? "暂停" : "播放";
  $("play-btn").setAttribute("aria-label", playing ? "暂停" : "播放");
}

$("play-btn").addEventListener("click", () => {
  if (demo) {
    const playing = !$("play-btn").classList.contains("playing");
    setPlaying(playing);
    if (playing) startDemoTicker(); else stopDemoTicker();
    return;
  }
  if (player.paused) player.play().catch(() => {});
  else player.pause();
});

player.addEventListener("play", () => setPlaying(true));
player.addEventListener("pause", () => setPlaying(false));

document.querySelectorAll("[data-seek]").forEach((btn) => {
  btn.addEventListener("click", () => seekTo(currentTime() + Number(btn.dataset.seek)));
});

$("speed").addEventListener("change", (e) => {
  if (!demo) player.playbackRate = Number(e.target.value);
});

player.addEventListener("loadedmetadata", () => {
  $("dur-time").textContent = fmt(player.duration);
  $("progress").max = player.duration || 0;
});

player.addEventListener("timeupdate", () => {
  const t = player.currentTime;
  $("cur-time").textContent = fmt(t);
  if (!dragging) setProgress(t, player.duration);
  highlight(t);
});

const progress = $("progress");
progress.addEventListener("pointerdown", () => { dragging = true; });
progress.addEventListener("input", () => {
  dragging = true;
  setProgress(Number(progress.value), Number(progress.max));
});
progress.addEventListener("change", () => {
  const t = Number(progress.value);
  if (demo) { setDemoTime(t); dragging = false; return; }
  player.currentTime = t;
  dragging = false;
});

function setProgress(t, dur) {
  const pct = dur ? Math.min(100, Math.max(0, (t / dur) * 100)) : 0;
  progress.style.setProperty("--pct", pct + "%");
  if (!dragging) progress.value = t;
}

function currentTime() {
  return demo ? demoTime() : player.currentTime || 0;
}

function demoTime() {
  return Number(progress.value) || 0;
}

function setDemoTime(t) {
  const dur = Number(progress.max) || 0;
  t = Math.min(Math.max(0, t), dur);
  progress.value = t;
  setProgress(t, dur);
  $("cur-time").textContent = fmt(t);
  highlight(t);
}

function startDemoTicker() {
  stopDemoTicker();
  demoTimer = setInterval(() => {
    const t = demoTime() + 0.25;
    if (t >= Number(progress.max)) { setPlaying(false); stopDemoTicker(); return; }
    setDemoTime(t);
  }, 250);
}
function stopDemoTicker() {
  if (demoTimer) clearInterval(demoTimer);
  demoTimer = null;
}

/* ---------------- highlight ---------------- */
let lastUserScroll = -1e9;
let programmaticUntil = 0;

transcriptEl.addEventListener(
  "scroll",
  () => {
    if (performance.now() < programmaticUntil) return;
    lastUserScroll = performance.now();
  },
  { passive: true }
);

function highlight(t, force) {
  const sents = project.sentences;
  let idx = -1;
  for (let i = 0; i < sents.length; i++) {
    const s = sents[i];
    if (t >= s.start && t < (s.end || Infinity)) { idx = i; break; }
    if (t >= s.start) idx = i;
  }
  if (idx === curIdx && !force) return;

  const prev = transcriptEl.querySelector(".sentence.active");
  if (prev) prev.classList.remove("active");
  curIdx = idx;
  if (idx < 0) return;

  const el = transcriptEl.querySelector(`.sentence[data-idx="${idx}"]`);
  if (!el) return;
  el.classList.add("active");

  // 用户刚刚手动滚动过，就不要把他拽回去
  const recentlyScrolled = performance.now() - lastUserScroll < 2500;
  if (!force && recentlyScrolled) return;

  programmaticUntil = performance.now() + 800;
  scrollIntoPane(el, force ? "auto" : "smooth");
}

// 只滚动文稿容器，避免把整个页面也带着跳
function scrollIntoPane(el, behavior) {
  const box = transcriptEl;
  const boxRect = box.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  const pad = Math.min(90, boxRect.height * 0.22);
  const above = elRect.top < boxRect.top + pad;
  const below = elRect.bottom > boxRect.bottom - pad;
  if (!above && !below) return;
  const target =
    box.scrollTop +
    (elRect.top - boxRect.top) -
    (boxRect.height - elRect.height) / 2;
  box.scrollTo({ top: Math.max(0, target), behavior });
}

/* ---------------- marks ---------------- */
const modal = $("mark-modal");
const modalNote = $("mark-note");
let pendingTime = 0;

$("mark-btn").addEventListener("click", openMarkModal);

function openMarkModal() {
  if (!project) return;
  pendingTime = currentTime();
  $("modal-ts").textContent = fmt(pendingTime);
  modalNote.value = "";
  modal.classList.remove("hidden");
  requestAnimationFrame(() => modalNote.focus());
}

function closeMarkModal() {
  modal.classList.add("hidden");
}

function saveMark() {
  marks.push({ time: pendingTime, note: modalNote.value.trim() });
  marks.sort((a, b) => a.time - b.time);
  renderMarks();
  closeMarkModal();
  if (demo) {
    toast("演示模式：标记仅存在于当前页面");
    return;
  }
  saveMarks();
  toast(`已标记 ${fmt(pendingTime)}`);
}

$("mark-save").addEventListener("click", saveMark);
$("mark-cancel").addEventListener("click", closeMarkModal);
modal.addEventListener("click", (e) => { if (e.target === modal) closeMarkModal(); });

modalNote.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    saveMark();
  } else if (e.key === "Escape") {
    closeMarkModal();
  }
});

function renderMarks() {
  const ul = $("marks-list");
  ul.innerHTML = "";
  $("marks-count").textContent = marks.length;
  $("marks-empty").classList.toggle("hidden", marks.length > 0);

  const frag = document.createDocumentFragment();
  marks.forEach((m, i) => {
    const li = document.createElement("li");
    li.className = "mark-item";

    const jump = document.createElement("button");
    jump.className = "ts-btn";
    jump.textContent = fmt(m.time);
    jump.title = "跳到这一句";
    jump.addEventListener("click", () => seekTo(m.time));

    const note = document.createElement("span");
    note.className = "mark-note" + (m.note ? "" : " empty-note");
    note.textContent = m.note || "无备注";

    const del = document.createElement("button");
    del.className = "del";
    del.title = "删除标记";
    del.setAttribute("aria-label", "删除标记");
    del.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    del.addEventListener("click", () => {
      marks.splice(i, 1);
      renderMarks();
      if (!demo) saveMarks();
    });

    li.append(jump, note, del);
    frag.appendChild(li);
  });
  ul.appendChild(frag);
}

async function saveMarks() {
  if (!project || demo) return;
  try {
    await fetch(`/api/project/${project.id}/marks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(marks),
    });
  } catch (_) {
    toast("保存失败，检查后端是否在运行");
  }
}

/* ---------------- export ---------------- */
$("export-btn").addEventListener("click", async () => {
  if (!project) return;
  if (demo) {
    toast("演示模式：导出已禁用");
    return;
  }
  try {
    await saveMarks();
    const res = await fetch(`/api/project/${project.id}/export`);
    if (!res.ok) throw new Error();
    const md = await res.text();
    const blob = new Blob([md], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${project.title || "笔记"}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
    toast("已导出 Markdown");
  } catch (_) {
    toast("导出失败");
  }
});

/* ---------------- keyboard ---------------- */
document.addEventListener("keydown", (e) => {
  if ($("workspace").classList.contains("hidden")) return;

  if (!modal.classList.contains("hidden")) {
    if (e.key === "Escape") closeMarkModal();
    return;
  }

  const tag = e.target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

  if (e.code === "Space") {
    e.preventDefault();
    $("play-btn").click();
  } else if (e.code === "ArrowLeft") {
    e.preventDefault();
    seekTo(currentTime() - 5);
  } else if (e.code === "ArrowRight") {
    e.preventDefault();
    seekTo(currentTime() + 5);
  } else if (e.key === "m" || e.key === "M") {
    e.preventDefault();
    openMarkModal();
  } else if (e.key === "Escape") {
    closeMarkModal();
  }
});

/* ---------------- demo mode ---------------- */
const DEMO_PROJECT = {
  id: "demo",
  title: "深度工作 · 第 3 章 远离社交媒体",
  sentences: [
    { start: 0, end: 38, text: "这一章我们讨论一个反直觉的观点：越是知识工作者，越需要主动远离那些让人分心的工具。" },
    { start: 38, end: 95, text: "这里说的远离，不是彻底戒断，而是按需使用——把工具当作服务目标的仆人，而不是反过来。" },
    { start: 95, end: 150, text: "判断一个工具是否值得使用的第一条标准，是它对你的核心目标有没有实质帮助。" },
    { start: 150, end: 205, text: "大多数社交媒体产品，其商业模式建立在争夺注意力上，这与深度工作的要求天然冲突。" },
    { start: 205, end: 260, text: "你可能会说，我用它来获取信息、维系人脉。但问题在于，投入的时间往往远超预期。" },
    { start: 260, end: 330, text: "我的建议是做一个三十天的实验：停用所有非必要的社交工具，观察生活的变化。" },
    { start: 330, end: 390, text: "这三十天里，不要删除账号，只是不用。否则你会把精力花在纠结上，而不是观察上。" },
    { start: 390, end: 450, text: "实验结束后，再问自己两个问题：这期间我的生活是否明显变差？别人是否真的在意我消失？" },
    { start: 450, end: 520, text: "如果答案都是否定的，那你就有充分理由把它们永久地请出生活。" },
    { start: 520, end: 600, text: "接下来，把省下来的时间投入到高价值、高强度的深度工作中。" },
    { start: 600, end: 680, text: "你会发现，注意力像肌肉一样，是可以被训练和恢复的。" },
    { start: 680, end: 760, text: "另一个实用的方法，是给每一段时间设定明确的产出目标，而不是模糊的待办清单。" },
    { start: 760, end: 840, text: "当你知道这两小时要写完什么，分心的诱惑就会小很多。" },
    { start: 840, end: 920, text: "最后，请记住：注意力是你最稀缺的资源，也是这个时代最被低估的资产。" },
    { start: 920, end: 1000, text: "把它的分配权牢牢握在自己手里，而不是交给算法的推荐流。" },
    { start: 1000, end: 1122, text: "下一章，我们会谈如何设计一套属于自己的深度工作仪式。" },
  ],
  marks: [
    { time: 96, note: "判断标准：对核心目标有没有实质帮助。" },
    { time: 372, note: "工具应该服务于目标，而不是反过来。" },
    { time: 512, note: "30 天实验：不删除，只是不用。" },
  ],
};

if (demo) {
  project = DEMO_PROJECT;
  marks = DEMO_PROJECT.marks.slice();
  $("upload-panel").classList.add("hidden");
  $("workspace").classList.remove("hidden");
  $("proj-title").textContent = DEMO_PROJECT.title;
  $("dur-time").textContent = "18:42";
  progress.max = 1122;
  renderTranscript();
  renderMarks();
  setDemoTime(372);
  setPlaying(true);
  // 截图/演示时，等布局完成再定位一次
  requestAnimationFrame(() => highlight(372, true));
}
