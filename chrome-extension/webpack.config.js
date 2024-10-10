const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    entry: {
      background: './src/js/background.js',
      constants: './src/js/constants.js',
      content: './src/js/content.js',
      'github-service': './src/js/github-service.js',
      options: './src/js/options.js',
      popup: './src/js/popup.js',
      publish: './src/js/publish.js'
    },
    output: {
      filename: 'js/[name].bundle.js',
      path: path.resolve(__dirname, 'dist'),
      clean: true
    },
    mode: isProduction ? 'production' : 'development',
    devtool: isProduction ? false : 'source-map',
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env'],
              plugins: ['@babel/plugin-syntax-dynamic-import']
            }
          }
        }
      ]
    },
    plugins: [
      new CopyPlugin({
        patterns: [
          { from: "src/manifest.json", to: "manifest.json" },
          { from: "src/html", to: "html" },
          { from: "src/css", to: "css" },
          { from: "src/assets", to: "assets" },
        ],
      }),
    ],
  };
};