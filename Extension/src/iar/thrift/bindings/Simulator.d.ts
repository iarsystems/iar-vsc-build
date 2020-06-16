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


import ttypes = require('./sim_types');
import SIM_SERVICE = ttypes.SIM_SERVICE

declare class Client {
  #output: thrift.TTransport;
  #pClass: thrift.TProtocol;
  #_seqid: number;

  constructor(output: thrift.TTransport, pClass: { new(trans: thrift.TTransport): thrift.TProtocol });

  getFrequency(): Int64;

  getFrequency(callback?: (error: void, response: Int64)=>void): void;

  setFrequency(freq: Int64): void;

  setFrequency(freq: Int64, callback?: (error: void, response: void)=>void): void;
}

declare class Processor {
  #_handler: object;

  constructor(handler: object);
  process(input: thrift.TProtocol, output: thrift.TProtocol): void;
  process_getFrequency(seqid: number, input: thrift.TProtocol, output: thrift.TProtocol): void;
  process_setFrequency(seqid: number, input: thrift.TProtocol, output: thrift.TProtocol): void;
}
