/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

'use strict';

import * as Vscode from "vscode";
import * as Thrift from "thrift";
import { Workbench } from "../tools/workbench";
import { spawn, ChildProcess } from "child_process";
import * as path from "path";
import * as fs from "fs";
import { OsUtils } from "../../utils/utils";
import { ServiceLocation } from "./bindings/ServiceRegistry_types";
import { ThriftClient } from "./ThriftClient";

import * as CSpyServiceRegistry from "./bindings/CSpyServiceRegistry";
import * as CSpyServiceManager from "./bindings/CSpyServiceManager";
import { SERVICE_MANAGER_SERVICE } from "./bindings/ServiceManager_types";
import { createHash } from "crypto";
import { tmpdir } from "os";

/**
 * Provides and manages a set of services for a workbench.
 * TODO: Make this singleton-ish, since there can and should only be one per workspace
 */
export class ThriftServiceManager {
    private static output: Vscode.OutputChannel;
    private serviceRegistryProcess: ChildProcess;

    constructor(private readonly workbench: Workbench) {
        if (!ThriftServiceManager.output) { ThriftServiceManager.output = Vscode.window.createOutputChannel("IarServiceManager"); }
        // TODO: figure out what to do if one already exists, and we did not create it.
        let registryPath = path.join(this.workbench.path.toString(), "common/bin/IarServiceLauncher");
        if (OsUtils.OsType.Windows === OsUtils.detectOsType()) {
            registryPath += ".exe";
        }
        // for now needs to load projectmanager at launch, otherwise it seems to behave strangely
        const projectManagerManifestPath = path.join(this.workbench.path.toString(), "common/bin/projectmanager.json");
        this.serviceRegistryProcess = spawn(registryPath, ["-standalone", "-sockets", projectManagerManifestPath],
                                                { cwd: this.getTmpDir() }); 
        this.serviceRegistryProcess.stdout.on("data", data => {
            ThriftServiceManager.output.append(data.toString());
        });
    }

    /**
     * Stops the service manager and all services created by it.
     * After this, the manager and its services is to be
     * considered invalid, and may not be used again. If you need
     * a service manager for the same workbench later, you may start a new one.
     */
    public async stop() {
        const serviceMgr = await this.findService(SERVICE_MANAGER_SERVICE, CSpyServiceManager);
        serviceMgr.service.shutdown();
        serviceMgr.close();
    }

    /**
     * Connects to a service with the given name. The service must already be started
     * (or in the process of starting), otherwise this method will never return.
     */
    public async findService<T>(serviceId: string, serviceType: Thrift.TClientConstructor<T>): Promise<ThriftClient<T>> {
        await new Promise((r, _e) => setTimeout(r, 100)); // temp hack to make sure service launcher is ready
        const registry = await this.getServiceAt(this.getRegistryLocation(), CSpyServiceRegistry);

        console.log("Waiting for service to appear: ", serviceId);
        const location = await registry.service.waitForService(serviceId, 1000);
        console.log("Service ", serviceId, " found at location ", location);
        const service = await this.getServiceAt(location, serviceType);

        registry.close();

        return service;
    }

    private getRegistryLocation(): ServiceLocation {
        // TODO: wait for a bit if it doesn't exist?
        const locPath = path.join(this.getTmpDir(), "CSpyServer2-ServiceRegistry.txt");

        console.log("Reading port...");
        const locSerialized = fs.readFileSync(locPath);
        console.log("Location is: " + locSerialized);

        // These concats are a hack to create a valid thrift message. The thrift library seems unable to deserialize just a struct (at least for the json protocol)
        // Once could also do JSON.parse and manually convert it to a ServiceLocation, but this is arguably more robust
        const transport = new Thrift.TFramedTransport(Buffer.concat([Buffer.from("[1,0,0,0,"), locSerialized, Buffer.from("]")]));
        const prot = new Thrift.TJSONProtocol(transport);
        prot.readMessageBegin();
        const location = new ServiceLocation();
        location.read(prot);
        prot.readMessageEnd();
        console.log("Port is: " + location.port);

        return location;
    }

    private getServiceAt<T>(location: ServiceLocation, serviceType: Thrift.TClientConstructor<T>): Promise<ThriftClient<T>> {
        const options: Thrift.ConnectOptions = {
            transport: location.transport === 0 ? Thrift.TBufferedTransport : Thrift.TFramedTransport,
            protocol: location.protocol === 0 ? Thrift.TBinaryProtocol : Thrift.TJSONProtocol,
        };
        return new Promise((resolve, reject) => {
            const conn = Thrift.createConnection(location.host, location.port, options)
                .on("error", err => reject(err))
                .on("connect", async () => {
                    const client = Thrift.createClient<T>(serviceType, conn);
                    resolve(new ThriftClient(conn, client));
                }).on("close", () => console.log("Connection closed for", location.port));
        });
    }

    // Creates and returns a temporary directory unique to the currently opened folder/workspace.
    // This is used to store the bootstrap files created by IarServiceLauncher, to avoid conflicts if
    // several service launcher processes are run at the same time.
    private getTmpDir(): string {
        const folders = Vscode.workspace.workspaceFolders;
        let openedFolder = "";
        if (folders && folders.length > 0) {
            openedFolder = folders[0].uri.fsPath;
        }
        const hashed = createHash("md5").update(openedFolder).digest("hex");
        const tmpPath = path.join(tmpdir(), hashed);
        if (!fs.existsSync(tmpPath)) {
            fs.mkdirSync(tmpPath);
        }
        return tmpPath;
    }

}