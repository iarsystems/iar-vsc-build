//
// Autogenerated by Thrift Compiler (0.14.0)
//
// DO NOT EDIT UNLESS YOU ARE SURE THAT YOU KNOW WHAT YOU ARE DOING
//

import thrift = require('thrift');
import Thrift = thrift.Thrift;
import Q = thrift.Q;
import Int64 = require('node-int64');
import ServiceRegistry_ttypes = require('./ServiceRegistry_types');
import shared_ttypes = require('./shared_types');


import ttypes = require('./crun_types');
import CRunBreakAction = ttypes.CRunBreakAction
import CRUN_DISPLAY_SERVICE = ttypes.CRUN_DISPLAY_SERVICE
import CRUN_BACKEND_SERVICE = ttypes.CRUN_BACKEND_SERVICE
import CRunMessage = ttypes.CRunMessage

/**
 * Service for controlling filters and actions.
 */
declare class Client {
  #output: thrift.TTransport;
  #pClass: thrift.TProtocol;
  #_seqid: number;

  constructor(output: thrift.TTransport, pClass: { new(trans: thrift.TTransport): thrift.TProtocol });

  loadFilters(filename: string): void;

  loadFilters(filename: string, callback?: (error: void, response: void)=>void): void;

  saveFilters(filename: string): void;

  saveFilters(filename: string, callback?: (error: void, response: void)=>void): void;

  addRuleOnMessage(messageName: string): void;

  addRuleOnMessage(messageName: string, callback?: (error: void, response: void)=>void): void;

  addRuleOnMessageFile(messageName: string, file: string): void;

  addRuleOnMessageFile(messageName: string, file: string, callback?: (error: void, response: void)=>void): void;

  addRuleOnMessageRange(messageName: string, range: shared_ttypes.SourceRange): void;

  addRuleOnMessageRange(messageName: string, range: shared_ttypes.SourceRange, callback?: (error: void, response: void)=>void): void;

  setDefaultAction(action: CRunBreakAction): void;

  setDefaultAction(action: CRunBreakAction, callback?: (error: void, response: void)=>void): void;

  getDefaultAction(): CRunBreakAction;

  getDefaultAction(callback?: (error: void, response: CRunBreakAction)=>void): void;
}

declare class Processor {
  #_handler: object;

  constructor(handler: object);
  process(input: thrift.TProtocol, output: thrift.TProtocol): void;
  process_loadFilters(seqid: number, input: thrift.TProtocol, output: thrift.TProtocol): void;
  process_saveFilters(seqid: number, input: thrift.TProtocol, output: thrift.TProtocol): void;
  process_addRuleOnMessage(seqid: number, input: thrift.TProtocol, output: thrift.TProtocol): void;
  process_addRuleOnMessageFile(seqid: number, input: thrift.TProtocol, output: thrift.TProtocol): void;
  process_addRuleOnMessageRange(seqid: number, input: thrift.TProtocol, output: thrift.TProtocol): void;
  process_setDefaultAction(seqid: number, input: thrift.TProtocol, output: thrift.TProtocol): void;
  process_getDefaultAction(seqid: number, input: thrift.TProtocol, output: thrift.TProtocol): void;
}
