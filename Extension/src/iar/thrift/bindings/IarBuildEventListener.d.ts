//
// Autogenerated by Thrift Compiler (0.14.0)
//
// DO NOT EDIT UNLESS YOU ARE SURE THAT YOU KNOW WHAT YOU ARE DOING
//

import thrift = require('thrift');
import Thrift = thrift.Thrift;
import Q = thrift.Q;
import Int64 = require('node-int64');
import shared_ttypes = require('./shared_types');


import ttypes = require('./iarbuild_types');
import NodeType = ttypes.NodeType
import ContextType = ttypes.ContextType
import BuildResult = ttypes.BuildResult
import LogSeverity = ttypes.LogSeverity
import IARBUILD_SERVICE_NAME = ttypes.IARBUILD_SERVICE_NAME
import IARBUILD_EVENTLISTENER_SERVICE_NAME = ttypes.IARBUILD_EVENTLISTENER_SERVICE_NAME
import Node = ttypes.Node
import Context = ttypes.Context
import LogEntry = ttypes.LogEntry
import PreprocessorMacro = ttypes.PreprocessorMacro
import ScannerInfo = ttypes.ScannerInfo

declare class Client {
  #output: thrift.TTransport;
  #pClass: thrift.TProtocol;
  #_seqid: number;

  constructor(output: thrift.TTransport, pClass: { new(trans: thrift.TTransport): thrift.TProtocol });

  optionStatesChanged(context: Context): void;

  optionStatesChanged(context: Context, callback?: (error: void, response: void)=>void): void;

  contentsAdded(context: Context): void;

  contentsAdded(context: Context, callback?: (error: void, response: void)=>void): void;

  contentsRemoved(context: Context): void;

  contentsRemoved(context: Context, callback?: (error: void, response: void)=>void): void;

  logAddCategory(cat: string): void;

  logAddCategory(cat: string, callback?: (error: void, response: void)=>void): void;

  logRemoveCategory(cat: string): void;

  logRemoveCategory(cat: string, callback?: (error: void, response: void)=>void): void;

  logStartSession(cat: string): void;

  logStartSession(cat: string, callback?: (error: void, response: void)=>void): void;

  logEntry(entry: LogEntry): void;

  logEntry(entry: LogEntry, callback?: (error: void, response: void)=>void): void;
}

declare class Processor {
  #_handler: object;

  constructor(handler: object);
  process(input: thrift.TProtocol, output: thrift.TProtocol): void;
  process_optionStatesChanged(seqid: number, input: thrift.TProtocol, output: thrift.TProtocol): void;
  process_contentsAdded(seqid: number, input: thrift.TProtocol, output: thrift.TProtocol): void;
  process_contentsRemoved(seqid: number, input: thrift.TProtocol, output: thrift.TProtocol): void;
  process_logAddCategory(seqid: number, input: thrift.TProtocol, output: thrift.TProtocol): void;
  process_logRemoveCategory(seqid: number, input: thrift.TProtocol, output: thrift.TProtocol): void;
  process_logStartSession(seqid: number, input: thrift.TProtocol, output: thrift.TProtocol): void;
  process_logEntry(seqid: number, input: thrift.TProtocol, output: thrift.TProtocol): void;
}
