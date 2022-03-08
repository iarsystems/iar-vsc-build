/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */



import { ProcessUtils } from "../../utils/utils";
import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { join } from "path";
import CsvParser = require("csv-parse/lib/sync");
import * as Fs from "fs";
import { OsUtils } from "../../../utils/osUtils";

/**
 * Functions for interacting with C-STAT (i.e. running it via iarbuild and reading warnings)
 */
export namespace CStat {

    export enum CStatWarningSeverity {
        LOW = 0,
        MEDIUM = 1,
        HIGH = 2,
    }
    interface TraceEntry { file: string, line: number, message: string }
    export interface CStatWarning {
        file: string;
        line: number;
        col: number;
        message: string;
        severity: CStatWarningSeverity;
        checkId: string;
        trace: TraceEntry[];
    }
    type CStatWarningWithHash = CStatWarning & { hash: string };

    // Names of relevant columns in the 'warnings' table of the cstat db
    enum CStatWarningField {
        FILE_NAME = "file_name",
        LINE = "line_num",
        COLUMN = "column_num",
        MSG = "msg",
        SEVERITY = "severity",
        HASH = "warning_hash",
        TRACE = "encoded_trace",
    }
    const fieldsToLoad: string[] = Object.values(CStatWarningField);


    /**
     * Runs a C-STAT analysis on a given project and configuration,
     * using IarBuild.
     * @param builderPath path to the IarBuild to use
     * @param projectPath path to the project to run for
     * @param configurationName name of the project configuration
     * @param cstatOutputDir path to where cstat output is placed for this configuration
     * @param extensionPath path to the root of this extension
     * @param extraBuildArguments extra arguments to pass to iarbuild.
     * @param onWrite an output channel for writing logs and other messages while running
     */
    export async function runAnalysis(
        builderPath: string,
        projectPath: string,
        configurationName: string,
        cstatOutputDir: string,
        extensionPath: string,
        extraBuildArguments: string[],
        onWrite?: (msg: string) => void
    ): Promise<CStatWarning[]> {

        if (!Fs.existsSync(builderPath)) {
            return Promise.reject(new Error(`The builder ${builderPath} does not exists.`));
        }

        const dbPath: string = join(cstatOutputDir, "cstat.db");

        // It seems we need to delete the db and regenerate it every time to get around
        // some weird behaviour where the db keeps references to files outside the project
        // (specifically when the project is moved or the db is accidentally put under VCS).
        // It seems EW solves this by checking if each file in the db is in the project,
        // but i'm not sure how I would do that in VS Code
        if (Fs.existsSync(dbPath)) {
            Fs.unlinkSync(dbPath);
        }
        const args = [projectPath, "-cstat_analyze", configurationName, "-log", "info"].concat(extraBuildArguments);
        onWrite?.(`> '${builderPath}' ${args.map(arg => `'${arg}'`).join(" ")}\n`);
        const iarbuild = spawn(builderPath, args);
        iarbuild.stdout.on("data", data => {
            onWrite?.(data.toString());
        });

        await ProcessUtils.waitForExit(iarbuild);

        onWrite?.("Reading C-STAT output.");
        return getAllWarnings(dbPath, extensionPath);
    }

    export function SeverityStringToSeverityEnum(severity: string): CStatWarningSeverity {
        switch (severity) {
        case "Low":    return CStatWarningSeverity.LOW;
        case "Medium": return CStatWarningSeverity.MEDIUM;
        case "High":   return CStatWarningSeverity.HIGH;
        default:
            console.log("Unrecognized C-STAT severity: " + severity);
            return CStatWarningSeverity.HIGH;
        }
    }

    /**
     * Returns all warnings from a C-STAT database.
     */
    async function getAllWarnings(dbPath: string, extensionPath: string): Promise<CStatWarning[]> {
        // we use the sqlite3 executable CLI to perform queries against the database
        const sqliteBin = getSqliteBinaryName();
        if (sqliteBin === null) {
            return Promise.reject(new Error("Couldn't find sqlite binaries for cstat. Your OS likely isn't supported."));
        }
        const sqliteBinPath = join(extensionPath, "sqlite-bin", sqliteBin);
        if (!Fs.existsSync(dbPath)) {
            return Promise.reject(new Error("Couldn't find cstat DB: " + dbPath));
        }

        const sqlProc = spawn(sqliteBinPath, [dbPath, "-csv"]); // we want csv output for easier parsing
        let warnings = await getWarningsFromTable(sqlProc, "warnings");
        let linkWarnings = await getWarningsFromTable(sqlProc, "link_warnings");
        const suppressedWarnings = await getSuppressedWarningsFromTable(sqlProc);
        sqlProc.kill();

        // We could sort the arrays and use a better algorithm, but it's probably not worth it
        warnings     =     warnings.filter(warning => !suppressedWarnings.some(hash => hash === warning.hash));
        linkWarnings = linkWarnings.filter(warning => !suppressedWarnings.some(hash => hash === warning.hash));

        return warnings.concat(linkWarnings);
    }

