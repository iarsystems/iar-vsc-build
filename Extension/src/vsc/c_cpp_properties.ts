import { writeFileSync, readFileSync } from "fs";
import * as jsonc from 'jsonc-parser';
import { Config } from "../iar/config";
import { IncludePath } from "../iar/includepaths";
import { PreIncludePath } from "../iar/preincludepath";
import { Define } from "../iar/define";

export class CCppPropertiesFile {
    private properties: any;

    constructor() {
        this.properties = {};

        this.properties['version'] = 4;
    }

    public setConfiguration(configuration: Config) {
        if (this.properties['configurations'] === undefined) {
            this.properties['configurations'] = [];
        }

        let configIdx = this.findConfiguration(this.generateConfigName(configuration));
        let config = this.toJsonObject(configuration);

        if (configIdx === undefined) {
            let configs = this.properties['configurations'] as any[];
            configs.push(config);
        } else {
            this.properties['configurations'][configIdx] = config;
        }
    }

    public findConfiguration(configName: string): number | undefined {
        if (this.properties['configurations'] === undefined) {
            return undefined;
        }

        let configurations: any[] = this.properties['configurations'];

        for (let idx = 0; idx < configurations.length; idx += 1) {
            let configuration = configurations[idx];

            if (configuration['name'] === configName) {
                return idx;
            }
        }

        return undefined;
    }

    public write(path: string) {
        writeFileSync(path, JSON.stringify(this.properties, undefined, 4));
    }

    public load(path: string) {
        let data = readFileSync(path);
        let json = undefined;

        if (data) {
            json = jsonc.parse(data.toString());
        }

        if (json) {
            this.properties = json;
        }
    }

    private generateConfigName(config: Config): string {
        return 'IAR-' + config.getProject().getName() + "-" + config.getName();
    }

    private toJsonObject(config: Config): object {
        let o: any = {};

        o['name'] = this.generateConfigName(config);
        o['defines'] = this.toDefineArray(config.getDefines());
        o['includePath'] = this.toIncludePathArray(config.getIncludePaths());
        o['forcedInclude'] = this.toPreIncludePathArray(config.getPreIncludes());

        return o;
    }

    private toDefineArray(defines: Define[]): string[] {
        let array: string[] = [];

        defines.forEach(item => {
            // array.push(item.get());
        });

        return array;
    }

    private toIncludePathArray(includes: IncludePath[]): string[] {
        let array: string[] = [];

        includes.forEach(item => {
            array.push(item.getAbsolute());
        });

        return array;

    }

    private toPreIncludePathArray(includes: PreIncludePath[]): string[] {
        let array: string[] = [];

        includes.forEach(item => {
            array.push(item.getAbsolute());
        });

        return array;
    }
}