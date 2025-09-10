import type { MaybePromise } from '@unshared/types'
import type { H3Event, RouterMethod } from 'h3'
import type { Parser } from './types'

export const SYMBOL_HTTP_ROUTE = Symbol.for('HttpRoute')

export type HttpRouteName = `${Uppercase<RouterMethod>} /${string}`

export interface HttpRouteContext<T extends HttpRouteOptions> {
  event: H3Event
  body: T extends HttpRouteOptions<any, infer U> ? U : never
  query: T extends HttpRouteOptions<any, any, infer U> ? U : never
  formData: T extends HttpRouteOptions<any, any, any, infer U> ? U : never
  parameters: T extends HttpRouteOptions<any, any, any, any, infer U> ? U : never
  abortSignal: AbortSignal
}

export interface HttpRouteOptions<
  Name extends HttpRouteName = HttpRouteName,
  Body = unknown,
  Query = unknown,
  FormData = unknown,
  Parameters = unknown,
> {
  name: Name
  parseBody?: Parser<Body>
  parseQuery?: Parser<Query>
  parseFormData?: Parser<FormData>
  parseParameters?: Parser<Parameters>
}

export type HttpRouteHandler<T extends HttpRouteOptions, R> =
  (context: HttpRouteContext<T>) => MaybePromise<R>

export type HttpRoute<T extends HttpRouteOptions, R> =
  T & { handler: HttpRouteHandler<T, R>; [SYMBOL_HTTP_ROUTE]: true }

/**
 * Create a route that can be used to handle an HTTP request. The route includes the method,
 * path, body, query, parameters, and the callback that is called when the route is matched.
 *
 * @param options The options used to define the route.
 * @param handler The callback that is called when the route is matched.
 * @returns The route that can be used to handle the request.
 * @example
 *
 * const route = createHttpRoute({
 *   name: 'GET /users/:id',
 *   parseParameters: (parameters) => ({ id: asNumber(parameters.id) })
 *   handler: ({ parameters }) => { ... }
 * })
 */
export function createHttpRoute<T extends HttpRouteOptions, R>(options: Readonly<T>, handler: HttpRouteHandler<T, R>): HttpRoute<T, R> {
  return { ...options, handler, [SYMBOL_HTTP_ROUTE]: true } as HttpRoute<T, R>
}
