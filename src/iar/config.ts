'use strict';

import { XmlNode } from '../utils/XmlNode';
import { Project } from './project';
import { Define, XmlDefine } from './define';
import { IarXml } from '../utils/xml';
import { IncludePath, XmlIncludePath } from './includepaths';
import { PreIncludePath, XmlPreIncludePath } from './preincludepath';

export class Config {
    private project: Project;
    private xmlData: XmlNode;
    private defines: Define[];
    private compilerDefines: Define[];
    private includes: IncludePath[];
    private systemIncludes: IncludePath[];
    private preIncludes: PreIncludePath[];

    private constructor(project: Project, xmlConfigElement: XmlNode, defines: Define[], includes: IncludePath[], preIncludes: PreIncludePath[]) {
        if(xmlConfigElement.getTagName() !== 'configuration') {
            throw new Error("Expected an xml element 'configuration' instead of '" + xmlConfigElement.getTagName() + "'");
        }

        this.project = project;
        this.xmlData = xmlConfigElement;
        this.defines = defines;
        this.includes = includes;
        this.preIncludes = preIncludes;
        this.compilerDefines = [];
        this.systemIncludes = [];
    }

    public setCompilerDefines(defines: Define[]) {
        this.compilerDefines = defines;
    }

    public setSystemIncludes(includes: IncludePath[]) {
        this.systemIncludes = includes;
    }

    public static parseFromProject(project: Project): Config[] {
        let configs: Config[] = [];

        let xmlRoot = project.getXml();

        if(xmlRoot) {
            let xmlConfigs = xmlRoot.getAllChildsByName("configuration");

            xmlConfigs.forEach(config => {
                let defines = XmlDefine.parseFromconfiguration(config);
                let includes = XmlIncludePath.parseFromconfiguration(config, project.getProjectDirectory());
                let preincludes = XmlPreIncludePath.parseFromconfiguration(config, project.getProjectDirectory());

                configs.push(new Config(project, config, defines, includes, preincludes));
            });
        }


        return configs;
    }

    public getProject(): Project {
        return this.project;
    }

    public getName(): string { 
        return IarXml.getNameTextFromElement(this.xmlData) as string;
    }

    public getDefines(): Define[] {
        return this.defines.concat(this.compilerDefines);
    }

    public getIncludePaths(): IncludePath[] {
        return this.includes.concat(this.systemIncludes);
    }

    public getPreIncludes(): PreIncludePath[] {
        return this.preIncludes;
    }
}