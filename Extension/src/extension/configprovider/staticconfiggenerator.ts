/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

'use strict';

import { Config, XmlConfig } from "../../iar/project/config";
import { IncludePath } from "../../iar/project/includepath";
import { PreIncludePath } from "../../iar/project/preincludepath";
import { Define } from "../../iar/project/define";
import { Compiler } from "../../iar/tools/compiler";
import { LanguageUtils } from "../../utils/utils";
import * as Path from "path";
import * as Os from "os";
import * as Fs from "fs";
import * as Process from "child_process";
import { Project } from "../../iar/project/project";

export type PartialSourceFileConfiguration = { includes: IncludePath[], preIncludes: PreIncludePath[], defines: Define[] };

/**
 * Detects source file configuration for an IAR project.
 * This implementation relies on static analysis of project files.
 * It is fast but sometimes inaccurate, and only generates on a project-level,
 * i.e. does not detect config changes between individual files.
 */
export namespace StaticConfigGenerator {

    export function generateConfiguration(language: LanguageUtils.Language, config?: Config, project?: Project, compiler?: Compiler): PartialSourceFileConfiguration {
        let defines: Define[] = [];
        let includepaths: IncludePath[] = [];
        let preincludes: PreIncludePath[] = [];

        if (config && project) {
            const configSpecifics = generateConfigSpecifics(language, config, project);
            defines = defines.concat(configSpecifics.defines);
            includepaths = includepaths.concat(configSpecifics.includes);
            preincludes = preincludes.concat(configSpecifics.preIncludes);
        }

        if (compiler) {
            const compilerSpecifics = generateCompilerSpecifics(language, compiler);
            defines = defines.concat(compilerSpecifics.defines);
            includepaths = includepaths.concat(compilerSpecifics.includes);
            preincludes = preincludes.concat(compilerSpecifics.preIncludes);
        }

        return {
            includes: includepaths,
            preIncludes: preincludes,
            defines: defines,
        };
    }

    function generateCompilerSpecifics(language: LanguageUtils.Language, compiler: Compiler): PartialSourceFileConfiguration {
        let cmd = compiler.path.toString();
        let tmpFile = Path.join(Os.tmpdir(), "iarvsc.c");
        let tmpOutFile = Path.join(Os.tmpdir(), "iarvsc.predef_macros");
        let args = ["--IDE3", "--NCG", tmpFile, "--predef_macros", tmpOutFile];

        if (language === "cpp") {
            args.push("--c++");
        }

        try {
            let stat = Fs.statSync(tmpFile);

            if (stat.isDirectory()) {
                Fs.rmdirSync(tmpFile);
            } else if (stat.isFile()) {
                Fs.unlinkSync(tmpFile);
            }
        } catch (e) {
        }

        try {
            let stat = Fs.statSync(tmpOutFile);

            if (stat.isDirectory()) {
                Fs.rmdirSync(tmpOutFile);
            } else if (stat.isFile()) {
                Fs.unlinkSync(tmpOutFile);
            }
        } catch (e) {
        }

        Fs.writeFileSync(tmpFile, "");

        let process = Process.spawnSync(cmd, args, { encoding: "utf8" });

        let defines: Define[] = [];
        if (Fs.existsSync(tmpOutFile)) {
            defines = Define.fromSourceFile(tmpOutFile);
        }
        let includePaths = IncludePath.fromCompilerOutput(process.stdout);

        return { defines: defines, includes: includePaths, preIncludes: [] };
    }

    function generateConfigSpecifics(_language: LanguageUtils.Language, config: Config, project: Project): PartialSourceFileConfiguration {
        const projectRoot = Path.parse(project.path.toString()).dir;

        if (config instanceof XmlConfig) {
            let xml = config.getXml();
            const defines = Define.fromXml(xml);
            const includes = IncludePath.fromXmlData(xml, projectRoot);
            const preIncludes = PreIncludePath.fromXml(xml, projectRoot);
            return { defines: defines, includes: includes, preIncludes: preIncludes };
        } else {
            throw new Error(`Unknown config type for ${config.name}, unable to generate includes/defines.`);
        }
    }
}