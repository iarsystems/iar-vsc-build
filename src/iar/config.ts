'use strict';

import { XmlNode } from './XmlNode';
import { Project } from './project';
import { Define, XmlDefine } from './define';
import { IarXml } from '../utils/xml';
import { IncludePath, XmlIncludePath } from './includepaths';
import { PreIncludePath, XmlPreIncludePath } from './preincludepath';

export class Config {
    private xmlData: XmlNode;
    private defines: Define[];
    private includes: IncludePath[];
    private preIncludes: PreIncludePath[];

    private constructor(xmlConfigElement: XmlNode, defines: Define[], includes: IncludePath[], preIncludes: PreIncludePath[]) {
        if(xmlConfigElement.getTagName() !== 'configuration') {
            throw new Error("Expected an xml element 'configuration' instead of '" + xmlConfigElement.getTagName() + "'");
        }

        this.xmlData = xmlConfigElement;
        this.defines = defines;
        this.includes = includes;
        this.preIncludes = preIncludes;
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

                configs.push(new Config(config, defines, includes, preincludes));
            });
        }


        return configs;
    }

    public getName(): string { 
        return IarXml.getNameTextFromElement(this.xmlData) as string;
    }

    public getDefines(): Define[] {
        return this.defines;
    }

    public getIncludePaths(): IncludePath[] {
        return this.includes;
    }

    public getPreIncludes(): PreIncludePath[] {
        return this.preIncludes;
    }
}