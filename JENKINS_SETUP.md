# Jenkins + Git + Docker CI/CD 部署指南

## 一、基础设施准备

### 1.1 服务器要求

#### Jenkins 服务器
- **CPU**: 2-4 核
- **内存**: 4-8GB
- **磁盘**: 50-100GB SSD
- **操作系统**: Ubuntu 20.04/22.04 LTS

#### Docker Registry (可选，如自建 Harbor)
- **CPU**: 2 核
- **内存**: 4GB
- **磁盘**: 100GB+
- 或使用云服务：Docker Hub, AWS ECR, Harbor

#### 生产服务器
- **CPU**: 根据业务需求
- **内存**: 根据业务需求
- **操作系统**: 支持 Docker

### 1.2 软件安装

#### 在 Jenkins 服务器安装 Docker

```bash
# 安装 Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 启动 Docker
sudo systemctl start docker
sudo systemctl enable docker

# 安装 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 验证安装
docker --version
docker-compose --version
```

#### 安装 Jenkins

```bash
# Ubuntu/Debian
wget -q -O - https://pkg.jenkins.io/debian/jenkins.io.key | sudo apt-key add -
sudo sh -c 'echo deb http://pkg.jenkins.io/debian-stable binary/ > /etc/apt/sources.list.d/jenkins.list'
sudo apt update
sudo apt install jenkins openjdk-11-jdk

# 启动 Jenkins
sudo systemctl start jenkins
sudo systemctl enable jenkins

# 将 Jenkins 用户加入 docker 组
sudo usermod -aG docker jenkins
sudo systemctl restart jenkins

# 查看初始密码
sudo cat /var/lib/jenkins/secrets/initialAdminPassword
```

访问 `http://your-jenkins-server-ip:8080` 完成初始配置。

## 二、Jenkins 配置

### 2.1 安装必要插件

在 Jenkins 管理界面 → 插件管理 → 可用插件中安装：

- ✅ **Git Plugin** (通常已安装)
- ✅ **Docker Pipeline Plugin**
- ✅ **Docker Plugin**
- ✅ **Pipeline Plugin** (Jenkinsfile 支持)
- ✅ **Pipeline: Stage View Plugin**
- ✅ **Blue Ocean** (可选，现代化 UI)
- ✅ **GitLab Plugin** (如果使用 GitLab)
- ✅ **GitHub Plugin** (如果使用 GitHub)
- ✅ **Credentials Binding Plugin**
- ✅ **SSH Pipeline Steps** (如果使用 SSH 部署)

### 2.2 配置 Docker Registry 凭证

1. 进入 **Jenkins 管理** → **凭证管理** → **系统** → **全局凭证**
2. 添加凭证：
   - **类型**: Username with password
   - **范围**: Global
   - **用户名**: Docker Registry 用户名
   - **密码**: Docker Registry 密码
   - **ID**: `docker-registry-credentials` (与 Jenkinsfile 中的 ID 一致)
   - **描述**: Docker Registry Credentials

### 2.3 配置 Git 凭证（如果需要）

如果 Git 仓库需要认证：

1. 添加 SSH 密钥或用户名密码凭证
2. 记录凭证 ID，在 Jenkinsfile 中使用

### 2.4 配置 Jenkins 节点（如果有多台服务器）

1. **Jenkins 管理** → **节点管理** → **新建节点**
2. 配置节点：
   - **名称**: prod-server
   - **类型**: Permanent Agent
   - **远程根目录**: `/var/jenkins`
   - **标签**: production
   - **用法**: Only build jobs with label expressions matching this node
   - **启动方式**: Launch agents via SSH
   - **主机**: 生产服务器 IP
   - **凭证**: 添加 SSH 凭证

## 三、Git 仓库配置

### 3.1 在 Git 仓库中添加 Webhook

#### GitLab 配置

