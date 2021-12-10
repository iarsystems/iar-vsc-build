/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */



import * as Fs from "fs";
import { Define } from "./define";

export interface Keyword {
    readonly identifier: string;
}

class StringKeyword implements Keyword {
    readonly identifier: string;

    constructor(identifier: string) {
        this.identifier = identifier;
    }
}

export namespace Keyword {
    /**
     * Reads keywords from a platform syntax file (usually called syntax_icc.cfg)
     * @param path The path to the syntax file
     */
    export async function fromSyntaxFile(path: Fs.PathLike): Promise<Keyword[]> {
        const buf = await Fs.promises.readFile(path.toString());
        const contents = buf.toString();
        return fromSyntaxFileContents(contents);
    }

    export function fromSyntaxFileContents(contents: string): Keyword[] {
        let lines = contents.split(/\n|\r\n/);
        lines = lines.filter(line => line && line.trim()); // remove empty lines
        lines = lines.map(line => line.trim()); // some older workbenches have keywords with surrounding spaces
        return lines.map(line => new StringKeyword(line));
    }

    // Right now the best way to get cpptools to recognize custom keywords is to
    // pretend they're compiler-defined macros, so we need a way to convert keywords to macros
    export function toDefine(keyword: Keyword) {
        // We make the define expand to an empty string to force the error checker to ignore it
        return Define.fromIdentifierValuePair(keyword.identifier, "");
    }
}