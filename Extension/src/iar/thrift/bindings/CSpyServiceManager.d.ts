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


import ttypes = require('./ServiceManager_types');
import SERVICE_MANAGER_SERVICE = ttypes.SERVICE_MANAGER_SERVICE
import ServiceConfig = ttypes.ServiceConfig
import LauncherConfig = ttypes.LauncherConfig

/**
 * A Thrift service to manage other Thrift services.
 * A manager knows about a set of Thrift services, which are presented to it
 * via ServiceConfig instances and/or externally (e.g. service manifest files).
 */
declare class Client {
  #output: thrift.TTransport;
  #pClass: thrift.TProtocol;
  #_seqid: number;

  constructor(output: thrift.TTransport, pClass: { new(trans: thrift.TTransport): thrift.TProtocol });

  /**
   * Start the described service.
   * Implementations might be asynchronous, so returning from this method will
   * not guarantee that the service is present.
   * An error during the service initialization will result in an exception
   * being thrown.
   */
  startService(serviceConfig: ServiceConfig): void;

  /**
   * Start the described service.
   * Implementations might be asynchronous, so returning from this method will
   * not guarantee that the service is present.
   * An error during the service initialization will result in an exception
   * being thrown.
   */
  startService(serviceConfig: ServiceConfig, callback?: (error: ServiceRegistry_ttypes.ServiceException, response: void)=>void): void;

  /**
   * Stop the described service.
   * Implementations might be asynchronous, so returning from this method will
   * not guarantee that the service has actually been destroyed.
   * An error during the service shutdown will result in an exception
   * being thrown.
   */
  stopService(serviceConfig: ServiceConfig): void;

  /**
   * Stop the described service.
   * Implementations might be asynchronous, so returning from this method will
   * not guarantee that the service has actually been destroyed.
   * An error during the service shutdown will result in an exception
   * being thrown.
   */
  stopService(serviceConfig: ServiceConfig, callback?: (error: ServiceRegistry_ttypes.ServiceException, response: void)=>void): void;

  /**
   *    Start all the services described by the JSON manifest file at the provided path,
   *    in the order they are specified.
   *    <p>
   *    Each JSON manifest file contains a list of {@link #ServiceConfig} (<tt>services</tt>):
   *    <pre>
   *    {
   *    "services":[
   *        {
   *        "name":"com.iar.OptionHandler.service",
   *        "libraryName":"OptionHandler",
   *        "spawnNewProcess":false,
   *        "startupEntryPoint":"StartOptionHandlerService",
   *        "shutdownEntryPoint":"StopOptionHandlerService",
   *        "registerInLauncher":false
   *        }
   *    ]
   * }
   * </pre>
   * 
   * where the library specified in libraryName is expected in the same folder as the JSON file itself.
   * 
   *    <p>
   *    For further description of the JSON file syntax
   *    http://wiki.iar.se/iarwiki/IarServiceLauncher#JSON_service_manifest_files
   *    
   *    <p>
   *    Implementations might be asynchronous, so returning from this method will
   *    not guarantee that the service is present.
   *    An error during the service initialization will result in an exception
   *    being thrown.
   */
  startServicesFromJsonManifest(jsonFilePath: string): void;

  /**
   *    Start all the services described by the JSON manifest file at the provided path,
   *    in the order they are specified.
   *    <p>
   *    Each JSON manifest file contains a list of {@link #ServiceConfig} (<tt>services</tt>):
   *    <pre>
   *    {
   *    "services":[
   *        {
   *        "name":"com.iar.OptionHandler.service",
   *        "libraryName":"OptionHandler",
   *        "spawnNewProcess":false,
   *        "startupEntryPoint":"StartOptionHandlerService",
   *        "shutdownEntryPoint":"StopOptionHandlerService",
   *        "registerInLauncher":false
   *        }
   *    ]
   * }
   * </pre>
   * 
   * where the library specified in libraryName is expected in the same folder as the JSON file itself.
   * 
   *    <p>
   *    For further description of the JSON file syntax
   *    http://wiki.iar.se/iarwiki/IarServiceLauncher#JSON_service_manifest_files
   *    
   *    <p>
   *    Implementations might be asynchronous, so returning from this method will
   *    not guarantee that the service is present.
   *    An error during the service initialization will result in an exception
   *    being thrown.
   */
  startServicesFromJsonManifest(jsonFilePath: string, callback?: (error: ServiceRegistry_ttypes.ServiceException, response: void)=>void): void;

  /**
   * Stop the service described by the JSON manifest file at the provided path,
   * in reverse order with respect to their specification in the manifest.
   * <p>
   * See {@link #startServicesFromJsonManifest} for further details on the JSON manifest file format.
   * <p>
   * Implementations might be asynchronous, so returning from this method will
   * not guarantee that the service is present.
   * An error during the service shutdown will result in an exception
   * being thrown.
   */
  stopServicesFromJsonManifest(jsonFilePath: string): void;

  /**
   * Stop the service described by the JSON manifest file at the provided path,
   * in reverse order with respect to their specification in the manifest.
   * <p>
   * See {@link #startServicesFromJsonManifest} for further details on the JSON manifest file format.
   * <p>
   * Implementations might be asynchronous, so returning from this method will
   * not guarantee that the service is present.
   * An error during the service shutdown will result in an exception
   * being thrown.
   */
  stopServicesFromJsonManifest(jsonFilePath: string, callback?: (error: ServiceRegistry_ttypes.ServiceException, response: void)=>void): void;

  /**
   * Shutdown the service manager, destroying all active services.
   * Implementations might be asynchronous, so returning from this method will
   * not guarantee that the service manager is indeed shutdown.
   */
  shutdown(): void;

  /**
   * Shutdown the service manager, destroying all active services.
   * Implementations might be asynchronous, so returning from this method will
   * not guarantee that the service manager is indeed shutdown.
   */
  shutdown(callback?: (error: ServiceRegistry_ttypes.ServiceException, response: void)=>void): void;
}

declare class Processor {
  #_handler: object;

  constructor(handler: object);
  process(input: thrift.TProtocol, output: thrift.TProtocol): void;
  process_startService(seqid: number, input: thrift.TProtocol, output: thrift.TProtocol): void;
  process_stopService(seqid: number, input: thrift.TProtocol, output: thrift.TProtocol): void;
  process_startServicesFromJsonManifest(seqid: number, input: thrift.TProtocol, output: thrift.TProtocol): void;
  process_stopServicesFromJsonManifest(seqid: number, input: thrift.TProtocol, output: thrift.TProtocol): void;
  process_shutdown(seqid: number, input: thrift.TProtocol, output: thrift.TProtocol): void;
}
