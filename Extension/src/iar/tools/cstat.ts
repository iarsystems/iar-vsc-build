/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

'use strict';

import { OsUtils } from "../../utils/utils";
import { spawn } from "child_process";
import * as vscode from "vscode"
import { PathLike } from "fs";
import { join, dirname } from "path";
import CsvParser = require("csv-parse/lib/sync");

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
        TRACE = "encoded_trace",
    }
    const fieldsToLoad: CStatWarningField[] = Object.values(CStatWarningField);

    /**
     * Returns all warnings from the last C-STAT analysis.
     */
    export function getAllWarnings(projectPath: PathLike, configurationName: string, extensionPath: PathLike): Thenable<CStatWarning[]> {
        // the warnings are parsed from cstat.db in the Obj/ output folder
        // we use the sqlite3 executable CLI to perform queries against the database
        const sqliteBin = getSqliteBinaryName();
        if (sqliteBin == null) return Promise.reject();
        const sqliteBinPath = join(extensionPath.toString(), "sqlite-bin", sqliteBin);
        const cstatDBPath = join(dirname(projectPath.toString()), configurationName, "Obj", "cstat.db");

        return new Promise((resolve, reject) => {
            const sqlProc = spawn(sqliteBinPath, [cstatDBPath, "-csv"]); // we want csv output for easier parsing

            sqlProc.stdin.write("SELECT Count(*) FROM warnings;\n");
            sqlProc.stdout.once('data', data => {
                const expectedRows = Number(data.toString());

                const query = "SELECT " + fieldsToLoad.join(",") + " FROM warnings;\n";
                sqlProc.stdin.write(query);
                let warnings: CStatWarning[] = [];
                sqlProc.stdout.on('data', data => {
                    const warnsRaw: string[][] = CsvParser(data.toString());
                    warnings = warnings.concat(warnsRaw.map(row => parseWarning(row)));
                    if (warnings.length == expectedRows) {
                        resolve(warnings);  // We are done
                        sqlProc.kill();
                    }
                });

            }); /* stdout.once() */

            sqlProc.stderr.on('data', data => {
                console.log(data.toString());
                reject();
                sqlProc.kill();
            });
        }); /* new Promise() */
    }

    /**
     * Runs a C-STAT analysis on a given project and configuration
     * (calls IarBuild with the -cstat_analyze parameter)
     */
    export function runAnalysis(workbenchPath: PathLike, projectPath: PathLike, configurationName: string): Thenable<void> {
        let iarBuildPath = workbenchPath + "/common/bin/IarBuild";
        if (OsUtils.detectOsType() == OsUtils.OsType.Windows) {
            iarBuildPath += ".exe";
        }
        const iarbuild = spawn(iarBuildPath.toString(), [projectPath.toString(), "-cstat_analyze", configurationName.toString()]);
        iarbuild.stdout.on("data", data => {
            console.log(data.toString()); // TODO: Maybe remove in production code?
        })

        return new Promise<void>((resolve, reject) => {
            iarbuild.on("close", (code) => {
                if (code !== 0) {
                    vscode.window.showErrorMessage("An error occured when running C-STAT, exit code: " + code);
                    reject();
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
        }
    }

    function getSqliteBinaryName(): string | null {
        switch (OsUtils.detectOsType()) {
            case OsUtils.OsType.Windows:
                return "sqlite-v3.26.0-win32-x86.exe";
            case OsUtils.OsType.Linux:
                if (OsUtils.detectArchitecture() == OsUtils.Architecture.x64) {
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