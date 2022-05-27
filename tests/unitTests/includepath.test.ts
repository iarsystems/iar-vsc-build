/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as Assert from "assert";
import { IncludePath } from "../../src/extension/cpptools/data/includepath";

suite("Test includepath parsers", () => {
    suite("Test compile output", () => {
        test("output AVR compiler", () => {
            // Since the parser rejects paths that do not exist, we will add some paths we know exist and some we know do _not_ exist
            const output = `$$TOOL_BEGIN $$VERSION "3" $$MSG_BEGIN $$MSG_POS "0" "0" "0" "0" $$TYPE "2" $$TXT_BEGIN "\n" $$TOOL_END
$$TOOL_BEGIN $$VERSION "3" $$MSG_BEGIN $$MSG_POS "0" "0" "0" "0" $$TYPE "2" $$TXT_BEGIN "   IAR C/C++ Compiler V7.10.1.1197 for Atmel AVR\n" $$TOOL_END
$$TOOL_BEGIN $$VERSION "3" $$MSG_BEGIN $$MSG_POS "0" "0" "0" "0" $$TYPE "2" $$TXT_BEGIN "   Copyright 1996-2017 IAR Systems AB.\n" $$TOOL_END
$$TOOL_BEGIN $$VERSION "3" $$MSG_BEGIN $$MSG_POS "0" "0" "0" "0" $$TYPE "2" $$TXT_BEGIN "   Standalone license - IAR Embedded Workbench for Atmel AVR, 4K Kickstart edition 7.10\n" $$TOOL_END
$$TOOL_BEGIN $$VERSION "3" $$INC_BEGIN $$FILEPATH "C:\\Path that\\Does not exist\\avr\\inc" $$TOOL_END
$$TOOL_BEGIN $$VERSION "3" $$INC_BEGIN $$FILEPATH "${__dirname}" $$TOOL_END
$$TOOL_BEGIN $$VERSION "3" $$DEP_BEGIN $$FILEPATH "C:\\Path that\\Does not exist\\main.c" $$TOOL_END
$$TOOL_BEGIN $$VERSION "3" $$DEP_BEGIN $$FILEPATH "C:\\Users\\phili\\AppData\\Local\\Temp\\main.c" $$TOOL_END
$$TOOL_BEGIN $$VERSION "3" $$OUT_BEGIN $$FILEPATH "${__dirname}" $$TOOL_END
$$TOOL_BEGIN $$VERSION "3" $$OUT_BEGIN $$FILEPATH "C:\\Users\\phili\\AppData\\Local\\Temp\\predef.txt" $$TOOL_END
$$TOOL_BEGIN $$VERSION "3" $$OUT_BEGIN $$FILEPATH "C:\\Data\\Programming\\vsc\\iar-vsc\\main.r90" $$TOOL_END
$$TOOL_BEGIN $$VERSION "3" $$MSG_BEGIN $$MSG_POS "0" "0" "0" "0" $$TYPE "2" $$TXT_BEGIN " \n" $$TOOL_END
$$TOOL_BEGIN $$VERSION "3" $$MSG_BEGIN $$MSG_POS "0" "0" "0" "0" $$TYPE "2" $$TXT_BEGIN "\n" $$TOOL_END
$$TOOL_BEGIN $$VERSION "3" $$MSG_BEGIN $$MSG_POS "0" "0" "0" "0" $$TYPE "2" $$TXT_BEGIN "\n" $$TOOL_END
$$TOOL_BEGIN $$VERSION "3" $$MSG_BEGIN $$MSG_POS "0" "0" "0" "0" $$TYPE "2" $$TXT_BEGIN "Errors: none\n" $$TOOL_END
$$TOOL_BEGIN $$VERSION "3" $$MSG_BEGIN $$MSG_POS "0" "0" "0" "0" $$TYPE "2" $$TXT_BEGIN "Warnings: none\n" $$TOOL_END
 $$TOOL_EXIT`;

            const includepaths = IncludePath.fromCompilerOutput(output);

            Assert.strictEqual(includepaths.length, 1);
            Assert.strictEqual(includepaths[0]!.path, __dirname);
        });
    });
});
