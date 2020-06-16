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


import ttypes = require('./sourcelookup_types');
import SOURCE_LOOKUP_SERVICE = ttypes.SOURCE_LOOKUP_SERVICE
import HeartbeatService = require('./HeartbeatService');

declare class Client extends HeartbeatService.Client {
  #output: thrift.TTransport;
  #pClass: thrift.TProtocol;
  #_seqid: number;

  constructor(output: thrift.TTransport, pClass: { new(trans: thrift.TTransport): thrift.TProtocol });

  getSourceRanges(loc: shared_ttypes.Location): shared_ttypes.SourceRange[];

  getSourceRanges(loc: shared_ttypes.Location, callback?: (error: shared_ttypes.CSpyException, response: shared_ttypes.SourceRange[])=>void): void;
}

declare class Processor extends HeartbeatService.Processor {
  #_handler: object;

  constructor(handler: object);
  process(input: thrift.TProtocol, output: thrift.TProtocol): void;
  process_getSourceRanges(seqid: number, input: thrift.TProtocol, output: thrift.TProtocol): void;
}
