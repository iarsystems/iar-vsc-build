/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as Path from "path";
import { Workbench } from "iar-vsc-common/workbench";
import { PROJECTMANAGER_ID } from "iar-vsc-common/thrift/bindings/projectmanager_types";
import { SERVICE_MANAGER_SERVICE } from "iar-vsc-common/thrift/bindings/ServiceManager_types";
import * as CSpyServiceManager from "iar-vsc-common/thrift/bindings/CSpyServiceManager";
import { OsUtils } from "iar-vsc-common/osUtils";
import { IarVsc } from "../../../extension/main";
import { FsUtils } from "../../../utils/fs";
import { ProcessMonitor, ThriftServiceRegistryProcess } from "iar-vsc-common/thrift/thriftServiceRegistryProcess";
import { ThriftServiceRegistry } from "iar-vsc-common/thrift/thriftServiceRegistry";

export namespace ProjectManagerLauncher {

    /**
     * Uses the given workbench to launch a service registry and the project manager service.
     */
    export async function launchFromWorkbench(workbench: Workbench): Promise<ThriftServiceRegistryProcess> {

        let launcherPath = Path.join(workbench.path.toString(), "common/bin/IarServiceLauncher");
        if (OsUtils.OsType.Windows === OsUtils.detectOsType()) {
            launcherPath += ".exe";
        }

        // for now needs to load projectmanager at launch, otherwise it seems to behave strangely
        const args = [
            "-standalone",
            "-sockets",
            Path.join(workbench.path.toString(), "common/bin/projectmanager.json"),
        ];
        const logForwarderManifest = Path.join(workbench.path.toString(), "common/bin/logforwarder.json");
        if (await FsUtils.exists(logForwarderManifest)) {
            args.push(logForwarderManifest);
        }

        const stopProcess = async function(registry: ThriftServiceRegistry) {
            const serviceMgr = await registry.findService(SERVICE_MANAGER_SERVICE, CSpyServiceManager);
            await serviceMgr.service.shutdown();
            serviceMgr.close();
        };

        const output = IarVsc.outputChannelProvider.getOutputChannel("IarServiceLauncher");

        const processMonitor: ProcessMonitor = {
            stdout: data => output?.info(data),
            stderr: data => output?.error(data),
            exit:   code => output?.appendLine(`Service launcher exited with code ${code}`),
        };


        return ThriftServiceRegistryProcess.launch(launcherPath, args, stopProcess, PROJECTMANAGER_ID, processMonitor);
    }
}