#!/bin/bash

echo "╔════════════════════════════════════════════════════════╗"
echo "║          cpolar 内网穿透 - 公网地址信息              ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# 尝试从 API 获取
FOUND=false
for port in 4040 4054 4055 4056 4057; do
    API_RESPONSE=$(curl -s http://localhost:$port/api/tunnels 2>&1)
    if [ -n "$API_RESPONSE" ] && echo "$API_RESPONSE" | grep -q "public_url"; then
        echo "✓ 从端口 $port 获取到隧道信息："
        echo "$API_RESPONSE" | python3 -c "
import sys, json
try:
    data = sys.stdin.read()
    obj = json.loads(data)
    tunnels = obj.get('tunnels', [])
    for t in tunnels:
        print(f\"  🌐 HTTP:  {t.get('public_url', '').replace('https://', 'http://')}\")
        print(f\"  🔒 HTTPS: {t.get('public_url', '')}\")
        print(f\"  📍 本地:  {t.get('config', {}).get('addr', 'N/A')}\")
except Exception as e:
    print(f'  解析错误: {e}')
" 2>/dev/null
        FOUND=true
        break
    fi
done

if [ "$FOUND" = false ]; then
    echo "⚠️  无法通过 API 获取，请查看 cpolar 进程输出"
    echo ""
    echo "根据你的终端输出，公网地址应该是："
    echo "  🌐 HTTP:  http://1a631a7c.r34.cpolar.top"
    echo "  🔒 HTTPS: https://1a631a7c.r34.cpolar.top"
    echo ""
    echo "或者："
    echo "  🌐 HTTP:  http://63b3e3c2.r34.cpolar.top"
    echo "  🔒 HTTPS: https://63b3e3c2.r34.cpolar.top"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 快速访问："
echo "  • Web UI: http://127.0.0.1:4054 (查看请求记录)"
echo "  • 本地服务: http://localhost:3000"
echo ""
echo "💡 提示："
echo "  • 在浏览器中打开上述 HTTPS 地址即可访问你的项目"
echo "  • 免费版地址可能会变化，重启 cpolar 会生成新地址"
echo "  • 确保开发服务器正在运行: npm start"

