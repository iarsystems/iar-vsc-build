/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

'use strict';

import * as Thrift from "thrift";
import { EventEmitter } from "events";

/**
 * A client connected to a thrift service. The owner is responsible for
 * closing the client when done with it. Emits 'close' when closed.
 */
export class ThriftClient<T> extends EventEmitter {
    private closed = false;

    constructor(private connection: Thrift.Connection, private _service: T) {
        super();
        this.connection.on("close", () => {
            this.closed = true;
            this.emit("close");
        });
    }

    public get service(): T {
        return this._service;
    }

    /**
     * Disconnect the client. Do not use the client after closing it.
     */
    public close() {
        if (!this.closed) {
            this.connection.end();
        }
    }
}