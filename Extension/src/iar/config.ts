'use strict';

import { XmlNode } from '../utils/XmlNode';
import { Project } from './project';
import { Define } from './project/define';
import { IarXml } from '../utils/xml';
import { IncludePath, XmlIncludePath } from './includepaths';
import { PreIncludePath, XmlPreIncludePath } from './preincludepath';
import { XmlToolChain, ToolChain } from './toolchain';

export class Config {
    private project: Project;
    private xmlData: XmlNode;
    private defines: Define[];
    private compilerDefines: Define[];
    private iarExtensionDefines: Define[];
    private includes: IncludePath[];
    private systemIncludes: IncludePath[];
    private preIncludes: PreIncludePath[];
    private toolchain: ToolChain[];

    private constructor(project: Project, xmlConfigElement: XmlNode, defines: Define[], includes: IncludePath[], preIncludes: PreIncludePath[], toolchain: ToolChain[]) {
        if (xmlConfigElement.tagName !== 'configuration') {
            throw new Error("Expected an xml element 'configuration' instead of '" + xmlConfigElement.tagName + "'");
        }

        this.project = project;
        this.xmlData = xmlConfigElement;
        this.defines = defines;
        this.includes = includes;
        this.preIncludes = preIncludes;
        this.compilerDefines = [];
        this.iarExtensionDefines = [];
        this.systemIncludes = [];
        this.toolchain = toolchain;
    }

    public setCompilerDefines(defines: Define[]) {
        this.compilerDefines = defines;
    }

    public setIarExtensionDefines(defines: Define[]) {
        this.iarExtensionDefines = defines;
    }

    public setSystemIncludes(includes: IncludePath[]) {
        this.systemIncludes = includes;
    }

    public static parseFromProject(project: Project): Config[] {
        let configs: Config[] = [];

        let xmlRoot = project.getXml();

        if (xmlRoot) {
            let xmlConfigs = xmlRoot.getAllChildsByName("configuration");

            xmlConfigs.forEach(config => {
                let defines: Define[] = []; // XmlDefine.parseFromconfiguration(config);
                let includes: IncludePath[] = []; // XmlIncludePath.parseFromconfiguration(config, project.getProjectDirectory());
                let preincludes = XmlPreIncludePath.parseFromconfiguration(config, project.getProjectDirectory());
                let toolchain = XmlToolChain.parseFromconfiguration(config);

                configs.push(new Config(project, config, defines, includes, preincludes, toolchain));
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
        return this.defines.concat(this.iarExtensionDefines.concat(this.compilerDefines));
    }

    public getIncludePaths(): IncludePath[] {
        return this.includes.concat(this.systemIncludes);
    }

    public getPreIncludes(): PreIncludePath[] {
        return this.preIncludes;
    }

    public getToolchain(): ToolChain[] {
        return this.toolchain;
    }
}