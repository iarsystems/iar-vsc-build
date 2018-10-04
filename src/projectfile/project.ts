'use strict';

import * as fs from 'fs';

class Project {
    private _projectFile: fs.PathLike

    constructor(projectFile: fs.PathLike) {
        if(!fs.existsSync(projectFile)) {
            throw Error("File '" + projectFile + "' does not exist!");
        }

        this._projectFile = projectFile;
    }

    /**
     * Parse
     */
    public Parse(): boolean {
        let fd = fs.openSync(this._projectFile, "r");

        let fstat = fs.fstatSync(fd);
        
        if(!fstat.isFile()) {
            return false;
        }

        let content = Buffer.alloc(fstat.size);
        let bytesRead = fs.readSync(fd, content, 0, fstat.size, 0);

        return bytesRead > 0;
    }
}