#!/bin/bash

# 获取 cpolar 公网地址
echo "正在获取 cpolar 隧道信息..."
echo ""

# 检测 cpolar Web UI 端口 (可能是 4040, 4054, 4056 等)
WEB_PORT=""
for port in 4040 4054 4056 4055 4057; do
    if curl -s http://localhost:$port/api/tunnels >/dev/null 2>&1; then
        WEB_PORT=$port
        break
    fi
done

if [ -z "$WEB_PORT" ]; then
    echo "未找到 cpolar Web UI，尝试从进程输出中提取..."
    # 从进程输出中提取
    ps aux | grep "cpolar http" | grep -v grep | head -1
    echo ""
    echo "请查看 cpolar 的输出，公网地址格式类似："
    echo "  http://xxxxx.r34.cpolar.top"
    echo "  https://xxxxx.r34.cpolar.top"
    exit 0
fi

echo "找到 cpolar Web UI 端口: $WEB_PORT"
echo ""

# 方法1: 通过 API
API_RESPONSE=$(curl -s http://localhost:$WEB_PORT/api/tunnels 2>&1)
if [ -n "$API_RESPONSE" ] && echo "$API_RESPONSE" | grep -q "public_url"; then
    echo "=== 通过 API 获取 ==="
    echo "$API_RESPONSE" | python3 -m json.tool 2>/dev/null | grep -A 2 "public_url" || echo "$API_RESPONSE"
    echo ""
fi

# 方法2: 从 Web UI HTML 中提取
HTML_RESPONSE=$(curl -s http://localhost:$WEB_PORT/http/in 2>&1)
if echo "$HTML_RESPONSE" | grep -q "window.data"; then
    echo "=== 从 Web UI 数据中提取 ==="
    # 提取 window.data 中的 JSON
    DATA=$(echo "$HTML_RESPONSE" | grep "window.data" | sed -n 's/.*window.data = JSON.parse("\(.*\)");.*/\1/p')
    if [ -n "$DATA" ]; then
        echo "$DATA" | python3 << 'PYTHON_SCRIPT'
import sys, json
try:
    data = sys.stdin.read()
    # 处理转义字符
    data = data.replace('\\"', '"').replace('\\\\', '\\')
    obj = json.loads(data)
    tunnels = obj.get('UiState', {}).get('Tunnels', [])
    if tunnels:
        for t in tunnels:
            print(f"公网地址: {t.get('PublicUrl', 'N/A')}")
            print(f"本地地址: {t.get('LocalUrl', 'N/A')}")
    else:
        print('隧道列表为空，可能还在建立中...')
        print('请访问 http://127.0.0.1:4040 查看详细信息')
except Exception as e:
    print(f'解析错误: {e}')
    if 'data' in locals():
        print('原始数据:', data[:200])
PYTHON_SCRIPT
    fi
    echo ""
fi

# 方法3: 检查进程状态
echo "=== cpolar 进程状态 ==="
ps aux | grep "cpolar http" | grep -v grep | head -2
echo ""

# 方法4: 检查端口
echo "=== 端口监听状态 ==="
echo "本地开发服务器:"
lsof -i :3000 | grep LISTEN || echo "  端口 3000 未监听"
echo "cpolar Web UI:"
lsof -i :4040 | grep LISTEN || echo "  端口 4040 未监听"
echo ""

echo "提示: 如果看不到公网地址，请："
echo "1. 访问 http://127.0.0.1:$WEB_PORT 查看 Web 界面"
echo "2. 等待几秒让隧道完全建立"
echo "3. 确保开发服务器正在运行 (npm start)"
echo ""
echo "或者直接查看 cpolar 进程的输出，应该会显示类似："
echo "  Forwarding  http://xxxxx.r34.cpolar.top -> http://localhost:3000"
echo "  Forwarding  https://xxxxx.r34.cpolar.top -> http://localhost:3000"

