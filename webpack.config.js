const path = require('path');

const web = {
  entry: './src/index.ts',
  mode: 'production',
  resolve: {
    extensions: ['.ts', '.js', '.json'],
  },
  module: {
    rules: [
      { test: /\.ts$/, use: 'ts-loader' },
    ],
  },
  target: 'web',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'web.min.js',
    libraryTarget: 'umd',
    library: 'gateway',
  },
  node: {
    __dirname: true,
    child_process: false,
    fs: 'empty',
    process: 'mock',
    stream: 'empty',
  },
};

module.exports = web;
