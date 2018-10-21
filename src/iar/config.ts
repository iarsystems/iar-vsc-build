'use strict';

import { XmlNode } from './XmlNode';
import { Project } from './project';
import { ReplaceUtils } from '../utils/utils';
import { Define, XmlDefine } from './define';
import { IarXml } from '../utils/xml';
import { IncludePath, XmlIncludePath } from './includepaths';

enum SettingsNames {
    CCompiler = 'ICCARM',
}

enum SettingsOptions {
    CDefines = 'CCDefines',
    CPreInclude = 'PreInclude',
    CIncludePaths2 = 'CCIncludePath2',
}

export class Config {
    private xmlData: XmlNode;
    private defines: Define[];
    private includes: IncludePath[];
    private preIncludes: string[];

    private constructor(xmlConfigElement: XmlNode, defines: Define[], includes: IncludePath[], preIncludes: string[]) {
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
                let defines = XmlDefine.parseDefinesFromconfiguration(config);
                let includes = XmlIncludePath.parseFromconfiguration(config, project.getProjectDirectory());
                let preincludes = Config.parsePreIncludes(project, config);

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

    public getPreIncludes(): string[] {
        return this.preIncludes;
    }

    private static parsePreIncludes(project: Project, node: XmlNode): string[] {
        let settings = Config.findSettings(node, SettingsNames.CCompiler);

        if(settings) {
            let option = Config.findOptionFromSetting(settings, SettingsOptions.CPreInclude);

            if(option) {
                return ReplaceUtils.replaceInStrings("$PROJ_DIR$", project.getProjectDirectory(), Config.parseStatesAsStringsFromOption(option));
            }
        }

        return [];
    }

    private static parseStatesAsStringsFromOption(option: XmlNode): string[] {
        let data: string[] = [];

        option.getAllChildsByName('state').forEach(state => {
            let stateText = state.getText();

            if(stateText) {
                data.push(stateText);
            }
        });

        return data;
    }

    private static findOptionFromSetting(setting: XmlNode, name: string): XmlNode | undefined {
        let data = setting.getFirstChildByName('data');

        if(data) {
            let options = data.getAllChildsByName('option');

            for(let idx=0; idx<options.length; idx += 1) {
                let option = options[idx];

                let optionName = option.getFirstChildByName('name');

                if(optionName) {
                    let optionNameText = optionName.getText();

                    if(optionNameText && (optionNameText === name)) {
                        return option;
                    }
                }
            }
        }

        return undefined;
    }

    private static findSettings(node: XmlNode, name: SettingsNames): XmlNode | undefined {
        let settings = node.getAllChildsByName('settings');

        for(let idx=0; idx<settings.length; idx += 1) {
            let setting = settings[idx];
            let namenode = setting.getFirstChildByName('name');
            
            if(namenode && (namenode.getText() === name)) {
                return setting;
            }
        }

        return undefined;
    }
}