'use strict';

import { XmlNode } from './XmlNode';
import { Project } from './project';

enum SettingsNames {
    CCompiler = 'ICCARM',
}

enum SettingsOptions {
    CDefines = 'CCDefines',
    CPreInclude = 'PreInclude',
    CIncludePaths2 = 'CCIncludePath2',
}

export class Config {
    private mProject: Project;
    private mData: XmlNode;

    constructor(parentProject: Project, data: XmlNode) {
        this.mProject = parentProject;
        this.mData = data;
    }

    public getName(): string | undefined {
        let ret: string | undefined = undefined;

        let nameChild = this.mData.getFirstChildByName('name');
        
        if(nameChild) {
            ret = nameChild.getText();
        }

        return ret;
    }

    public getDefines(): string[] {
        let settings = this.findSettings(SettingsNames.CCompiler);

        if(settings) {
            let option = this.findOptionFromSetting(settings, SettingsOptions.CDefines);

            if(option) {
                return this.getStatesAsStringsFromOption(option);
            }
        }

        return [];
    }

    public getIncludePaths(): string[] {
        let settings = this.findSettings(SettingsNames.CCompiler);

        if(settings) {
            let option = this.findOptionFromSetting(settings, SettingsOptions.CIncludePaths2);

            if(option) {
                return this.mProject.replaceIarProjDirInPaths(this.getStatesAsStringsFromOption(option));
            }
        }

        return [];
    }

    public getPreIncludes(): string[] {
        let settings = this.findSettings(SettingsNames.CCompiler);

        if(settings) {
            let option = this.findOptionFromSetting(settings, SettingsOptions.CPreInclude);

            if(option) {
                return this.mProject.replaceIarProjDirInPaths(this.getStatesAsStringsFromOption(option));
            }
        }

        return [];
    }

    private getStatesAsStringsFromOption(option: XmlNode): string[] {
        let data: string[] = [];

        option.getAllChildsByName('state').forEach(state => {
            let stateText = state.getText();

            if(stateText) {
                data.push(stateText);
            }
        });

        return data;
    }

    private findOptionFromSetting(setting: XmlNode, name: string): XmlNode | undefined {
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

    private findSettings(name: SettingsNames): XmlNode | undefined {
        let settings = this.mData.getAllChildsByName('settings');

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