    function getWarningsFromTable(sqlProc: ChildProcessWithoutNullStreams, tableName: string): Promise<CStatWarningWithHash[]> {
        return new Promise((resolve, reject) => {
            sqlProc.stdin.write(`SELECT sql FROM sqlite_master WHERE type IS 'table' AND name IS '${tableName}';\n`);
            sqlProc.stdout.once("data", tableData => {
                // The name of the check is contained in property_alias if present, otherwise in property_id
                const checkIdColumn = tableData.toString().includes("property_alias") ? "property_alias" : "property_id";

                sqlProc.stdin.write(`SELECT Count(*) FROM ${tableName};\n`);
                sqlProc.stdout.once("data", data => {
                    const expectedRows = Number(data.toString());

                    if (expectedRows > 0) {
                        const query = `SELECT ${fieldsToLoad.join(",")},${checkIdColumn} FROM '${tableName}';\n`;
                        sqlProc.stdin.write(query);
                        let output = "";
                        sqlProc.stdout.on("data", data => {
                            output += data.toString();
                            try {
                                const warnsRaw: string[][] = CsvParser(output);
                                const warnings = warnsRaw.map(row => parseWarning(row));
                                if (warnings.length === expectedRows) {
                                    resolve(warnings);  // We are done
                                }
                            } catch (e) { } // CsvParser will throw if we havent recieved all output yet
                        });
                    } else {
                        resolve([]);
                    }

                }); /* stdout.once() */
            }); /* stdout.once() */

            sqlProc.stderr.once("data", data => {
                reject(data.toString());
            });
        });
    }

    function parseWarning(warnRow: string[]): CStatWarningWithHash {
        const file     = warnRow[fieldsToLoad.indexOf(CStatWarningField.FILE_NAME)];
        const line     = warnRow[fieldsToLoad.indexOf(CStatWarningField.LINE)];
        const col      = warnRow[fieldsToLoad.indexOf(CStatWarningField.COLUMN)];
        const message  = warnRow[fieldsToLoad.indexOf(CStatWarningField.MSG)];
        const severity = warnRow[fieldsToLoad.indexOf(CStatWarningField.SEVERITY)];
        const hash     = warnRow[fieldsToLoad.indexOf(CStatWarningField.HASH)];
        const trace    = warnRow[fieldsToLoad.indexOf(CStatWarningField.TRACE)];
        const checkId  = warnRow[warnRow.length - 1];
        if (!file || !line || !col || !message || !severity || !hash || !checkId) {
            throw new Error("One or more fields missing from row: " + warnRow.toString());
        }
        const traces: TraceEntry[] = [];
        if (trace) {
            // trace format: (cfg,fn,file,line,depth,typ,text). We only need file, line and text
            const reg = new RegExp(/\('(.*?)','(.*?)','(.*?)','(.*?)','(.*?)','(.*?)','(.*?)'\)/g);
            const match = [...trace.matchAll(reg)];
            if (match) {
                match.forEach(m => {
                    const fields = m;
                    if (fields[3] && fields[4] && fields[7]) {
                        traces.push({ file: fields[3], line: Number(fields[4]), message: fields[7]});
                    }
                });
            }
        }
        return {
            file: file,
            line: Number(line),
            col: Number(col),
            message: message,
            severity: SeverityStringToSeverityEnum(severity),
            hash: hash,
            checkId: checkId,
            trace: traces,
        };
    }

    // returns a list of hashes, each corresponding to a warning that is suppressed
    function getSuppressedWarningsFromTable(sqlProc: ChildProcessWithoutNullStreams): Promise<string[]> {
        return new Promise((resolve, reject) => {
            sqlProc.stdin.write(`SELECT Count(*) FROM warnings_meta;\n`);
            sqlProc.stdout.once("data", data => {
                const expectedRows = Number(data.toString());

                if (expectedRows > 0) {
                    const query = `SELECT ${CStatWarningField.HASH} FROM warnings_meta;\n`;
                    sqlProc.stdin.write(query);
                    let output = "";
                    sqlProc.stdout.on("data", data => {
                        output += data.toString();
                        const hashes = output.split("\n").filter(line => line.trim().length > 0);
                        if (hashes.length === expectedRows) {
                            resolve(hashes);  // We are done
                        }
                    });
                } else {
                    resolve([]);
                }

            }); /* stdout.once() */

            sqlProc.stderr.once("data", data => {
                reject(data.toString());
            });
        });
    }

    function getSqliteBinaryName(): string | null {
        switch (OsUtils.detectOsType()) {
        case OsUtils.OsType.Windows:
            return "sqlite-v3.26.0-win32-x86.exe";
        case OsUtils.OsType.Linux:
            return "sqlite-v3.37.0-linux-x86";
        case OsUtils.OsType.Mac:
            return "sqlite-v3.26.0-osx-x86";
        default:
            return null;
        }
    }
}

/** Functions for invoking ireport for generating HTML reports */
export namespace CStatReport {
    export function generateHTMLReport(ireportPath: string, cstatOutputDir: string, projectName: string, outputPath: string, full: boolean, onWrite?: (msg: string) => void): Promise<void> {
        const args = [
            "--xml_mode",
            "--db",
            join(cstatOutputDir, "cstat.db"),
            "--project",
            projectName,
            "--output",
            outputPath
        ];
        if (full) {
            args.push("--full");
        }

        if (!Fs.existsSync(ireportPath)) {
            return Promise.reject(new Error(`The program ${ireportPath} does not exists.`));
        }
        const ireport = spawn(ireportPath, args);
        ireport.stdout.on("data", data => {
            onWrite?.(data.toString());
        });
        return ProcessUtils.waitForExit(ireport);
    }
}