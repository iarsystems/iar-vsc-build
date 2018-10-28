
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import * as jsonc from 'jsonc-parser';
import { sErrorNotAnIarProjectFile } from '../iar/errors';
import { FsUtils } from '../utils/fs';

export class Settings {
    private static readonly settingsLocation = path.join(vscode.workspace.rootPath as string, ".vscode/iar-vsc.js");
    private static readonly ewpLocation = "ewp_location";
    private static readonly iarLocation = "iar_location";
    private settings: any;

    constructor() {
        this.settings = {};

        this.load();
    }

    public load() {
        if(fs.existsSync(Settings.settingsLocation)) {
            let data = fs.readFileSync(Settings.settingsLocation);

            this.settings = jsonc.parse(data.toString());
        } else {
            this.storeSettings();
        }
    }

    public storeSettings() {
        let basedir = path.dirname(Settings.settingsLocation);

        if(!fs.existsSync(basedir)) {
            FsUtils.mkdirsSync(basedir);
        }

        fs.writeFileSync(Settings.settingsLocation, JSON.stringify(this.settings, undefined, 4));
    }

    get ewpLocation(): string | undefined {
        return this.settings[Settings.ewpLocation];
    }

    set ewpLocation(location: string | undefined) {
        if(location !== undefined) {
            if(fs.existsSync(location)) {
                let stat = fs.statSync(location);

                if(!stat.isFile()) {
                    throw new Error(sErrorNotAnIarProjectFile);
                }
            }
        }

        this.settings[Settings.ewpLocation] = location;
    }

    get iarLocation(): string | undefined {
        return this.settings[Settings.iarLocation];
    }

    set iarLocation(location: string | undefined) {
        this.settings[Settings.iarLocation] = location;
    }
}