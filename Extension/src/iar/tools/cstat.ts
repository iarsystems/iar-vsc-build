/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

'use strict';

import { OsUtils } from "../../utils/utils";
import { spawn } from "child_process";
import { PathLike } from "fs";
import { join, dirname } from "path";
import CsvParser = require("csv-parse/lib/sync");
import * as Fs from "fs";

/**
 * Functions for interacting with C-STAT
 */
export namespace CStat {

    export enum CStatWarningSeverity {
        LOW = 0,
        MEDIUM = 1,
        HIGH = 2,
    }
    export interface CStatWarning {
        file: string;
        line: number;
        col: number;
        message: string;
        severity: CStatWarningSeverity;
        checkId: string;
    }

    // Names of relevant columns in the 'warnings' table of the cstat db
    enum CStatWarningField {
        FILE_NAME = "file_name",
        LINE = "line_num",
        COLUMN = "column_num",
        MSG = "msg",
        SEVERITY = "severity",
        CHECKID = "property_alias",
        // TRACE = "encoded_trace",
    }
    const fieldsToLoad: string[] = Object.values(CStatWarningField);

    /**
     * Returns all warnings from the last C-STAT analysis.
     */
    export function getAllWarnings(projectPath: PathLike, configurationName: string, extensionPath: PathLike): Thenable<CStatWarning[]> {
        // the warnings are parsed from cstat.db in the Obj/ output folder
        // we use the sqlite3 executable CLI to perform queries against the database
        const sqliteBin = getSqliteBinaryName();
        if (sqliteBin === null) { return Promise.reject("Couldn't find sqlite binaries for cstat. Your OS likely isn't supported."); }
        const sqliteBinPath = join(extensionPath.toString(), "sqlite-bin", sqliteBin);
        const cstatDBPath = getCStatDBPath(projectPath, configurationName);
        if (!Fs.existsSync(cstatDBPath)) { Promise.reject("Couldn't find cstat DB: " + cstatDBPath); }

        return new Promise((resolve, reject) => {
            const sqlProc = spawn(sqliteBinPath, [cstatDBPath, "-csv"]); // we want csv output for easier parsing

            sqlProc.stdin.write("SELECT Count(*) FROM warnings;\n");
            sqlProc.stdout.once('data', data => {
                const expectedRows = Number(data.toString());

                if (expectedRows > 0) {
                    const query = "SELECT " + fieldsToLoad.join(",") + " FROM warnings;\n";
                    sqlProc.stdin.write(query);
                    let output = "";
                    sqlProc.stdout.on('data', data => {
                        output += data.toString();
                        try {
                            const warnsRaw: string[][] = CsvParser(output);
                            const warnings = warnsRaw.map(row => parseWarning(row));
                            if (warnings.length === expectedRows) {
                                resolve(warnings);  // We are done
                                sqlProc.kill();
                            }
                        } catch (e) { } // CsvParser will throw if we havent recieved all output yet
                    });
                } else {
                    resolve([]);
                    sqlProc.kill();
                }

            }); /* stdout.once() */

            sqlProc.stderr.on('data', data => {
                reject(data.toString());
                sqlProc.kill();
            });
        }); /* new Promise() */
    }

    /**
     * Runs a C-STAT analysis on a given project and configuration
     * (calls IarBuild with the -cstat_analyze parameter)
     */
    export function runAnalysis(builderPath: PathLike, projectPath: PathLike, configurationName: string, onWrite?: (msg: string) => void): Thenable<void> {
        if (!Fs.existsSync(builderPath)) {
            return Promise.reject(`The builder ${builderPath} does not exists.`);
        }

        // It seems we need to delete the db and regenerate it every time to get around
        // some weird behaviour where the db keeps references to files outside the project
        // (specifically when the project is moved or the db is accidentally put under VCS).
        // It seems EW solves this by checking if each file in the db is in the project,
        // but i'm not sure how I would do that in VS Code
        const dbPath = getCStatDBPath(projectPath, configurationName);
        if (Fs.existsSync(dbPath)) { Fs.unlinkSync(dbPath); }

        const iarbuild = spawn(builderPath.toString(), [projectPath.toString(), "-cstat_analyze", configurationName.toString()]);
        iarbuild.stdout.on("data", data => {
            if (onWrite) {
                onWrite(data.toString());
            }
        });

        return new Promise<void>((resolve, reject) => {
            iarbuild.on("close", (code) => {
                if (code !== 0) {
                    reject("C-STAT exited with code: " + code);
                } else {
                    resolve(); // C-STAT is done!
                }
            });
        });
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

    function getCStatDBPath(projectPath: PathLike, configurationName: string) {
        return join(dirname(projectPath.toString()), configurationName, "Obj", "cstat.db");
    }

    function parseWarning(warnRow: string[]): CStatWarning {
        const file     = warnRow[fieldsToLoad.indexOf(CStatWarningField.FILE_NAME)];
        const line     = warnRow[fieldsToLoad.indexOf(CStatWarningField.LINE)];
        const col      = warnRow[fieldsToLoad.indexOf(CStatWarningField.COLUMN)];
        const message  = warnRow[fieldsToLoad.indexOf(CStatWarningField.MSG)];
        const severity = warnRow[fieldsToLoad.indexOf(CStatWarningField.SEVERITY)];
        const checkId  = warnRow[fieldsToLoad.indexOf(CStatWarningField.CHECKID)];
        return {
            file: file,
            line: Number(line),
            col: Number(col),
            message: message,
            severity: SeverityStringToSeverityEnum(severity),
            checkId: checkId,
        };
    }

    function getSqliteBinaryName(): string | null {
        switch (OsUtils.detectOsType()) {
            case OsUtils.OsType.Windows:
                return "sqlite-v3.26.0-win32-x86.exe";
            case OsUtils.OsType.Linux:
                if (OsUtils.detectArchitecture() === OsUtils.Architecture.x64) {
                    return 'sqlite-v3.26.0-linux-x64';
                } else {
                    return 'sqlite-v3.26.0-linux-x86';
                }
            case OsUtils.OsType.Mac:
                return "sqlite-v3.26.0-osx-x86";
            default:
                return null;
        }
    }
}