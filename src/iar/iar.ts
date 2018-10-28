
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

export class IarInstallation {
    private location: fs.PathLike;
    private readonly iarBuildPath: fs.PathLike;
    private readonly infocenterDllPath: fs.PathLike;

    constructor(location: fs.PathLike) {
        this.location = location;

        this.iarBuildPath = path.join(this.location.toString(), "common", "bin", "IarBuild.exe");
        this.infocenterDllPath = path.join(this.location.toString(), "install-info", "arm_infocenter_all.dll");
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
                return IarInstallation.getFileVersionOnLinux(this.infocenterDllPath);

            case 'win32':
                return IarInstallation.getFileVersionOnWindows(this.infocenterDllPath);

            default:
                return "Unknown";
        }
    }

    public getIarPlatform(): string {
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

    private static getFileVersionOnLinux(filepath: fs.PathLike): string {
        try {
            let buf = execSync("exiftool -FileVersion '" + filepath + "' | cut -d ':' -f 2 | tr -d '[:space:]' | cut -d . -f 1,2,3", { 'timeout': 1000 });

            return buf.toString();
        } catch(err) {
            return "Unknown";
        }
    }

    private static getFileVersionOnWindows(filepath: fs.PathLike): string {
        try {
            let buf = execSync("powershell \"(Get-Item -path \"" + filepath.toString() + "\").VersionInfo.FileVersion");
            let fullVersion = buf.toString();
            let versionParts = fullVersion.split(".");

            return versionParts[0] + "." + versionParts[1] + "." + versionParts[2];
        } catch(err) {
            return "Unknown";
        }
    }
}