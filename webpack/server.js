var path = require('path');
var webpack = require('webpack');
var nodeExternals = require('webpack-node-externals');
var CopyWebpackPlugin = require('copy-webpack-plugin');



module.exports = {

  // mode: 'none',
  target: 'node',
  devtool: 'source-map',
  node: {
    __dirname: true,
    __filename: true,
  },
  entry: {

    'app': './src/app.js'


  },
  output: {
    path: path.join(__dirname, '../dist'),
    filename: '[name].js',
    // libraryTarget:'commonjs2'

  },
  module: {
    rules: [


      {
        test: /\.js$/,
        loader: 'babel-loader',
        //exclude: /node_modules/
      },


    ]
  },
  //externals: [/^(?!\.|\/).+/i,],
  externals: [nodeExternals()],
  plugins: [
    new webpack.DefinePlugin({
      'process.env': { NODE_ENV: JSON.stringify(process.env.NODE_ENV || "development"),MNEMONIC: JSON.stringify(process.env.MNEMONIC),DISCORD_TOKEN:JSON.stringify(process.env.DISCORD_TOKEN),DISCORD_CLIENT_ID:JSON.stringify(process.env.DISCORD_CLIENT_ID),RPC_WSS:JSON.stringify(process.env.RPC_WSS)}
    }),

    new webpack.optimize.LimitChunkCountPlugin({
      maxChunks: 1,
    }),

    // new CopyWebpackPlugin({
    //   // {
    //   //   context: 'src/www/favicon',
    //   //   from: '**/*',
    //   //   to: './www/favicon'
    //   // },

    //   patterns: [{
    //     context: 'src/server/ssr',
    //     from: '**/*.html',
    //     to: './ssr'
    //   }]


    // }),


  ]
};
