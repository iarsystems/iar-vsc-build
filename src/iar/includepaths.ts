'use strict';

import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { XmlNode } from "../utils/XmlNode";
import { IarXml } from "../utils/xml";
import { IarInstallation } from "./iar";
import { spawnSync } from 'child_process';

export interface IncludePath {
    /**
     * Returns the path as in the xml file.
     */
    get(): string;

    /**
     * Returns the path but $PROJ_DIR$ is replaced by the path to the ewp file.
     */
    getAbsolute(): string;
}

export class XmlIncludePath {
    private xmlData: XmlNode;
    private projectPath: string;

    constructor(xml: XmlNode, projectPath: string) {
        this.xmlData = xml;
        this.projectPath = projectPath;

        if(xml.getTagName() !== "state") {
            throw new Error("Expected an xml element 'state' instead of '" + xml.getTagName() + "'.");
        }
    }

    public get(): string {
        let path = this.xmlData.getText();

        if(path) {
            return path;
        } else {
            return "";
        }
    }

    public getAbsolute(): string {
        let path = this.get();

        return path.replace('$PROJ_DIR$', this.projectPath);
    }

    public static parseFromconfiguration(xml: XmlNode, projectPath: string): IncludePath[] {
        let settings = IarXml.findSettingsFromConfig(xml, '/ICC.*/');

        if(settings) {
            let option = IarXml.findOptionFromSettings(settings, '/CCIncludePath/');

            if(option) {
                let states = option.getAllChildsByName('state');
                let includePaths: IncludePath[] = [];

                states.forEach(state => {
                    let stateText = state.getText();

                    if(stateText && (stateText.trim() != "")) {
                        includePaths.push(new XmlIncludePath(state, projectPath));
                    }
                });

                return includePaths;
            }
        }

        return [];
    }
}

export class StringIncludePath {
    private includePath: string;
    private projectPath?: string;

    constructor(includePath: string, projectPath: string | undefined = undefined) {
        this.includePath = includePath;
        this.projectPath = projectPath;
    }


    public get(): string {
        return this.includePath;
    }

    public getAbsolute(): string {
        let path = this.get();

        if(this.projectPath) {
            return path.replace('$PROJ_DIR$', this.projectPath);
        } else {
            return path;
        }
    }

    public static generateSystemIncludePaths(iar: IarInstallation): IncludePath[] {
        let includes: IncludePath[] = [];

        let cFilePath = path.join(os.tmpdir(), "pluyckx_iar-vsc.c");
        fs.writeFileSync(cFilePath, "");

        let compiler = iar.getCompilerLocation();
        let args = ['--IDE3', cFilePath];

        let output = spawnSync(compiler.toString(), args, {'stdio': 'pipe'});

        let regex = /\$\$FILEPATH\s\"([^"]*)/g;
        let buf = output.stdout.toString();
        let result: RegExpExecArray | null = null;
        do {
            result = regex.exec(buf);

            if(result) {
                let p = result[1].replace(/\\\\/g, "\\");

                if(fs.existsSync(p)) {
                    let stat = fs.statSync(p);

                    if(stat.isDirectory()) {
                        includes.push(new StringIncludePath(p));
                    }
                }
            }
        } while(result);
        
        return includes;
    }
}