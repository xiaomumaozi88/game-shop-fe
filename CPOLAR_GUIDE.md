# 使用 cpolar 内网穿透本项目

本项目开发服务器运行在 `localhost:3000`，使用 cpolar 可以将其暴露到公网，方便远程访问和测试。

## 前置条件

1. 已安装 cpolar（✅ 已检测到已安装）
2. 已启动项目开发服务器（`npm start` 或 `npm run dev`）

## 使用方法

### 方式一：穿透前端开发服务器（端口 3000）

1. **启动开发服务器**

```bash
npm start
# 或
npm run dev
```

服务器将在 `http://localhost:3000` 启动。

2. **使用 cpolar 创建隧道**

在另一个终端中运行：

```bash
# 创建 HTTP 隧道，映射本地 3000 端口
cpolar http 3000
```

3. **获取公网地址**

cpolar 会输出类似以下的信息：
```
Forwarding  https://xxxxx.cpolar.io -> http://localhost:3000
```

现在你可以通过这个 `https://xxxxx.cpolar.io` 地址在公网访问你的开发服务器。

### 方式二：使用自定义域名（需要注册 cpolar 账号）

如果你有 cpolar 账号，可以使用自定义域名：

```bash
# 使用自定义域名（需要先登录 cpolar）
cpolar http 3000 -subdomain=your-custom-name
```

### 方式三：如果需要同时穿透前端和后端

如果你的项目需要后端 API 服务器（通常在 4242 端口），可以创建两个隧道：

**终端 1 - 穿透前端：**
```bash
cpolar http 3000
```

**终端 2 - 穿透后端：**
```bash
cpolar http 4242
```

## 注意事项

1. **免费版本限制**：
   - 免费版 cpolar 的 URL 会在每次启动时变化
   - 免费版有流量和时间限制

2. **开发服务器配置**：
   - webpack 配置中已设置 `host: '0.0.0.0'`，允许外部访问
   - 无需修改配置即可使用 cpolar

3. **HTTPS**：
   - cpolar 提供的公网地址默认使用 HTTPS
   - 如果遇到证书警告，可以正常继续访问（这是 cpolar 的临时证书）

4. **停止隧道**：
   - 在运行 cpolar 的终端中按 `Ctrl+C` 即可停止隧道

## 常见问题

**Q: 无法访问公网地址？**
A: 确保：
- 开发服务器正在运行（`npm start`）
- cpolar 隧道已成功创建
- 防火墙允许相关端口

**Q: 如何保持 URL 不变？**
A: 需要：
- 注册 cpolar 账号
- 使用付费版本或配置固定域名

**Q: 性能如何？**
A: cpolar 免费版适合开发和测试，不适合生产环境。生产环境建议使用专业的内网穿透服务或部署到云服务器。

