pipeline {
    agent any
    
    environment {
        // Docker 镜像仓库配置（根据实际情况修改）
        DOCKER_REGISTRY = 'your-registry.com'  // 或 'harbor.example.com' 或 'docker.io'
        DOCKER_IMAGE_NAME = 'game-shop-fe'
        DOCKER_CREDENTIALS_ID = 'docker-registry-credentials'  // Jenkins 中配置的凭证 ID
        
        // 根据分支选择环境
        BUILD_ENV = "${env.BRANCH_NAME == 'main' ? 'prod' : 'test'}"
        IMAGE_TAG = "${env.BUILD_NUMBER}-${env.GIT_COMMIT.take(7)}"
    }
    
    stages {
        // 阶段 1: 检出代码
        stage('Checkout') {
            steps {
                checkout scm
                script {
                    // 获取 Git 信息
                    env.GIT_COMMIT_SHORT = sh(
                        script: 'git rev-parse --short HEAD',
                        returnStdout: true
                    ).trim()
                }
                echo "构建环境: ${BUILD_ENV}"
                echo "Git Commit: ${env.GIT_COMMIT_SHORT}"
            }
        }
        
        // 阶段 2: 安装依赖并运行测试/代码检查
        stage('Test & Lint') {
            steps {
                script {
                    sh '''
                        echo "安装依赖..."
                        npm ci
                        
                        echo "运行代码检查..."
                        npm run lint || true  # 暂时允许失败，后续可改为强制
                        
                        echo "检查代码格式..."
                        npm run format:check || true
                    '''
                }
            }
        }
        
        // 阶段 3: 构建 Docker 镜像
        stage('Build Docker Image') {
            steps {
                script {
                    def imageName = "${DOCKER_REGISTRY}/${DOCKER_IMAGE_NAME}:${IMAGE_TAG}"
                    def imageNameLatest = "${DOCKER_REGISTRY}/${DOCKER_IMAGE_NAME}:latest-${BUILD_ENV}"
                    
                    echo "构建 Docker 镜像: ${imageName}"
                    
                    sh """
                        docker build \
                            --build-arg BUILD_ENV=${BUILD_ENV} \
                            -t ${imageName} \
                            -t ${imageNameLatest} \
                            .
                    """
                    
                    // 保存镜像名称供后续使用
                    env.DOCKER_IMAGE = imageName
                    env.DOCKER_IMAGE_LATEST = imageNameLatest
                }
            }
        }
        
        // 阶段 4: 推送镜像到 Registry
        stage('Push Image') {
            steps {
                script {
                    withCredentials([
                        usernamePassword(
                            credentialsId: "${DOCKER_CREDENTIALS_ID}",
                            usernameVariable: 'DOCKER_USER',
                            passwordVariable: 'DOCKER_PASS'
                        )
                    ]) {
                        sh """
                            echo '${DOCKER_PASS}' | docker login ${DOCKER_REGISTRY} -u '${DOCKER_USER}' --password-stdin
                            docker push ${env.DOCKER_IMAGE}
                            docker push ${env.DOCKER_IMAGE_LATEST}
                            docker logout ${DOCKER_REGISTRY}
                        """
                    }
                }
            }
        }
        
        // 阶段 5: 部署到服务器（根据实际情况选择）
        stage('Deploy') {
            when {
                // 只有主分支或特定分支才部署
                anyOf {
                    branch 'main'
                    branch 'master'
                    branch 'test'
                }
            }
            steps {
                script {
                    if (env.BRANCH_NAME == 'main' || env.BRANCH_NAME == 'master') {
                        echo "部署到生产环境..."
                        // 部署到生产服务器的命令
                        // ssh 或 kubectl 命令
                        sh """
                            # 示例：SSH 到服务器并部署
                            # ssh user@prod-server "
                            #     docker pull ${env.DOCKER_IMAGE} && \
                            #     docker stop game-shop-fe || true && \
                            #     docker rm game-shop-fe || true && \
                            #     docker run -d --name game-shop-fe -p 80:80 ${env.DOCKER_IMAGE}
                            # "
                        """
                    } else {
                        echo "部署到测试环境..."
                        // 部署到测试服务器的命令
                    }
                }
            }
        }
    }
    
    post {
        // 构建成功后的操作
        success {
            echo "构建成功！镜像: ${env.DOCKER_IMAGE}"
            // 可以发送通知，如邮件、Slack 等
        }
        
        // 构建失败后的操作
        failure {
            echo "构建失败！"
            // 可以发送失败通知
        }
        
        // 无论成功或失败都执行
        always {
            // 清理本地 Docker 镜像（可选）
            sh """
                docker rmi ${env.DOCKER_IMAGE} || true
                docker rmi ${env.DOCKER_IMAGE_LATEST} || true
            """
            
            // 清理构建产物
            cleanWs()
        }
    }
}

