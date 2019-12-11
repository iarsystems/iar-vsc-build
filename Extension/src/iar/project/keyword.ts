/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

'use strict';

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
    export function fromSyntaxFile(path: Fs.PathLike): Keyword[] {
        const buf = Fs.readFileSync(path.toString());
        const content = buf.toString();

        let lines = content.split(/\n|\r\n/);
        lines = lines.filter(line => line && line.trim()); // remove empty lines
        lines = lines.map(line => line.trim()) // some older workbenches have keywords with surrounding spaces
        return lines.map(line => new StringKeyword(line));
    }

    // Right now the best way to get cpptools to recognize custom keywords is to
    // pretend they're compiler-defined macros, so we need a way to convert keywords to macros
    export function toDefine(keyword: Keyword) {
        // We make the define expand to an empty string to force the error checker to ignore it
        return Define.fromIdentifierValuePair(keyword.identifier, "");
    }
}