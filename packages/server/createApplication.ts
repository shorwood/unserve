import { Once } from '@unshared/decorators'
import { isConstructor } from '@unshared/functions'
import { dedent } from '@unshared/string'
import { Constructor } from '@unshared/types'
import wsAdapter, { NodeOptions } from 'crossws/adapters/node'
import { AppOptions, createApp, createRouter, RouterMethod, toNodeListener } from 'h3'
import { createServer } from 'node:http'
import { DataSource, DataSourceOptions } from 'typeorm'
import { ModuleInstance, ModuleLike, ModuleOptions } from './types'
import { isDataSource } from './utils'
import { createEventHandler } from './utils'

export type ApplicationOptions<T extends ModuleLike = ModuleLike> = Partial<ModuleOptions<T>> & {

  /**
   * The logger instance of the application. It is used to log messages and errors in the
   * application. The logger is used to log messages to the console, file, or other logging
   * services.
   *
   * @default globalThis.console
   */
  logger?: Pick<Console, 'debug' | 'error' | 'log' | 'warn'>

  /**
   * The data source of the application. It is used to connect to the database and perform
   * operations on the database. The data source is used to create repositories and entities
   * that are used in the application.
   *
   * @default { type: 'sqlite', database: ':memory:', synchronize: true }
   */
  dataSource?: DataSource | DataSourceOptions
}

export const DEFAULT_DATA_SOURCE_OPTIONS: DataSourceOptions = {
  type: 'sqlite',
  database: ':memory:',
  synchronize: true,
}

/**
 * An `Application` is, in itself, a container for modules. It is used to group modules together
 * and provide a common context for them. Allowing you to expose all routes, entities, and services
 * of the application in a single place.
 *
 * @template T The modules of the application.
 * @example
 * const application = new Application([
 *   new ModuleUser(),
 *   new ModuleEmail(),
 *   new ModuleSettings(),
 *   new ModuleHealth(),
 * )]
 *
 * // Initialize the application.
 * await application.initialize()
 *
 * // Start the application server.
 * application.createServer().listen(3000)
 */
export class Application<T extends ModuleLike = ModuleLike> {

  /**
   * Is the application initialized.
   *
   * @default false
   */
  isInitialized = false

  /**
   * The `DataSource` of the application. It is used to connect to the database and perform
   * operations on the database. The `DataSource` is used to create repositories and entities
   * that are used in the application.
   */
  dataSource?: DataSource

  /**
   * The modules of the application. These are the modules that are used in the application
   * to perform operations such as sign-in, sign-up, sign-out, as well as other user operations.
   */
  modules = [] as Array<ModuleInstance<T>>

  /**
   * The logger instance of the application. It is used to log messages and errors in the
   * application. The logger is used to log messages to the console, file, or other logging
   * services.
   *
   * @default globalThis.console
   */
  logger: Pick<Console, 'debug' | 'error' | 'log' | 'warn'> = globalThis.console

  /**
   * Instantiate a new application with the given modules and options.
   *
   * @param modules The modules of the application.
   * @param options The options of the application.
   */
  constructor(modules: T[], public options = {} as ApplicationOptions<T>) {

    // --- Set the logger of the application.
    if (options.logger) this.logger = options.logger

    // --- Instantiate all the modules and store them in the application.
    this.modules = modules.map((module) => {
      const isCtor = isConstructor(module)
      const instance = isCtor ? new (module as Constructor)(this.options) : module
      return instance as ModuleInstance<T>
    })

    // --- For each module, check if the dependencies are registered in the application.
    for (const module of this.modules) {
      if (!module.dependencies) continue
      for (const dependency of module.dependencies) {
        const found = this.modules.find(m => m instanceof dependency)
        if (!found) {
          this.logger.warn(dedent(`
            [Application] Missing dependency.

            There has been an error initializing the application. The module "${module.constructor.name}" expects the module "${dependency.name}" to be registered in the application. Please make sure that the module is registered in the application before initializing it.
          `))
        }
      }
    }

    // --- Attach the application reference in the module.
    for (const module of this.modules) module.application = this
  }

