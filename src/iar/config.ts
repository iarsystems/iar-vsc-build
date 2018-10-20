'use strict';

import { XmlNode } from './XmlNode';
import { Project } from './project';
import { ReplaceUtils } from '../utils/utils';

enum SettingsNames {
    CCompiler = 'ICCARM',
}

enum SettingsOptions {
    CDefines = 'CCDefines',
    CPreInclude = 'PreInclude',
    CIncludePaths2 = 'CCIncludePath2',
}

export class Config {
    private mName: string;
    private mDefines: string[];
    private mIncludes: string[];
    private mPreIncludes: string[];

    private constructor(name: string, defines: string[], includes: string[], preIncludes: string[]) {
        this.mName = name;
        this.mDefines = defines;
        this.mIncludes = includes;
        this.mPreIncludes = preIncludes;
    }

    public static parseFromProject(project: Project): Config[] {
        let configs: Config[] = [];

        let xmlRoot = project.getXml();

        if(xmlRoot) {
            let xmlConfigs = xmlRoot.getAllChildsByName("configuration");

            xmlConfigs.forEach(child => {
                let name = Config.parseName(child);
                let defines = Config.parseDefines(child);
                let includes = Config.parseIncludePaths(project, child);
                let preincludes = Config.parsePreIncludes(project, child);

                configs.push(new Config(name, defines, includes, preincludes));
            });
        }


        return configs;
    }

    public getName(): string { 
        return this.mName;
    }

    public getDefines(): string[] {
        return this.mDefines;
    }

    public getIncludePaths(): string[] {
        return this.mIncludes;
    }

    public getPreIncludes(): string[] {
        return this.mPreIncludes;
    }

    private static parseName(node: XmlNode): string {
        let ret: string = "";

        let nameChild = node.getFirstChildByName('name');
        
        if(nameChild) {
            let name = nameChild.getText();

            if(name) {
                ret = name as string;
            }
        }

        return ret;
    }

    private static parseDefines(node: XmlNode): string[] {
        let settings = Config.findSettings(node, SettingsNames.CCompiler);

        if(settings) {
            let option = Config.findOptionFromSetting(settings, SettingsOptions.CDefines);

            if(option) {
                return Config.parseStatesAsStringsFromOption(option);
            }
        }

        return [];
    }

    private static parseIncludePaths(project: Project, node: XmlNode): string[] {
        let settings = Config.findSettings(node, SettingsNames.CCompiler);

        if(settings) {
            let option = Config.findOptionFromSetting(settings, SettingsOptions.CIncludePaths2);

            if(option) {
                let projectDirectory = project.getProjectDirectory();
                let paths = Config.parseStatesAsStringsFromOption(option);

                return ReplaceUtils.replaceInStrings("$PROJ_DIR$", projectDirectory, paths);
            }
        }

        return [];
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