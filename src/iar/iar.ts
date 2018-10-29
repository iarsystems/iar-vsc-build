
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { FsUtils } from '../utils/fs';

export class IarInstallation {
    private location: fs.PathLike;
    private readonly iarBuildPath: fs.PathLike;
    private readonly compilerPath: fs.PathLike;

    constructor(location: fs.PathLike) {
        this.location = location;

        this.iarBuildPath = path.join(this.location.toString(), "common", "bin", "IarBuild.exe");
        this.compilerPath = IarInstallation.findCompilerPath(this.location);
    }

    public isValidInstallation(): boolean {
        return fs.existsSync(this.iarBuildPath);
    }

    public getLocation(): string {
        return this.location.toString();
    }

    public getIarVersion(): string {
        let platform = os.platform();

        switch(platform)
        {
            case 'linux':
                return IarInstallation.getFileVersionOnLinux(this.compilerPath);

            case 'win32':
                return IarInstallation.getFileVersionOnWindows(this.compilerPath);

            default:
                return "Unknown";
        }
    }

    public getIarPlatform(): string {
        if(!this.isValidInstallation()) {
            return "Invalid";
        }

        let children = fs.readdirSync(this.location);
        let platforms: string[] = [];

        children.forEach(child => {
            let fullPath = path.join(this.location.toString(), child);
            let stat = fs.statSync(fullPath);

            if(stat.isDirectory()) {
                if((child !== 'common') && (child !== 'install-info')) {
                    platforms.push(child);
                }
            }
        });

        if(platforms.length === 1) {
            return platforms[0];
        } else {
            return "Unknown";
        }
    }

    private static findCompilerPath(root: fs.PathLike): string {
        let paths = FsUtils.filteredListDirectory(root, FsUtils.createFilteredListDirectoryBlacklist(['common', 'install-info']));

        if(paths.length != 1) {
            return "";
        }

        let compilerDir = path.join(paths[0].toString(), 'bin');

        /* all compilers start with icc. Platforms like arm only have one compiler, while AVR has also iccavr_tiny.exe. So filter out
           compiler which contain an _ in their name */
        let compilerPaths = FsUtils.filteredListDirectory(compilerDir, FsUtils.createFilteredListDirectoryFilenameRegex(new RegExp('^icc[^_]*\.exe')));

        if(compilerPaths.length == 1) {
            return compilerPaths[0].toString();
        } else {
            return "";
        }
    }

    private static getFileVersionOnLinux(filepath: fs.PathLike): string {
        if(!fs.existsSync(filepath)) {
            return "Invalid";
        }

        try {
            let buf = execSync("exiftool -FileVersion '" + filepath + "' | cut -d ':' -f 2 | tr -d '[:space:]' | cut -d . -f 1,2,3", { 'timeout': 1000 });

            return buf.toString();
        } catch(err) {
            return "Unknown";
        }
    }

    private static getFileVersionOnWindows(filepath: fs.PathLike): string {
        if(!fs.existsSync(filepath)) {
            return "Invalid";
        }

        try {
            let cmd = "\"" + filepath + "\" --version";
            let buf = execSync(cmd, { 'timeout': 5000 });
            let stdout = buf.toString();
            let regex = new RegExp('V([0-9]+\.[0-9]+\.[0-9])');
            let result = regex.exec(stdout);

            if(result !== null) {
                return result[1];
            } else {
                return "Unknown";
            }
        } catch(err) {
            return "Unknown";
        }
    }
}