1. 进入项目 → **Settings** → **Webhooks**
2. 添加 Webhook：
   - **URL**: `http://your-jenkins-server:8080/project/game-shop-fe` (Jenkins 任务名)
   - **Trigger**: Push events, Merge request events
   - **Secret token**: (可选，增加安全性)

#### GitHub 配置

1. 进入项目 → **Settings** → **Webhooks**
2. 添加 Webhook：
   - **Payload URL**: `http://your-jenkins-server:8080/github-webhook/`
   - **Content type**: `application/json`
   - **Events**: Push, Pull request

### 3.2 确保 Jenkinsfile 在仓库中

确保项目的 `Jenkinsfile` 在仓库根目录。

## 四、创建 Jenkins Pipeline 任务

### 4.1 新建 Pipeline 任务

1. 点击 **新建任务**
2. 输入任务名称，例如: `game-shop-fe`
3. 选择 **流水线** (Pipeline)
4. 点击 **确定**

### 4.2 配置 Pipeline

在 Pipeline 配置中：

1. **定义**: Pipeline script from SCM
2. **SCM**: Git
3. **Repository URL**: 你的 Git 仓库地址
4. **Credentials**: 选择 Git 凭证（如果需要）
5. **分支**: `*/main` 或 `*/master` (根据需要)
6. **脚本路径**: `Jenkinsfile` (如果 Jenkinsfile 在根目录)

### 4.3 构建触发器

- ✅ **GitHub hook trigger for GITScm polling** (如果使用 GitHub)
- ✅ **Build when a change is pushed to GitLab** (如果使用 GitLab)
- ✅ **Poll SCM**: `H/5 * * * *` (每 5 分钟检查一次，作为备用)

## 五、部署流程

### 5.1 本地开发流程

```bash
# 1. 开发功能
git checkout -b feature/new-feature
# ... 开发代码 ...

# 2. 提交代码
git add .
git commit -m "feat: add new feature"
git push origin feature/new-feature

# 3. 创建 Merge Request / Pull Request
# Jenkins 会在 MR/PR 创建时触发构建和测试
```

### 5.2 合并到主分支

```bash
# 合并到 main/master 分支后
# Jenkins 会自动：
# 1. 检出代码
# 2. 运行测试和代码检查
# 3. 构建 Docker 镜像
# 4. 推送镜像到 Registry
# 5. 部署到生产环境（如果配置了）
```

### 5.3 手动触发构建

在 Jenkins 任务页面点击 **立即构建**。

## 六、Docker Registry 选择

### 6.1 使用 Docker Hub

```bash
# 在 Jenkinsfile 中设置
DOCKER_REGISTRY = 'docker.io'  # 或直接省略
DOCKER_IMAGE_NAME = 'your-username/game-shop-fe'
```

### 6.2 使用 Harbor (推荐，企业级)

```bash
# 安装 Harbor
# 参考: https://goharbor.io/docs/2.5.0/install-config/

# 在 Jenkinsfile 中设置
DOCKER_REGISTRY = 'harbor.example.com'
DOCKER_IMAGE_NAME = 'project/game-shop-fe'
```

### 6.3 使用 AWS ECR

```bash
# 在 Jenkinsfile 中需要额外的 AWS 认证步骤
# 需要安装 AWS CLI 插件
```

## 七、生产部署

### 7.1 使用 Docker Compose 部署

在生产服务器上：

```bash
# 1. 拉取最新镜像
docker pull your-registry.com/game-shop-fe:latest-prod

# 2. 停止旧容器
docker-compose down

# 3. 更新 docker-compose.yml 中的镜像标签

# 4. 启动新容器
docker-compose up -d
```

### 7.2 使用 Kubernetes 部署

如果使用 K8s，需要在 Jenkinsfile 中添加 kubectl 部署步骤：

```groovy
stage('Deploy to K8s') {
    steps {
        sh """
            kubectl set image deployment/game-shop-fe \
                game-shop-fe=${env.DOCKER_IMAGE} \
                -n production
        """
    }
}
```

