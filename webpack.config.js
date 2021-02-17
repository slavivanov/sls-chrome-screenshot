const webpack = require('webpack')
const slsw = require('serverless-webpack')
var CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  devtool: 'source-map',
  target: 'node',
  node: {
    __dirname: true,
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        loader: 'babel-loader',
        exclude: /node_modules/,
        options: {
          cacheDirectory: true,
        },
      },
      // { test: /\.json$/, loader: 'json-loader' },
    ],
  },
  resolve: {
    symlinks: true,
  },
  output: {
    libraryTarget: 'commonjs',
    path: `${__dirname}/.webpack`,
    filename: '[name].js',
  },
  externals: ['aws-sdk', 'chrome-aws-lambda', 'lambdafs'],
  plugins: [
    new webpack.optimize.LimitChunkCountPlugin({
      maxChunks: 1,
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: 'node_modules/chrome-aws-lambda', to: 'node_modules/chrome-aws-lambda' },
        { from: 'node_modules/lambdafs', to: 'node_modules/lambdafs' },
      ]
    })

  ],
  entry: slsw.lib.entries,
}
