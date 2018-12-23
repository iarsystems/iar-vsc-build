
import * as path from 'path';
import * as fs from 'fs';

export namespace FsUtils {
    export function mkdirsSync(dirPath: fs.PathLike) {
        let parentDir = path.dirname(dirPath.toString());

        if (!fs.existsSync(parentDir)) {
            mkdirsSync(parentDir);
        }

        fs.mkdirSync(dirPath);
    }

    export function filteredListDirectory(dirPath: fs.PathLike, filterCallback: (path: fs.PathLike) => boolean): fs.PathLike[] {
        return walkAndFind(dirPath, false, filterCallback);
    }

    export function walkAndFind(dirPath: fs.PathLike, recursive: boolean, filterCallback: (path: fs.PathLike) => boolean): fs.PathLike[] {
        let children: fs.PathLike[] = [];

        if (fs.existsSync(dirPath)) {
            let stat = fs.statSync(dirPath);

            if (stat.isDirectory()) {
                let dir = fs.readdirSync(dirPath);

                dir.forEach(child => {
                    let fullpath = path.join(dirPath.toString(), child);

                    if (filterCallback(fullpath)) {
                        children.push(fullpath);
                    }

                    if (recursive) {
                        let stat = fs.statSync(fullpath);

                        if (stat.isDirectory()) {
                            children = children.concat(walkAndFind(fullpath, true, filterCallback));
                        }
                    }
                });
            }
        }

        return children;
    }

    export function createFilteredListDirectoryFilenameRegex(regex: RegExp): (fullpath: fs.PathLike) => boolean {
        return (fullpath: fs.PathLike): boolean => {
            let stat = fs.statSync(fullpath);

            if (stat.isFile()) {
                let parsedPath = path.parse(fullpath.toString());
                let filename = parsedPath.base;

                return regex.test(filename);
            } else {
                return false;
            }
        };
    }

    export function createFilteredListDirectoryDirectoryRegex(regex: RegExp): (fullpath: fs.PathLike) => boolean {
        return (fullpath: fs.PathLike): boolean => {
            let stat = fs.statSync(fullpath);

            if (stat.isDirectory()) {
                let parsedPath = path.parse(fullpath.toString());
                let filename = parsedPath.base;

                return regex.test(filename);
            } else {
                return false;
            }
        };
    }

    export function createFilteredListDirectoryBlacklist(blacklist: string[]): (fullpath: fs.PathLike) => boolean {
        return (fullpath: fs.PathLike): boolean => {
            let parsedPath = path.parse(fullpath.toString());
            let base = parsedPath.base;

            return blacklist.indexOf(base) === -1;
        };
    }

    export function createNonFilteredListDirectory(): (fullpath: fs.PathLike) => boolean {
        return (): boolean => {
            return true;
        };
    }
}