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

    public getLocation(): fs.PathLike {
        return this.projectFile;
    }

    public getName(): string {
        return lPath.parse(this.projectFile.toString()).name;
    }

    public getToolchain(): string {
        return this.configs[0].getToolchain()[0].get();
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

    public findConfigWithName(name: string): iar_config.Config | undefined {
        for(let idx=0; idx<this.configs.length; idx += 1) {
            if(this.configs[idx].getName() === name) {
                return this.configs[idx];
            }
        }

        return undefined;
    }

    public static findProjectFiles(root: fs.PathLike, recursive = true): fs.PathLike[] {
        if(fs.existsSync(root)) {
            let stat = fs.statSync(root);

            if(stat.isDirectory()) {
                return Project.findProjectFilesHelper(root, recursive);
            } else if(stat.isFile()) {
                let ext = lPath.extname(root.toString());

                if(ext === ".ewp") {
                    return [ext];
                }
            }
        }

        return [];
    }

    private static findProjectFilesHelper(root: fs.PathLike, recursive: boolean): fs.PathLike[] {
        let children = fs.readdirSync(root);
        let projectFiles: fs.PathLike[] = [];

        while(children.length > 0) {
            let child = children.pop();

            if(child !== undefined) {
                let p = lPath.join(root.toString(), child);
                try {
                    let stat = fs.statSync(p);

                    if(stat.isDirectory() && recursive) {
                        let grandChildren = fs.readdirSync(p);

                        grandChildren.forEach(grandChild => {
                            if(child !== undefined) {
                                children.push(lPath.join(child, grandChild));
                            }
                        });
                    } else if(stat.isFile()) {
                        let ext = lPath.extname(p);

                        if(ext === ".ewp") {
                            projectFiles.push(p);
                        }
                    }
                } catch(err) {
                    /* TODO: sometimes it is possible we get an access violation. for now, just ignore exceptions, later we should check them? */
                }
            }
        }

        return projectFiles;
    }
}
