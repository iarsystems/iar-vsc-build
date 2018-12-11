'use strict';

import { XmlNode } from "../utils/XmlNode";
import { IarXml } from "../utils/xml";

export interface ToolChain {
    get(): string;
}

export class XmlToolChain {
  private xmlData: XmlNode;

  constructor(xml: XmlNode) {
      this.xmlData = xml;

      if(xml.getTagName() !== "toolchain") {
          throw new Error("Expected an xml element 'toolchain' instead of '" + xml.getTagName() + "'.");
      }
  }

  public get(): string {
    let toolchain = this.xmlData.getAllChildsByType("element");

    if(toolchain) {
        let name = toolchain[ 0 ].getText();

        if(name) {
            return name;
        }
    }

    return "";
  }

  public static parseFromconfiguration(xml: XmlNode): ToolChain[] {
    let toolchains: ToolChain[] = [];

    let settings = IarXml.findToolchainFromConfig(xml);

    if(settings) {
        toolchains.push( new XmlToolChain( settings ) );
        return toolchains;
    }

    return [];
}

}