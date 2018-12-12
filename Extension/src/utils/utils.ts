'use strict';


export namespace ReplaceUtils {
    /**
     * This function replaces \a replace by \a by in \a inSrc.
     * 
     * @param replace The text to replace
     * @param by The text \a replace is replaced by
     * @param inSrc The source string in which to replace \a replace by \by
     */
    export function replaceInStrings(replace: string, by: string, inSrc: string[]): string[] {
        let ret: string[] = [];

        inSrc.forEach(src => {
            ret.push(src.replace(replace, by));
        });

        return ret;
    }
}
