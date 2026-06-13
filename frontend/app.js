"use strict";

// ---- 全局状态 ----
let project = null;     // 服务端返回的项目数据
let marks = [];         // [{time, note}]
let curSentenceIdx = -1;

// ---- DOM 速查 ----
const $ = (id) => document.getElementById(id);
const player = $("player");

// ---- 工具函数 ----
function fmt(sec) {
  sec = Math.max(0, Math.floor(sec || 0));
  const m = String(Math.floor(sec / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

// ---- 上传 + 对齐 ----
$("upload-btn").addEventListener("click", async () => {
  const audio = $("audio-file").files[0];
  const transcript = $("transcript-file").files[0];
  const status = $("upload-status");

  if (!audio || !transcript) {
    status.textContent = "请同时选择音频和文稿。";
    return;
  }

  const fd = new FormData();
  fd.append("audio", audio);
  fd.append("transcript", transcript);

  status.textContent = "正在对齐,首次运行需下载模型,可能要几分钟……";
  $("upload-btn").disabled = true;
  try {
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "对齐失败");
    }
    project = await res.json();
    status.textContent = "完成!";
    openWorkspace();
  } catch (e) {
    status.textContent = "出错:" + e.message;
  } finally {
    $("upload-btn").disabled = false;
  }
});

// ---- 进入工作区 ----
function openWorkspace() {
  marks = project.marks || [];
  curSentenceIdx = -1;
  $("proj-title").textContent = project.title || "学习";
  player.src = `/api/audio/${project.id}`;
  $("upload-panel").classList.add("hidden");
  $("workspace").classList.remove("hidden");
  renderTranscript();
  renderMarks();
}

// ---- 渲染文稿 ----
function renderTranscript() {
  const box = $("transcript");
  box.innerHTML = "";
  project.sentences.forEach((s, i) => {
    const div = document.createElement("div");
    div.className = "sentence";
    div.dataset.idx = i;
    div.dataset.start = s.start;
    div.dataset.end = s.end;
    div.innerHTML = `<span class="ts">[${fmt(s.start)}]</span> ${s.text}`;
    div.addEventListener("click", () => {
      player.currentTime = s.start;
      player.play();
    });
    box.appendChild(div);
  });
}

// ---- 播放控制 ----
$("play-btn").addEventListener("click", togglePlay);
function togglePlay() {
  if (player.paused) player.play();
  else player.pause();
}
player.addEventListener("play", () => ($("play-btn").textContent = "⏸ 暂停"));
player.addEventListener("pause", () => ($("play-btn").textContent = "▶ 播放"));

document.querySelectorAll("[data-seek]").forEach((btn) => {
  btn.addEventListener("click", () => {
    player.currentTime = Math.max(0, player.currentTime + Number(btn.dataset.seek));
  });
});

$("speed").addEventListener("change", (e) => {
  player.playbackRate = Number(e.target.value);
});

// ---- 进度条 + 时间同步 ----
player.addEventListener("loadedmetadata", () => {
  $("dur-time").textContent = fmt(player.duration);
  $("progress").max = player.duration || 0;
});

player.addEventListener("timeupdate", () => {
  const t = player.currentTime;
  $("cur-time").textContent = fmt(t);
  if (!$("progress").dragging) $("progress").value = t;
  highlightCurrent(t);
});

const progress = $("progress");
progress.addEventListener("input", () => { progress.dragging = true; });
progress.addEventListener("change", () => {
  player.currentTime = Number(progress.value);
  progress.dragging = false;
});

// ---- 跟读高亮 ----
function highlightCurrent(t) {
  const sents = project.sentences;
  let idx = -1;
  for (let i = 0; i < sents.length; i++) {
    if (t >= sents[i].start && t < (sents[i].end || Infinity)) { idx = i; break; }
    if (t >= sents[i].start) idx = i; // 落在间隙时取最近一句
  }
  if (idx === curSentenceIdx) return;
  curSentenceIdx = idx;
  document.querySelectorAll(".sentence.active").forEach((el) => el.classList.remove("active"));
  if (idx >= 0) {
    const el = document.querySelector(`.sentence[data-idx="${idx}"]`);
    if (el) {
      el.classList.add("active");
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }
}

// ---- 标记 ----
$("mark-btn").addEventListener("click", () => {
  const time = player.currentTime;
  const note = prompt("给这个标记加备注(可留空):", "") || "";
  marks.push({ time, note: note.trim() });
  marks.sort((a, b) => a.time - b.time);
  renderMarks();
  saveMarks();
});

function renderMarks() {
  const ul = $("marks-list");
  ul.innerHTML = "";
  marks.forEach((m, i) => {
    const li = document.createElement("li");
    const jump = document.createElement("button");
    jump.className = "ts-btn";
    jump.textContent = `[${fmt(m.time)}]`;
    jump.addEventListener("click", () => { player.currentTime = m.time; player.play(); });

    const note = document.createElement("span");
    note.textContent = m.note || "(无备注)";

    const del = document.createElement("button");
    del.className = "del";
    del.textContent = "×";
    del.addEventListener("click", () => { marks.splice(i, 1); renderMarks(); saveMarks(); });

    li.append(jump, note, del);
    ul.appendChild(li);
  });
}

async function saveMarks() {
  if (!project) return;
  await fetch(`/api/project/${project.id}/marks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(marks),
  }).catch(() => {});
}

// ---- 导出 ----
$("export-btn").addEventListener("click", async () => {
  await saveMarks();
  const res = await fetch(`/api/project/${project.id}/export`);
  const md = await res.text();
  const blob = new Blob([md], { type: "text/markdown" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${project.title || "笔记"}.md`;
  a.click();
  URL.revokeObjectURL(a.href);
});

// ---- 键盘快捷键 ----
document.addEventListener("keydown", (e) => {
  if ($("workspace").classList.contains("hidden")) return;
  if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
  if (e.code === "Space") { e.preventDefault(); togglePlay(); }
  else if (e.code === "ArrowLeft") { player.currentTime = Math.max(0, player.currentTime - 5); }
  else if (e.code === "ArrowRight") { player.currentTime += 5; }
  else if (e.key === "m" || e.key === "M") { $("mark-btn").click(); }
});
