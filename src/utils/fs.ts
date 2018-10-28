
import * as path from 'path';
import * as fs from 'fs';

export namespace FsUtils {
    export function mkdirsSync(dirPath: fs.PathLike) {
        let parentDir = path.dirname(dirPath.toString());

        if(!fs.existsSync(parentDir)) {
            mkdirsSync(parentDir);
        }
        
        fs.mkdirSync(dirPath);
    }
}