  /**
   * Instantiate and initialize a new application with the given modules and options.
   *
   * @param modules The modules of the application.
   * @param options The options of the application.
   * @returns The initialized application.
   * @example
   * const application = await Application.initialize([
   *   new ModuleUser(),
   *   new ModuleEmail(),
   *   new ModuleSettings(),
   *   new ModuleHealth(),
   * ])
   */
  static async initialize<T extends ModuleLike>(modules: T[], options?: ApplicationOptions<T>): Promise<Application<T>> {
    return new Application(modules, options).initialize()
  }

  /**
   * Get the given module from the application. This is used to get the module instance
   * from the application context. It will throw an error if the module is not found.
   *
   * @param module The constructor of the module to get.
   * @param allowUninitialized Whether to allow uninitialized modules to be returned.
   * @returns The module instance.
   */
  getModule<T extends Constructor>(module: T, allowUninitialized = false): InstanceType<T> {
    const result = this.modules.find(m => m instanceof module)
    if (!result) throw new Error(`Module with constructor "${module.name}" not found`)
    if (!allowUninitialized && result.isInitialized === false) throw new Error(`Module "${module.name}" was found but not initialized`)
    return result as InstanceType<T>
  }

  /**
   * Instantiate the router of the application. The router is used to handle HTTP requests
   * and route them to the appropriate event handler. This function will collect all routes
   * from the registered modules and generate the event handlers for each route.
   *
   * @returns The router of the application.
   */
  @Once()
  createRouter() {
    const router = createRouter()

    // --- 1. Traverse all registered modules and collect all the routes.
    // --- 2. If the route is a factory function, bind it to the module instance and call it.
    // --- 3. Generate and register the event handler for each route.
    for (const module of this.modules) {
      if (!module.routes) continue
      for (let route of Object.values(module.routes)) {
        try {
          // eslint-disable-next-line sonarjs/updated-loop-counter
          route = typeof route === 'function' ? route.call(module) : route
          const [method, path] = route.name.split(' ')
          const eventHandler = createEventHandler(route)
          if (method === 'WS') {
            router.use(path, eventHandler)
          }
          else {
            const routeMethod = method.toLowerCase() as RouterMethod
            router[routeMethod](path, eventHandler, routeMethod)
          }
        }
        catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          this.logger.error(`Could not register route "${route.name}" in module "${module.constructor.name}": ${message}`)
          this.logger.error(error)
        }
      }
    }

    // --- Sort by path as to avoid conflicts with overlapping paths.
    return router
  }

  /**
   * Instantiate the H3 application of the application with the router handler.
   *
   * @param options The options to pass to the application.
   * @returns The H3 application of the application.
   */
  @Once()
  createApp(options?: AppOptions) {
    const router = this.createRouter()
    return createApp(options).use(router)
  }

  /**
   * Create a Node.js server with the application handler.
   *
   * @param options The options to pass to the application.
   * @returns The Node.js server with the application handler.
   */
  @Once()
  createServer(options?: AppOptions) {
    const app = this.createApp(options)
    const listener = toNodeListener(app)
    const server = createServer(listener)
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const { handleUpgrade } = wsAdapter(app.websocket as NodeOptions)
    server.on('upgrade', (...args) => void handleUpgrade(...args))
    return server
  }

  /**
   * Initialize the application with the given options.
   *
   * @returns The initialized application.
   */
  @Once()
  async initialize(): Promise<this> {
    if (this.isInitialized) return this

    // --- Collect all entities from the modules.
    const entities = this.modules.flatMap(module => Object.values(module.entities))

    // --- Initialize the data source and inject the entities from the modules.
    const { dataSource = DEFAULT_DATA_SOURCE_OPTIONS } = this.options
    this.dataSource = isDataSource(dataSource) ? dataSource : new DataSource(dataSource)
    this.dataSource.setOptions({ ...this.dataSource.options, entities })
    if (!this.dataSource.isInitialized) await this.dataSource.initialize()

    // --- Initialize all the modules.
    for (const module of this.modules) {
      if (module.isInitialized) continue
      await module.initialize()
        .catch((error: Error) => {
          this.logger.error('Error initializing module:', module.constructor.name)
          this.logger.error(error.message)
          this.logger.error(error.stack)
        })
        .then(() => {
          module.isInitialized = true
        })
    }

    // --- Set the application as initialized.
    this.isInitialized = true
    return this
  }
}
