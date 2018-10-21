'use strict';

import * as fs from 'fs';
import * as xmljs from 'xml-js';
import * as lPath from 'path';
import * as iar_errors from './errors';
import * as iar_config from './config';
import { XmlNode } from '../utils/XmlNode';

export class Project {
    private projectFile: fs.PathLike;
    private rootElement?: XmlNode;

    private configs: iar_config.Config[];

    constructor(projectFile: fs.PathLike) {
        this.projectFile = projectFile;
        this.configs = [];
    }

    public getProjectDirectory(): string {
        return lPath.dirname(this.projectFile.toString());
    }


    /**
     * Parse
     */
    public parse(): Error | undefined {
        let fd = fs.openSync(this.projectFile, "r");

        let fstat = fs.fstatSync(fd);

        if (!fstat.isFile()) {
            return new Error(iar_errors.sErrorFileNotFound);
        }

        let content = Buffer.alloc(fstat.size);
        let bytesRead = fs.readSync(fd, content, 0, fstat.size, 0);
        fs.closeSync(fd);

        if (bytesRead === 0) {
            return new Error(iar_errors.sErrorReadingFile);
        }

        let xmldoc = xmljs.xml2js(content.toString(), { compact: false }) as xmljs.Element;

        if (xmldoc.elements) {
            let root = xmldoc.elements[0];

            if(root.name === 'project') {
                this.rootElement = new XmlNode(root);

                this.configs = iar_config.Config.parseFromProject(this);
            }
            else
            {
                return new Error(iar_errors.sErrorNotAnIarProjectFile);
            }
        }
        else
        {
            return new Error(iar_errors.sErrorNotAnXmlFile);
        }

        return undefined;
    }

    public getXml(): XmlNode | undefined {
        return this.rootElement;
    }

    public getConfigs(): iar_config.Config[] {
        return this.configs;
    }
}
