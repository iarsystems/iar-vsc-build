/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

'use strict';

import * as Vscode from "vscode";
import * as Thrift from "thrift";
import { Workbench } from "../../tools/workbench";
import { spawn, ChildProcess } from "child_process";
import * as path from "path";
import * as fs from "fs";
import { OsUtils } from "../../../utils/utils";
import { ServiceLocation, Transport, Protocol } from "./bindings/ServiceRegistry_types";
import { ThriftClient } from "./thriftclient";

import * as CSpyServiceRegistry from "./bindings/CSpyServiceRegistry";
import * as CSpyServiceManager from "./bindings/CSpyServiceManager";
import { SERVICE_MANAGER_SERVICE } from "./bindings/ServiceManager_types";
import { tmpdir } from "os";
import { v4 as uuidv4 } from "uuid";

/**
 * Provides and manages thrift services for a workbench.
 */
export class ThriftServiceManager {
    private static readonly SERVICE_LOOKUP_TIMEOUT = 1000;
    private static readonly REGISTRY_EXIT_TIMEOUT = 2000;

    /**
     * Create a new service manager from the given service registry.
     * @param process The service manager process serving the service registry.
     * @param registryLocation The location of the service registry to use.
     */
    constructor(private process: ChildProcess, private registryLocation: ServiceLocation) {
    }

    /**
     * Stops the service manager and all services created by it.
     * After this, the manager and its services is to be
     * considered invalid, and may not be used again. If you need
     * a service manager for the same workbench later, you may start a new one.
     */
    public async stop() {
        const serviceMgr = await this.findService(SERVICE_MANAGER_SERVICE, CSpyServiceManager);
        await serviceMgr.service.shutdown();
        serviceMgr.close();
        // Wait for service registry process to exit
        if(this.process.exitCode === null) {
            await new Promise((resolve, reject) => {
                this.process.on("exit", resolve);
                setTimeout(() => {
                    reject("Service registry exit timed out");
                    this.process.kill();
                }, ThriftServiceManager.REGISTRY_EXIT_TIMEOUT);
            });
        }
    }

    /**
     * Connects to a service with the given name. The service must already be started
     * (or in the process of starting), otherwise this method will never return.
     */
    public async findService<T>(serviceId: string, serviceType: Thrift.TClientConstructor<T>): Promise<ThriftClient<T>> {
        const registry = await this.getServiceAt(this.registryLocation, CSpyServiceRegistry);

        const location = await registry.service.waitForService(serviceId, ThriftServiceManager.SERVICE_LOOKUP_TIMEOUT);
        const service = await this.getServiceAt(location, serviceType);

        registry.close();

        return service;
    }

    private getServiceAt<T>(location: ServiceLocation, serviceType: Thrift.TClientConstructor<T>): Promise<ThriftClient<T>> {
        if (location.transport !== Transport.Socket) {
            return Promise.reject(new Error("Trying to connect to service with unsupported transport."));
        }
        const options: Thrift.ConnectOptions = {
            transport: Thrift.TBufferedTransport,
            protocol: location.protocol === Protocol.Binary ? Thrift.TBinaryProtocol : Thrift.TJSONProtocol,
        };
        return new Promise((resolve, reject) => {
            const conn = Thrift.createConnection(location.host, location.port, options)
                .on("error", err => reject(err))
                .on("connect", async () => {
                    const client = Thrift.createClient<T>(serviceType, conn);
                    resolve(new ThriftClient(conn, client));
                });
        });
    }

}

export namespace ThriftServiceManager {
    let output: Vscode.OutputChannel | undefined;

    /**
     * Readies a service registry/manager and waits for it to finish starting before returning.
     * @param workbench The workbench to use
     */
    export async function fromWorkbench(workbench: Workbench): Promise<ThriftServiceManager> {
        if (!output) { output = Vscode.window.createOutputChannel("IarServiceManager"); }

        let registryPath = path.join(workbench.path.toString(), "common/bin/IarServiceLauncher");
        if (OsUtils.OsType.Windows === OsUtils.detectOsType()) {
            registryPath += ".exe";
        }
        // for now needs to load projectmanager at launch, otherwise it seems to behave strangely
        const projectManagerManifestPath = path.join(workbench.path.toString(), "common/bin/projectmanager.json");
        const tmpDir = getTmpDir(workbench);
        const locationFile = path.join(tmpDir, "CSpyServer2-ServiceRegistry.txt");
        let serviceRegistryProcess: ChildProcess | undefined;

        let resolved = false;
        return new Promise<ThriftServiceManager>((resolve, reject) => {
                // Start watching for the registry file
                fs.watch(tmpDir, undefined, (type, fileName) => {
                    // When the file has been created, read the location of the registry, and create the service manager
                    if (!resolved && serviceRegistryProcess && (type === "rename") && fileName == path.basename(locationFile)) {
                        // Find the location of the service registry
                        const locSerialized = fs.readFileSync(path.join(tmpDir, "CSpyServer2-ServiceRegistry.txt"));
                        // These concats are a hack to create a valid thrift message. The thrift library seems unable to deserialize just a struct (at least for the json protocol)
                        // Once could also do JSON.parse and manually convert it to a ServiceLocation, but this is arguably more robust
                        const transport = new Thrift.TFramedTransport(Buffer.concat([Buffer.from("[1,0,0,0,"), locSerialized, Buffer.from("]")]));
                        const prot = new Thrift.TJSONProtocol(transport);
                        prot.readMessageBegin();
                        const location = new ServiceLocation();
                        location.read(prot);
                        prot.readMessageEnd();

                        resolved = true;
                        fs.rmdirSync(tmpDir, {recursive: true});
                        resolve(new ThriftServiceManager(serviceRegistryProcess, location));
                    }
                });

                serviceRegistryProcess = spawn(registryPath, ["-standalone", "-sockets", projectManagerManifestPath],
                                                        { cwd: tmpDir });

                serviceRegistryProcess.stdout?.on("data", data => {
                    output?.append(data.toString());
                });
                serviceRegistryProcess.on("exit", () => reject("ServiceRegistry exited"));

                setTimeout(() => reject("Service registry launch timed out"), 5000);
        }).catch(e => { serviceRegistryProcess?.kill(); throw e; })
          .finally(() => fs.unwatchFile(locationFile));
    }

    // Creates and returns a temporary directory unique to the currently opened folder & workbench.
    // This is used to store the bootstrap files created by IarServiceLauncher, to avoid conflicts if
    // several service launcher processes are run at the same time.
    function getTmpDir(workbench: Workbench): string {
        const folders = Vscode.workspace.workspaceFolders;
        let openedFolder = "";
        if (folders && folders.length > 0) {
            openedFolder = folders[0].uri.fsPath;
        }
        const hashed = createHash("md5").update(openedFolder + workbench.path).digest("hex");
        const tmpPath = path.join(tmpdir(), "iar-vsc-" + hashed);
        if (!fs.existsSync(tmpPath)) {
            fs.mkdirSync(tmpPath);
        }
        return tmpPath;
    }

}