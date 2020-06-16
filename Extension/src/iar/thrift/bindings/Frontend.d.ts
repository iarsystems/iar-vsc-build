/// <reference path="HeartbeatService.d.ts" />
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


import ttypes = require('./frontend_types');
import MsgIcon = ttypes.MsgIcon
import MsgKind = ttypes.MsgKind
import MsgResult = ttypes.MsgResult
import FRONTEND_SERVICE = ttypes.FRONTEND_SERVICE
import HeartbeatService = require('./HeartbeatService');

declare class Client extends HeartbeatService.Client {
  #output: thrift.TTransport;
  #pClass: thrift.TProtocol;
  #_seqid: number;

  constructor(output: thrift.TTransport, pClass: { new(trans: thrift.TTransport): thrift.TProtocol });

  messageBox(msg: string, caption: string, icon: MsgIcon, kind: MsgKind, dontAskMgrKey: string): MsgResult;

  messageBox(msg: string, caption: string, icon: MsgIcon, kind: MsgKind, dontAskMgrKey: string, callback?: (error: void, response: MsgResult)=>void): void;

  messageBoxAsync(msg: string, caption: string, icon: MsgIcon, dontAskMgrKey: string): void;

  messageBoxAsync(msg: string, caption: string, icon: MsgIcon, dontAskMgrKey: string, callback?: (error: void, response: void)=>void): void;

  openFileDialog(title: string, startdir: string, filter: string, allowMultiple: boolean, existing: boolean): string[];

  openFileDialog(title: string, startdir: string, filter: string, allowMultiple: boolean, existing: boolean, callback?: (error: void, response: string[])=>void): void;

  openDirectoryDialog(title: string, existing: boolean, startdir: string): string[];

  openDirectoryDialog(title: string, existing: boolean, startdir: string, callback?: (error: void, response: string[])=>void): void;

  openSaveDialog(title: string, fileName: string, defExt: string, startDir: string, filter: string): string[];

  openSaveDialog(title: string, fileName: string, defExt: string, startDir: string, filter: string, callback?: (error: void, response: string[])=>void): void;

  createProgressBar(msg: string, caption: string, minvalue: Int64, maxvalue: Int64, canCancel: boolean, indeterminate: boolean): number;

  createProgressBar(msg: string, caption: string, minvalue: Int64, maxvalue: Int64, canCancel: boolean, indeterminate: boolean, callback?: (error: void, response: number)=>void): void;

  updateProgressBarValue(id: number, value: Int64): boolean;

  updateProgressBarValue(id: number, value: Int64, callback?: (error: void, response: boolean)=>void): void;

  updateProgressBarMessage(id: number, message: string): boolean;

  updateProgressBarMessage(id: number, message: string, callback?: (error: void, response: boolean)=>void): void;

  closeProgressBar(id: number): void;

  closeProgressBar(id: number, callback?: (error: void, response: void)=>void): void;

  showView(id: string): void;

  showView(id: string, callback?: (error: void, response: void)=>void): void;

  openElementSelectionDialog(title: string, message: string, elements: string[]): number;

  openElementSelectionDialog(title: string, message: string, elements: string[], callback?: (error: void, response: number)=>void): void;

  openMultipleElementSelectionDialog(title: string, message: string, elements: string[]): number[];

  openMultipleElementSelectionDialog(title: string, message: string, elements: string[], callback?: (error: void, response: number[])=>void): void;

  editSourceLocation(loc: shared_ttypes.SourceLocation): void;

  editSourceLocation(loc: shared_ttypes.SourceLocation, callback?: (error: void, response: void)=>void): void;

  resolveAliasForFile(fileName: string, suggestedFile: string): string;

  resolveAliasForFile(fileName: string, suggestedFile: string, callback?: (error: void, response: string)=>void): void;
}

declare class Processor extends HeartbeatService.Processor {
  #_handler: object;

  constructor(handler: object);
  process(input: thrift.TProtocol, output: thrift.TProtocol): void;
  process_messageBox(seqid: number, input: thrift.TProtocol, output: thrift.TProtocol): void;
  process_messageBoxAsync(seqid: number, input: thrift.TProtocol, output: thrift.TProtocol): void;
  process_openFileDialog(seqid: number, input: thrift.TProtocol, output: thrift.TProtocol): void;
  process_openDirectoryDialog(seqid: number, input: thrift.TProtocol, output: thrift.TProtocol): void;
  process_openSaveDialog(seqid: number, input: thrift.TProtocol, output: thrift.TProtocol): void;
  process_createProgressBar(seqid: number, input: thrift.TProtocol, output: thrift.TProtocol): void;
  process_updateProgressBarValue(seqid: number, input: thrift.TProtocol, output: thrift.TProtocol): void;
  process_updateProgressBarMessage(seqid: number, input: thrift.TProtocol, output: thrift.TProtocol): void;
  process_closeProgressBar(seqid: number, input: thrift.TProtocol, output: thrift.TProtocol): void;
  process_showView(seqid: number, input: thrift.TProtocol, output: thrift.TProtocol): void;
  process_openElementSelectionDialog(seqid: number, input: thrift.TProtocol, output: thrift.TProtocol): void;
  process_openMultipleElementSelectionDialog(seqid: number, input: thrift.TProtocol, output: thrift.TProtocol): void;
  process_editSourceLocation(seqid: number, input: thrift.TProtocol, output: thrift.TProtocol): void;
  process_resolveAliasForFile(seqid: number, input: thrift.TProtocol, output: thrift.TProtocol): void;
}