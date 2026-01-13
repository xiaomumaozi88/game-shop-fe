#!/bin/bash

echo "=== cpolar 公网地址查询 ==="
echo ""

# 方法1: 从进程输出中提取 (最可靠)
echo "方法1: 从 cpolar 进程输出中提取"
ps aux | grep "cpolar http" | grep -v grep | head -1 | grep -oE 'http[s]?://[a-zA-Z0-9.-]+\.cpolar\.top' | head -2 | while read url; do
    echo "  ✓ $url"
done

# 方法2: 通过 API 查询各个可能的端口
echo ""
echo "方法2: 通过 API 查询"
for port in 4040 4054 4055 4056 4057; do
    API_RESPONSE=$(curl -s http://localhost:$port/api/tunnels 2>&1)
    if echo "$API_RESPONSE" | grep -q "public_url"; then
        echo "  端口 $port:"
        echo "$API_RESPONSE" | python3 -c "
import sys, json
try:
    data = sys.stdin.read()
    if data:
        obj = json.loads(data)
        tunnels = obj.get('tunnels', [])
        for t in tunnels:
            print(f\"    公网地址: {t.get('public_url', 'N/A')}\")
            print(f\"    本地地址: {t.get('local_url', 'N/A')}\")
except:
    pass
" 2>/dev/null
        break
    fi
done

# 方法3: 检查 Web UI
echo ""
echo "方法3: Web UI 地址"
for port in 4040 4054 4055 4056 4057; do
    if curl -s http://localhost:$port >/dev/null 2>&1; then
        echo "  Web UI: http://127.0.0.1:$port"
        echo "  请在浏览器中打开查看详细信息"
        break
    fi
done

echo ""
echo "提示: 根据你的终端输出，公网地址应该是："
echo "  http://1a631a7c.r34.cpolar.top"
echo "  https://1a631a7c.r34.cpolar.top"
echo ""
echo "或者："
echo "  http://63b3e3c2.r34.cpolar.top"
echo "  https://63b3e3c2.r34.cpolar.top"

