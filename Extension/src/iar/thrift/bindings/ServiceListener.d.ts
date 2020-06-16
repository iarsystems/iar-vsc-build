//
// Autogenerated by Thrift Compiler (0.14.0)
//
// DO NOT EDIT UNLESS YOU ARE SURE THAT YOU KNOW WHAT YOU ARE DOING
//

import thrift = require('thrift');
import Thrift = thrift.Thrift;
import Q = thrift.Q;
import Int64 = require('node-int64');

import ttypes = require('./ServiceRegistry_types');
import Protocol = ttypes.Protocol
import Transport = ttypes.Transport
import IAR_SERVICE_REGISTRY_ENVVAR = ttypes.IAR_SERVICE_REGISTRY_ENVVAR
import IAR_CSPY_PIPE_PREFIX = ttypes.IAR_CSPY_PIPE_PREFIX
import SERVICE_REGISTRY_SERVICE = ttypes.SERVICE_REGISTRY_SERVICE
import ServiceException = ttypes.ServiceException
import ServiceLocation = ttypes.ServiceLocation

declare class Client {
  #output: thrift.TTransport;
  #pClass: thrift.TProtocol;
  #_seqid: number;

  constructor(output: thrift.TTransport, pClass: { new(trans: thrift.TTransport): thrift.TProtocol });

  servicesChanged(services: { [k: string]: ServiceLocation; }): void;

  servicesChanged(services: { [k: string]: ServiceLocation; }, callback?: (error: void, response: void)=>void): void;
}

declare class Processor {
  #_handler: object;

  constructor(handler: object);
  process(input: thrift.TProtocol, output: thrift.TProtocol): void;
  process_servicesChanged(seqid: number, input: thrift.TProtocol, output: thrift.TProtocol): void;
}
