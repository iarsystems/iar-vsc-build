'use strict';

import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { XmlNode } from "../utils/XmlNode";
import { IarXml } from "../utils/xml";
import { execSync } from 'child_process';

export interface Define {
    get(): string;
}

export class XmlDefine {
    private xmlData: XmlNode;

    constructor(xml: XmlNode) {
        this.xmlData = xml;

        if(xml.getTagName() !== "state") {
            throw new Error("Expected an xml element 'state' instead of '" + xml.getTagName() + "'.");
        }
    }

    public get(): string {
        let define = this.xmlData.getText();

        if (define) {
            return define;
        } else {
            return "";
        }
    }

    public static parseFromconfiguration(xml: XmlNode): Define[] {
        let settings = IarXml.findSettingsFromConfig(xml, '/ICC.*/');

        if (settings) {
            let option = IarXml.findOptionFromSettings(settings, 'CCDefines');

            if (option) {
                let states = option.getAllChildsByName('state');
                let defines: Define[] = [];

                states.forEach(state => {
                    defines.push(new XmlDefine(state));
                });

                return defines;
            }
        }

        return [];
    }
}

export class CompilerDefine {
    private define: string;

    constructor(define: string) {
        this.define = define;
    }

    public get(): string {
        return this.define;
    }

    public static generateCompilerDefines(compilerPath: fs.PathLike): Define[] {
        let defines: Define[] = [];

        let cFilePath = path.join(os.tmpdir(), "pluyckx_iar-vsc.c");
        let definePath = path.join(os.tmpdir(), "pluyckx_iar-vsc.defines");

        if (fs.existsSync(definePath)) {
            fs.unlinkSync(definePath);
        }
        fs.writeFileSync(cFilePath, "");

        let cmd = "\"" + compilerPath + "\" \"" + cFilePath + "\" --predef_macros \"" + definePath + "\"";

        execSync(cmd, { 'timeout': 5000 });

        if (fs.existsSync(definePath)) {
            let buf = fs.readFileSync(definePath);
            let sBuf = buf.toString();
            let lines = sBuf.split(/'(\n)|(\r\n)/);

            lines.forEach(line => {
                if (line) {
                    let defineParts = CompilerDefine.parseDefine(line);

                    if (defineParts.length === 1) {
                        defines.push(new CompilerDefine(defineParts[0]));
                    } else if (defineParts.length === 2) {
                        defines.push(new CompilerDefine(defineParts[0] + "=" + defineParts[1]));
                    }
                }
            });
        }

        return defines;
    }

    private static parseDefine(define: string): string[] {
        const defineHash = "#define ";

        if (define.startsWith(defineHash)) {
            let defineData = define.substr(defineHash.length).trim();
            let parts: string[] = [];
            let part: string = "";

            let brackets = 0;

            for (let idx = 0; idx < defineData.length; idx += 1) {
                if (defineData[idx] === "(") {
                    brackets += 1;
                } else if (defineData[idx] === ")") {
                    brackets -= 1;
                }

                if ((defineData[idx] === " ") && (brackets === 0)) {
                    parts.push(part);
                    parts.push(defineData.substr(idx + 1));

                    break;
                } else {
                    part = part + defineData[idx];
                }
            }

            if (parts.length === 0) {
                parts.push(part);
            }

            return parts;
        } else {
            return [];
        }
    }
}

/**
 * This class can be used to generate defines for IAR specific keywords, like
 * __eeprom, __root, ...
 */
export class IarExtensionDefine {
    private define: string;

    constructor(define: string) {
        this.define = define;
    }

    public get(): string {
        return this.define;
    }

    public static generate(): Define[] {
        let defines: IarExtensionDefine[] = [];

        defines.push(new IarExtensionDefine('__root='));
        defines.push(new IarExtensionDefine('__no_init='));
        defines.push(new IarExtensionDefine('__flash='));
        defines.push(new IarExtensionDefine('__eeprom='));

        return defines;
    }
}
