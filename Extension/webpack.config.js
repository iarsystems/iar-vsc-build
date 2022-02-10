//@ts-check
"use strict";

const path = require("path");
const webpack = require("webpack");

/**@type {import("webpack").Configuration}*/
const config = {
  target: "node",
  entry: "./src/extension/main.ts",
  output: {
    path: path.resolve(__dirname, "out/src/extension"),
    filename: "main.js",
    libraryTarget: "commonjs2",
    devtoolModuleFilenameTemplate: "../[resource-path]"
  },
  devtool: "source-map",
  externals: {
    vscode: "commonjs vscode"
  },
  resolve: {
    mainFields: ["browser", "module", "main"],
    extensions: [".ts", ".js"],
    alias: {
      // provides alternate implementation for node module and source files
    },
    fallback: {
    }
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: "ts-loader"
          }
        ]
      },
    ]
  }
};
module.exports = config;