### 7.3 使用 SSH 部署

在 Jenkinsfile 的 Deploy 阶段添加 SSH 步骤：

```groovy
stage('Deploy') {
    steps {
        sshagent(['ssh-credentials-id']) {
            sh """
                ssh user@prod-server "
                    docker pull ${env.DOCKER_IMAGE} && \
                    docker stop game-shop-fe || true && \
                    docker rm game-shop-fe || true && \
                    docker run -d --name game-shop-fe -p 80:80 ${env.DOCKER_IMAGE}
                "
            """
        }
    }
}
```

## 八、监控和通知

### 8.1 邮件通知

在 Jenkinsfile 的 `post` 部分添加：

```groovy
post {
    failure {
        emailext(
            subject: "构建失败: ${env.JOB_NAME} - ${env.BUILD_NUMBER}",
            body: "构建失败，请检查: ${env.BUILD_URL}",
            to: "team@example.com"
        )
    }
}
```

### 8.2 Slack 通知

安装 **Slack Notification Plugin**，在 `post` 部分添加：

```groovy
post {
    success {
        slackSend(
            channel: '#deployments',
            color: 'good',
            message: "✅ 构建成功: ${env.JOB_NAME} #${env.BUILD_NUMBER}"
        )
    }
}
```

## 九、安全最佳实践

1. **使用凭证管理**: 不要在代码中硬编码密码
2. **最小权限原则**: Jenkins 用户只给予必要的权限
3. **定期更新**: 保持 Jenkins、Docker 等软件更新
4. **网络隔离**: Jenkins 服务器应放在内网，限制外网访问
5. **日志审计**: 定期检查 Jenkins 构建日志
6. **镜像扫描**: 使用工具扫描 Docker 镜像漏洞（如 Trivy）

## 十、故障排查

### 常见问题

1. **Docker 命令权限不足**
   ```bash
   sudo usermod -aG docker jenkins
   sudo systemctl restart jenkins
   ```

2. **Git 拉取失败**
   - 检查 Git 凭证是否正确
   - 检查网络连接
   - 检查仓库权限

3. **Docker 推送失败**
   - 检查 Registry 凭证
   - 检查网络连接
   - 检查镜像名称格式

4. **构建超时**
   - 增加 Jenkins 构建超时时间
   - 优化 Dockerfile，使用多阶段构建

## 十一、成本估算（参考）

### 最低配置（小团队）

- **Jenkins 服务器**: 1 台 (2核4G, ¥200/月)
- **Docker Registry**: 使用 Docker Hub 免费版 或 Harbor (1台服务器, ¥200/月)
- **总计**: 约 ¥400/月

### 中等配置（中等团队）

- **Jenkins 服务器**: 1 台 (4核8G, ¥400/月)
- **Docker Registry**: Harbor (2核4G, ¥200/月)
- **Git 服务器**: GitLab (2核4G, ¥200/月，或使用云服务)
- **总计**: 约 ¥800/月

## 十二、进阶优化

1. **使用 Jenkins Shared Libraries**: 复用通用 Pipeline 代码
2. **并行构建**: 加快构建速度
3. **构建缓存**: 使用 Docker BuildKit 缓存
4. **多环境部署**: Dev → Test → Staging → Prod
5. **回滚机制**: 自动回滚失败的部署
6. **性能监控**: 集成 Prometheus + Grafana

## 快速开始检查清单

- [ ] 安装 Jenkins 服务器
- [ ] 安装 Docker 和 Docker Compose
- [ ] 配置 Jenkins 插件
- [ ] 配置 Docker Registry 凭证
- [ ] 创建 Jenkinsfile
- [ ] 创建 Dockerfile
- [ ] 配置 Git Webhook
- [ ] 创建 Jenkins Pipeline 任务
- [ ] 测试构建流程
- [ ] 配置生产部署

