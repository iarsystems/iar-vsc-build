/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

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

export namespace ListUtils {
    /**
     * Merge two or more lists. This function will return a list of unique
     * items. Duplicates are removed.
     * 
     * @param list Array list containing lists of workbenches
     */
    export function mergeUnique<T>(getKey: (o: T) => string, ...lists: Array<T>[]): T[] {
        let result: Map<string, T> = new Map<string, T>();

        lists.forEach(list => {
            list.forEach(item => {
                result.set(getKey(item), item);
            });
        });

        return Array.from(result.values());
    }
}
