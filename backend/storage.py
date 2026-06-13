"""项目数据的本地 JSON 存取。

每个项目一个文件夹:data/<project_id>/
  - audio.<ext>        统一转码后的音频
  - project.json       句子+时间戳、标记、元信息
"""
import json
import time
import uuid
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def new_project_id() -> str:
    return time.strftime("%Y%m%d-%H%M%S-") + uuid.uuid4().hex[:6]


def project_dir(project_id: str) -> Path:
    d = DATA_DIR / project_id
    d.mkdir(parents=True, exist_ok=True)
    return d


def save(project_id: str, data: dict) -> None:
    path = project_dir(project_id) / "project.json"
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def load(project_id: str) -> dict:
    path = project_dir(project_id) / "project.json"
    if not path.exists():
        raise FileNotFoundError(f"找不到项目:{project_id}")
    return json.loads(path.read_text(encoding="utf-8"))
