/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

'use strict';

import { Config } from "../../iar/project/config";
import { IncludePath } from "./data/includepath";
import { PreIncludePath } from "./data/preincludepath";
import { Define } from "./data/define";
import { Keyword } from "./data/keyword";
import { Compiler } from "../../iar/tools/compiler";
import { LanguageUtils } from "../../utils/utils";
import * as Path from "path";
import * as Os from "os";
import { promises as fsPromises } from "fs";
import * as Process from "child_process";
import { Project } from "../../iar/project/project";
import { PartialSourceFileConfiguration } from "./data/partialsourcefileconfiguration";
import { XmlConfig } from "../../iar/project/parsing/xmlconfig";
import { FsUtils } from "../../utils/fs";

/**
 * Detects source file configuration for an IAR project.
 * This implementation relies on static analysis of project files.
 * It is fast but sometimes inaccurate, and only generates on a project-level,
 * i.e. does not detect config changes between individual files.
 */
export namespace StaticConfigGenerator {

    export async function generateConfiguration(language: LanguageUtils.Language, config?: Config, project?: Project, compiler?: Compiler): Promise<PartialSourceFileConfiguration> {
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
            const compilerSpecifics = await generateCompilerSpecifics(language, compiler);
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

    async function generateCompilerSpecifics(language: LanguageUtils.Language, compiler: Compiler): Promise<PartialSourceFileConfiguration> {
        let cmd = compiler.path.toString();
        let tmpFile = Path.join(Os.tmpdir(), "iarvsc.c");
        let tmpOutFile = Path.join(Os.tmpdir(), "iarvsc.predef_macros");
        let args = ["--IDE3", "--NCG", tmpFile, "--predef_macros", tmpOutFile];

        if (language === "cpp") {
            args.push("--c++");
        }

        try {
            let stat = await fsPromises.stat(tmpFile);

            if (stat.isDirectory()) {
                await fsPromises.rmdir(tmpFile);
            } else if (stat.isFile()) {
                await fsPromises.unlink(tmpFile);
            }
        } catch (e) {
        }

        try {
            let stat = await fsPromises.stat(tmpOutFile);

            if (stat.isDirectory()) {
                await fsPromises.rmdir(tmpOutFile);
            } else if (stat.isFile()) {
                await fsPromises.unlink(tmpOutFile);
            }
        } catch (e) {
        }

        await fsPromises.writeFile(tmpFile, "");

        let process = Process.spawnSync(cmd, args, { encoding: "utf8" });

        let defines: Define[] = [];
        if (await FsUtils.exists(tmpOutFile)) {
            defines = Define.fromSourceFile(tmpOutFile);
        }
        let includePaths = IncludePath.fromCompilerOutput(process.stdout);

        // To force cpptools to recognize extended keywords we pretend they're compiler-defined macros
        // C syntax files are named <platform dir>/config/syntax_icc.cfg
        const platformBasePath = Path.join(Path.dirname(compiler.path.toString()), "..");
        const filePath         = platformBasePath + "/config/syntax_icc.cfg";
        if (await FsUtils.exists(filePath)) {
            const keywords = Keyword.fromSyntaxFile(filePath);
            defines = defines.concat(keywords.map(kw => Keyword.toDefine(kw)));
        }

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
            console.error(`Unknown config type for ${config.name}, unable to generate includes/defines.`);
            return { defines: [], includes: [], preIncludes: [] };
        }
    }
}