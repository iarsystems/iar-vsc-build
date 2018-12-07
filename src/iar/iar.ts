
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync, spawnSync } from 'child_process';
import { FsUtils } from '../utils/fs';

export class IarInstallation {
    private location: fs.PathLike;
    private readonly iarBuildPath: fs.PathLike;
    private readonly compilerPath: fs.PathLike;
    private processor: string = "";

    constructor(location: fs.PathLike, processor: string) {
        this.location = location;
        this.setProcessor(processor);

        this.iarBuildPath = path.join(this.location.toString(), "common", "bin", "IarBuild.exe");
        this.compilerPath = IarInstallation.findCompilerPath(this.location, this.processor);
    }

    public isValidInstallation(): boolean {
        return fs.existsSync(this.iarBuildPath);
    }

    public getLocation(): string {
        return this.location.toString();
    }

    public getCompilerLocation(): string {
        return this.compilerPath.toString();
    }

    public getIarBuildLocation(): string {
        return this.iarBuildPath.toString();
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

    public setProcessor( processor: string ) {
        /*
        **  IAR has chosen to name the MSP430 compiler directory: 430. Therefore,
        **  we attempt to strip MSP from MSP430 if detected.
        */
       if(processor.startsWith("MSP")) {
           this.processor = processor.substring( 3, 6 );
       }
       else {
           this.processor = processor;
       }

        /*  Attempt to find the compiler for this processor */
        IarInstallation.findCompilerPath( this.location, this.processor );
    }

    public getProcessor(): string {
        return this.processor;
    }

    private static findCompilerPath(root: fs.PathLike, processor: string): string {
        let paths = FsUtils.filteredListDirectory(root, FsUtils.createFilteredListDirectoryBlacklist(['common', 'install-info']));
        let pathIndex = 0;

        if(paths.length !== 1) {
            /*
            **  Dan Bomsta: Trying to fix https://github.com/pluyckx/iar-vsc/issues/4, when there are
            **  multiple microprocessor IAR installations.
            */
            if(processor !== "") {
                /*  Can we locate the path we need? */
                let counter = 0;

                paths.forEach( path => {
                    if( path.toString().includes( processor ) ||
                        path.toString().includes( processor.toLowerCase() ) ) {
                            pathIndex = counter;
                    }

                    counter++;
                } );
            }
            else {
                return "";
            }
        }

        let compilerDir = path.join(paths[pathIndex].toString(), 'bin');

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
            let cmd = filepath.toString();
            let ret = spawnSync(cmd, ['--v'], { 'timeout': 5000, 'stdio': 'pipe' });
            let stdout = ret.stdout.toString();
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