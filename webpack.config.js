const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const Dotenv = require('dotenv-webpack');

const devServerPort = 3000;
const name = '游戏商店';

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  const analyze = process.env.ANALYZE === 'true';

  return {
    entry: './src/index.tsx',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: isProduction ? 'js/[name].[contenthash:8].js' : 'js/[name].js',
      chunkFilename: isProduction
        ? 'js/[name].[contenthash:8].chunk.js'
        : 'js/[name].chunk.js',
      clean: true,
      publicPath: '/',
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@/components': path.resolve(__dirname, 'src/components'),
        '@/pages': path.resolve(__dirname, 'src/pages'),
        '@/store': path.resolve(__dirname, 'src/store'),
        '@/hooks': path.resolve(__dirname, 'src/hooks'),
        '@/utils': path.resolve(__dirname, 'src/utils'),
        '@/types': path.resolve(__dirname, 'src/types'),
        '@/styles': path.resolve(__dirname, 'src/styles'),
        '@/assets': path.resolve(__dirname, 'src/assets'),
      },
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: [
            {
              loader: 'babel-loader',
              options: {
                presets: [
                  '@babel/preset-env',
                  '@babel/preset-react',
                  '@babel/preset-typescript',
                ],
              },
            },
          ],
          exclude: /node_modules/,
        },
        {
          test: /\.less$/,
          use: [
            'style-loader',
            {
              loader: 'css-loader',
              options: {
                modules: {
                  localIdentName: isProduction
                    ? '[hash:base64:8]'
                    : '[local]--[hash:base64:5]',
                  auto: (resourcePath) => {
                    // 使用 CSS Modules 的文件需要包含 .module.less
                    return resourcePath.includes('.module.less');
                  },
                },
                importLoaders: 2,
              },
            },
            'postcss-loader',
            {
              loader: 'less-loader',
              options: {
                lessOptions: {
                  javascriptEnabled: true,
                },
              },
            },
          ],
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader', 'postcss-loader'],
        },
        {
          test: /\.(png|jpg|jpeg|gif|svg|webp)$/i,
          type: 'asset',
          parser: {
            dataUrlCondition: {
              maxSize: 8 * 1024, // 8KB
            },
          },
          generator: {
            filename: 'img/[name].[hash:8][ext]',
          },
        },
        {
          test: /\.(woff|woff2|eot|ttf|otf)$/i,
          type: 'asset/resource',
          generator: {
            filename: 'fonts/[name].[hash:8][ext]',
          },
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './public/index.html',
        title: name,
        inject: true,
        minify: isProduction
          ? {
              removeComments: true,
              collapseWhitespace: true,
              removeRedundantAttributes: true,
              removeScriptTypeAttributes: true,
              removeStyleLinkTypeAttributes: true,
              useShortDoctype: true,
            }
          : false,
      }),
      // 将 public 下的静态文件（favicon、政策页等）复制到 dist，排除 index.html（由 HtmlWebpackPlugin 生成）
      new CopyPlugin({
        patterns: [
          {
            from: path.resolve(__dirname, 'public'),
            to: '.',
            globOptions: { ignore: ['**/index.html'] },
          },
        ],
      }),
      // 使用 dotenv-webpack 加载 .env 文件
      // dotenv-webpack 会自动将所有环境变量注入到 DefinePlugin 中
      // 注意：不要在 DefinePlugin 中重复定义相同的环境变量，否则会产生冲突
      new Dotenv({
        path: './.env', // 默认路径
        safe: false, // 如果 .env 文件不存在也不报错
        systemvars: true, // 同时读取系统环境变量
        silent: false, // 不静默，显示警告
      }),
      // DefinePlugin 只定义 NODE_ENV 等特殊变量
      // 其他环境变量（REACT_APP_*）由 dotenv-webpack 自动处理，不要在这里重复定义
      new webpack.DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify(argv.mode || 'development'),
      }),
      ...(analyze ? [new BundleAnalyzerPlugin()] : []),
    ],
    devServer: {
      port: devServerPort,
      host: '0.0.0.0', // 允许外部访问，用于内网穿透
      open: true,
      hot: true,
      historyApiFallback: {
        // 启用 HTML5 History API 回退
        index: '/index.html',
        disableDotRule: true,
        htmlAcceptHeaders: ['text/html', 'application/xhtml+xml'],
      },
      allowedHosts: 'all', // 允许所有 Host 头，用于内网穿透（如 cpolar）
      client: {
        overlay: {
          warnings: false,
          errors: true,
        },
      },
      compress: true,
      // 代理 API 请求到后端服务器
      proxy: {
        '/api': {
          target: 'http://localhost:4242',
          changeOrigin: true,
          secure: false,
        },
      },
    },
    optimization: {
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          libs: {
            name: 'chunk-libs',
            test: /[\\/]node_modules[\\/]/,
            priority: 10,
            chunks: 'initial',
          },
          react: {
            name: 'chunk-react',
            test: /[\\/]node_modules[\\/](react|react-dom|react-router)[\\/]/,
            priority: 20,
            chunks: 'all',
          },
          commons: {
            name: 'chunk-commons',
            test: path.resolve(__dirname, 'src/components'),
            minChunks: 2,
            priority: 5,
            reuseExistingChunk: true,
            chunks: 'all',
          },
        },
      },
      runtimeChunk: 'single',
      usedExports: true,
      sideEffects: false,
    },
    devtool: isProduction ? 'source-map' : 'eval-cheap-module-source-map',
    performance: {
      hints: isProduction ? 'warning' : false,
      maxEntrypointSize: 512000,
      maxAssetSize: 512000,
    },
  };
};

