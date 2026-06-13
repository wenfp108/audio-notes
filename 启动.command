#!/bin/bash
# 双击即可启动「音视频笔记工具」。
# 它会:1) 进入项目目录  2) 激活 Python 环境  3) 启动后端  4) 自动打开浏览器
# 想关闭服务:回到这个黑色终端窗口,按 Control + C,或直接关掉窗口。

# 切到脚本所在目录(无论从哪里双击都对)
cd "$(dirname "$0")" || exit 1

echo "================================================"
echo "  音视频笔记工具 正在启动…"
echo "================================================"
echo ""

# 1. 检查虚拟环境在不在
if [ ! -d ".venv" ]; then
    echo "✗ 没找到 Python 环境 (.venv)。"
    echo "  请先在终端里运行:"
    echo "    cd \"$(pwd)\""
    echo "    python3 -m venv .venv"
    echo "    source .venv/bin/activate"
    echo "    pip install -r requirements.txt"
    echo ""
    echo "按回车键关闭本窗口。"
    read -r
    exit 1
fi

# 2. 激活环境
source .venv/bin/activate

# 3. 选一个没被占用的端口(优先 8000,被占就往后找)
PORT=8000
while lsof -nP -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; do
    PORT=$((PORT + 1))
done

URL="http://localhost:$PORT"
echo "✓ 环境就绪,服务地址:$URL"
echo ""
echo "  浏览器会自动打开。如果没打开,手动复制上面这个地址到浏览器。"
echo "  ⚠️ 第一次上传对齐时要下载模型并计算,会等一会儿,属正常。"
echo ""
echo "  【关闭服务】回到本窗口按 Control + C,或直接关掉这个窗口。"
echo "================================================"
echo ""

# 4. 过几秒自动打开浏览器(等后端起来)
( sleep 3 && open "$URL" ) &

# 5. 启动后端(前台运行,日志显示在本窗口)
cd backend
exec uvicorn main:app --port "$PORT"
