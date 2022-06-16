/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */



import { BackupUtils, ProcessUtils } from "../../utils/utils";
import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { join } from "path";
import CsvParser = require("csv-parse/lib/sync");
import * as Fs from "fs";
import { OsUtils } from "iar-vsc-common/osUtils";
import { logger } from "iar-vsc-common/logger";

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
     * @param cstatOutputDirs directories to search for cstat output in (i.e. the cstat database)
     * @param extensionPath path to the root of this extension
     * @param extraBuildArguments extra arguments to pass to iarbuild.
     * @param onWrite an output channel for writing logs and other messages while running
     */
    export async function runAnalysis(
        builderPath: string,
        projectPath: string,
        configurationName: string,
        cstatOutputDirs: string[],
        extensionPath: string,
        extraBuildArguments: string[],
        onWrite?: (msg: string) => void
    ): Promise<CStatWarning[]> {

        if (!Fs.existsSync(builderPath)) {
            return Promise.reject(new Error(`The builder ${builderPath} does not exists.`));
        }

        const possibleDbPaths = cstatOutputDirs.map(outputDir => join(outputDir, "cstat.db"));
        possibleDbPaths.forEach(dbPath => {
            // It seems we need to delete the db and regenerate it every time to get around
            // some weird behaviour where the db keeps references to files outside the project
            // (specifically when the project is moved or the db is accidentally put under VCS).
            // EW solves this by checking if each file in the db is in the project, but we don't
            // always have that data in VS Code.
            if (Fs.existsSync(dbPath)) {
                Fs.unlinkSync(dbPath);
            }
        });
        const args = [projectPath, "-cstat_analyze", configurationName, "-log", "info"].concat(extraBuildArguments);
        onWrite?.(`> '${builderPath}' ${args.map(arg => `'${arg}'`).join(" ")}\n`);
        await BackupUtils.doWithBackupCheck(projectPath, async() => {
            const iarbuild = spawn(builderPath, args);
            iarbuild.stdout.on("data", data => {
                onWrite?.(data.toString());
            });

            await ProcessUtils.waitForExit(iarbuild);
        });

        onWrite?.("Reading C-STAT output.\n");
        const actualDb = possibleDbPaths.find(dbPath => {
            return Fs.existsSync(dbPath);
        });
        if (actualDb) {
            onWrite?.(`C-STAT database: ${actualDb}\n`);
            return getAllWarnings(actualDb, extensionPath);
        } else {
            return Promise.reject(new Error("Could not find the C-STAT database. Searched locations:\n" + possibleDbPaths.join("\n")));
        }
    }

    export function SeverityStringToSeverityEnum(severity: string): CStatWarningSeverity {
        switch (severity) {
        case "Low":    return CStatWarningSeverity.LOW;
        case "Medium": return CStatWarningSeverity.MEDIUM;
        case "High":   return CStatWarningSeverity.HIGH;
        default:
            logger.warn("Unrecognized C-STAT severity: " + severity);
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
            // Check that the table exists, otherwise resolve an empty array
            sqlProc.stdin.write(`SELECT Count(*) FROM sqlite_master WHERE type IS 'table' AND name IS '${tableName}';\n`);
            sqlProc.stdout.once("data", count => {
                if (count.toString() === "0\n") {
                    resolve([]);
                    return;
                }
                // Get column names
                sqlProc.stdin.write(`SELECT sql FROM sqlite_master WHERE type IS 'table' AND name IS '${tableName}';\n`);
                sqlProc.stdout.once("data", tableData => {
                    // The name of the check is contained in property_alias if present, otherwise in property_id
                    const checkIdColumn = tableData.toString().includes("property_alias") ? "property_alias" : "property_id";

                    // Get number of warnings
                    sqlProc.stdin.write(`SELECT Count(*) FROM ${tableName};\n`);
                    sqlProc.stdout.once("data", data => {
                        const expectedRows = Number(data.toString());

                        if (expectedRows > 0) {
                            // Get table rows
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

                    }); /* SELECT Count(*) */
                }); /* SELECT sql */
            }); /* SELECT Count(*) */

            sqlProc.stderr.once("data", data => {
                reject(data.toString());
            });
            sqlProc.on("exit", code => {
                if (code !== 0) {
                    reject(new Error("sqlite exited with code " + code));
                }
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
            sqlProc.on("exit", code => {
                if (code !== 0) {
                    reject(new Error("sqlite exited with code " + code));
                }
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
    const REPORT_DEFAULT_NAME = "C-STAT report.html";
    /**
     * Generates an HTML C-STAT report from a C-STAT database.
     * @param ireportPath path to the ireport executable to use
     * @param cstatOutputDirs directories to search for the cstat database in
     * @param projectName the project name to put in the report
     * @param onWrite an output channel for writing logs and other messages while running
     * @returns the path to the generated report
     */
    export async function generateHTMLReport(ireportPath: string, cstatOutputDirs: string[], projectName: string, full: boolean, onWrite?: (msg: string) => void): Promise<string> {
        const actualOutputDir = cstatOutputDirs.find(outputDir => {
            return Fs.existsSync(join(outputDir, "cstat.db"));
        });
        if (!actualOutputDir) {
            return Promise.reject(new Error("Please run a C-STAT analysis before genering an HTML report. Could not find the C-STAT database."));
        }
        const dbPath = join(actualOutputDir, "cstat.db");
        const reportPath = join(actualOutputDir, REPORT_DEFAULT_NAME);
        const args = [
            "--db",
            dbPath,
            "--project",
            projectName,
            "--output",
            reportPath
        ];
        if (full) {
            args.push("--full");
        }

        if (!Fs.existsSync(ireportPath)) {
            return Promise.reject(new Error(`The program ${ireportPath} does not exist.`));
        }
        if (!Fs.existsSync(dbPath)) {
            return Promise.reject(new Error(`The C-STAT database ${dbPath} does not exist. Please run a C-STAT analysis before genering an HTML report.`));
        }
        onWrite?.(`> '${ireportPath}' ${args.map(arg => `'${arg}'`).join(" ")}\n`);
        const ireport = spawn(ireportPath, args);
        ireport.stdout.on("data", data => {
            onWrite?.(data.toString());
        });
        await ProcessUtils.waitForExit(ireport);
        return reportPath;
    }
}