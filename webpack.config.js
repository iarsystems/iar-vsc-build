//@ts-check
"use strict";

const path = require("path");
const webpack = require("webpack");
const copyPlugin = require("copy-webpack-plugin")

/**@type {webpack.Configuration}*/
const extensionConfig = {
  name: "extension",
  target: "node",
  entry: "./src/extension/main.ts",
  output: {
    path: path.resolve(__dirname, "out/src/extension"),
    filename: "main.js",
    libraryTarget: "commonjs2",
    devtoolModuleFilenameTemplate: "../../../[resource-path]"
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
            loader: "ts-loader",
            options: {
              configFile: path.resolve(__dirname, "src/tsconfig.json")
            }
          }
        ]
      },
    ]
  }
};

// Add an entry for each webview here. '"X": "./A/B.ts"' will bundle './A/B.ts'
// and generate 'out/webviews/X.js'
const webviewEntries = {
  "toolbar": "./webviews/toolbar/index.ts",
  "settings": "./webviews/settings/index.ts"
};

/**@type {webpack.Configuration}*/
const webviewConfig = {
    name: "webviews",
    target: "web",
    entry: webviewEntries,
    experiments: {
      outputModule: true
    },
    output: {
      path: path.resolve(__dirname, "out/webviews/"),
      filename: "[name].js",
      libraryTarget: "module",
			publicPath: '#{root}/out/',
    },
    devtool: "source-map",
    resolve: {
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
              loader: "ts-loader",
              options: {
                configFile: path.resolve(__dirname, "webviews/tsconfig.json")
              }
            }
          ]
        }
      ]
    },
    plugins: [
      new copyPlugin({
        // Copy all css files from ./webviews to ./out/webviews (preserving subpaths)
        patterns: [
          { from: "**/*.css", to: "", context: "webviews" }
        ]
      })
    ]
};

module.exports = [extensionConfig, webviewConfig];