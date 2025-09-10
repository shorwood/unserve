/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import type { H3Event } from 'h3'
import { isEventHandler } from 'h3'
import { createHttpRoute } from '../createHttpRoute'
import { createEventStream } from './createEventStream'
import { createHttpEventHandler } from './createHttpEventHandler'
import { createTestEvent } from './createTestEvent'

describe('createHttpEventHandler', () => {
  describe('createTextEvent', () => {
    it('should create an event handler for the given route', () => {
      const route = createHttpRoute({ name: 'GET /' }, vi.fn())
      const handler = createHttpEventHandler(route)
      const result = isEventHandler(handler)
      expect(result).toBe(true)
    })

    it('should return a function that can be called with an event', async() => {
      const handler = vi.fn()
      const route = createHttpRoute({ name: 'GET /' }, handler)
      const eventHandler = createHttpEventHandler(route)
      const event = createTestEvent()
      await eventHandler(event)
      expect(handler).toHaveBeenCalledWith({ event, abortSignal: expect.any(AbortSignal) })
    })

    it('should return a function that returns a promise', () => {
      const handler = vi.fn(() => Promise.resolve('response'))
      const route = createHttpRoute({ name: 'GET /' }, handler)
      const eventHandler = createHttpEventHandler(route)
      const event = createTestEvent()
      const response = eventHandler(event) as Promise<unknown>
      expect(response).toBeInstanceOf(Promise)
    })
  })

  describe('parseParameters', () => {
    const createHandler = () => {
      const handler = vi.fn()
      const parseParameters = vi.fn((value: unknown) => value)
      const route = createHttpRoute({ name: 'GET /route/:id', parseParameters }, handler)
      const event = createTestEvent({ url: '/route/123', parameters: { id: '123' } })
      return { handler, event, route, parseParameters, eventHandler: createHttpEventHandler(route) }
    }

    it('should call parseParameters if defined', async() => {
      const { event, eventHandler, parseParameters } = createHandler()
      await eventHandler(event)
      expect(parseParameters).toHaveBeenCalledWith({ id: '123' })
    })

    it('should call the handler with parsed parameters', async() => {
      const { event, eventHandler, handler } = createHandler()
      await eventHandler(event)
      expect(handler).toHaveBeenCalledWith({ event, parameters: { id: '123' }, abortSignal: expect.any(AbortSignal) })
    })

    it('should throw an error if parseParameters fails', async() => {
      const { event, route, eventHandler } = createHandler()
      route.parseParameters = vi.fn(() => { throw new Error('Invalid parameters') })
      const shouldReject = eventHandler(event) as Promise<unknown>
      await expect(shouldReject).rejects.toThrow('Invalid parameters')
    })

    it('should set the response status to 400 if parseParameters fails', async() => {
      const { event, route, eventHandler } = createHandler()
      route.parseParameters = vi.fn(() => { throw new Error('Invalid parameters') })
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await eventHandler(event).catch(() => {}) as unknown
      expect(event.node.res.statusCode).toBe(400)
      expect(event.node.res.statusMessage).toBe('Bad Request')
    })
  })

  describe('parseQuery', () => {
    const createHandler = () => {
      const handler = vi.fn()
      const parseQuery = vi.fn((value: unknown) => value)
      const route = createHttpRoute({ name: 'GET /', parseQuery }, handler)
      const event = createTestEvent({ url: 'http://localhost?foo=bar&baz=qux' })
      return { handler, event, route, parseQuery, eventHandler: createHttpEventHandler(route) }
    }

    it('should call parseQuery if defined', async() => {
      const { event, eventHandler, parseQuery } = createHandler()
      await eventHandler(event)
      expect(parseQuery).toHaveBeenCalledWith({ foo: 'bar', baz: 'qux' })
    })

    it('should call the handler with parsed query', async() => {
      const { event, eventHandler, handler } = createHandler()
      await eventHandler(event)
      expect(handler).toHaveBeenCalledWith({ event, query: { foo: 'bar', baz: 'qux' }, abortSignal: expect.any(AbortSignal) })
    })

    it('should throw an error if parseQuery fails', async() => {
      const { event, route, eventHandler } = createHandler()
      route.parseQuery = vi.fn(() => { throw new Error('Invalid query') })
      const shouldReject = eventHandler(event) as Promise<unknown>
      await expect(shouldReject).rejects.toThrow('Invalid query')
    })

    it('should set the response status to 400 if parseQuery fails', async() => {
      const { event, route, eventHandler } = createHandler()
      route.parseQuery = vi.fn(() => { throw new Error('Invalid query') })
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await eventHandler(event).catch(() => {}) as unknown
      expect(event.node.res.statusCode).toBe(400)
      expect(event.node.res.statusMessage).toBe('Bad Request')
    })
  })

  describe('parseBody', () => {
    const createHandler = () => {
      const handler = vi.fn()
      const parseBody = vi.fn((value: unknown) => value)
      const route = createHttpRoute({ name: 'POST /', parseBody }, handler)
      const event = createTestEvent({ method: 'POST', body: { key: 'value' } })
      return { handler, event, route, parseBody, eventHandler: createHttpEventHandler(route) }
    }

    it('should call parseBody if defined', async() => {
      const { event, eventHandler, parseBody } = createHandler()
      await eventHandler(event)
      expect(parseBody).toHaveBeenCalledWith({ key: 'value' })
    })

    it('should call the handler with parsed body', async() => {
      const { event, eventHandler, handler } = createHandler()
      await eventHandler(event)
      expect(handler).toHaveBeenCalledWith({ event, body: { key: 'value' }, abortSignal: expect.any(AbortSignal) })
    })

    it('should throw an error if parseBody fails', async() => {
      const { event, route, eventHandler } = createHandler()
      route.parseBody = vi.fn(() => { throw new Error('Invalid body') })
      const shouldReject = eventHandler(event) as Promise<unknown>
      await expect(shouldReject).rejects.toThrow('Invalid body')
    })

    it('should set the response status to 400 if parseBody fails', async() => {
      const { event, route, eventHandler } = createHandler()
      route.parseBody = vi.fn(() => { throw new Error('Invalid body') })
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await eventHandler(event).catch(() => {}) as unknown
      expect(event.node.res.statusCode).toBe(400)
      expect(event.node.res.statusMessage).toBe('Bad Request')
    })
  })

  describe('parseFormData', () => {
    const createHandler = () => {
      const handler = vi.fn()
      const parseFormData = vi.fn((value: unknown) => value)
      const route = createHttpRoute({ name: 'POST /', parseFormData }, handler)
      const event = createTestEvent({ method: 'POST', formData: { key: 'value' } })
      return { handler, event, route, parseFormData, eventHandler: createHttpEventHandler(route) }
    }

    it('should call parseFormData if defined', async() => {
      const { event, eventHandler, parseFormData } = createHandler()
      await eventHandler(event)
      const expectedFormData = new FormData()
      expectedFormData.append('key', 'value')
      expect(parseFormData).toHaveBeenCalledWith(expectedFormData)
    })

    it('should call the handler with parsed form data', async() => {
      const { event, eventHandler, handler } = createHandler()
      await eventHandler(event)
      const expectedFormData = new FormData()
      expectedFormData.append('key', 'value')
      expect(handler).toHaveBeenCalledWith({ event, formData: expectedFormData, abortSignal: expect.any(AbortSignal) })
    })

    it('should throw an error if parseFormData fails', async() => {
      const { event, route, eventHandler } = createHandler()
      route.parseFormData = vi.fn(() => { throw new Error('Invalid form data') })
      const shouldReject = eventHandler(event) as Promise<unknown>
      await expect(shouldReject).rejects.toThrow('Invalid form data')
    })

    it('should set the response status to 400 if parseFormData fails', async() => {
      const { event, route, eventHandler } = createHandler()
      route.parseFormData = vi.fn(() => { throw new Error('Invalid form data') })
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await eventHandler(event).catch(() => {}) as unknown
      expect(event.node.res.statusCode).toBe(400)
      expect(event.node.res.statusMessage).toBe('Bad Request')
    })
  })

  describe('abortSignal', () => {
    it('should trigger the abort event if the request is aborted', async() => {
      const callback = vi.fn() as () => void
      const handler = vi.fn(({ abortSignal }: { abortSignal: AbortSignal }) => {
        abortSignal.addEventListener('abort', () => callback())
        return new Promise(resolve => setTimeout(() => resolve('done'), 50))
      })

      const route = createHttpRoute({ name: 'GET /' }, handler)
      const eventHandler = createHttpEventHandler(route)
      const event = createTestEvent()

      const promise = eventHandler(event) as Promise<unknown>
      event.node.req.emit('aborted')
      await promise
      expect(callback).toHaveBeenCalled()
    })

    it('should not trigger the abort event if the request is not aborted', async() => {
      const callback = vi.fn() as () => void
      const handler = vi.fn(({ abortSignal }: { abortSignal: AbortSignal }) => {
        abortSignal.addEventListener('abort', () => callback())
        return new Promise(resolve => setTimeout(() => resolve('done'), 50))
      })

      const route = createHttpRoute({ name: 'GET /' }, handler)
      const eventHandler = createHttpEventHandler(route)
      const event = createTestEvent()

      await eventHandler(event)
      expect(callback).not.toHaveBeenCalled()
    })
  })

  describe('response', () => {
    const createHandler = (response: unknown) => {
      const handler = vi.fn(() => response)
      const route = createHttpRoute({ name: 'GET /' }, handler)
      const event = createTestEvent()
      return { handler, event, route, eventHandler: createHttpEventHandler(route) }
    }

    it('should return the result from the handler', async() => {
      const { event, eventHandler } = createHandler('response')
      const response = await eventHandler(event) as Promise<unknown>
      const status = event.node.res.statusCode
      expect(response).toBe('response')
      expect(status).toBe(200)
    })

    it('should return null if the handler returns undefined', async() => {
      const { event, eventHandler } = createHandler(undefined)
      const response = await eventHandler(event) as Promise<unknown>
      const status = event.node.res.statusCode
      const contentType = event.node.res.getHeader('content-type')
      expect(response).toBeNull()
      expect(status).toBe(204) // No Content
      expect(contentType).toBeUndefined()
    })

    it('should send an EventStream if the handler returns one', async() => {
      const handler = vi.fn(({ event }) => createEventStream(event as H3Event))
      const route = createHttpRoute({ name: 'GET /' }, handler)
      const eventHandler = createHttpEventHandler(route)
      const event = createTestEvent()
      const response = await eventHandler(event) as Promise<unknown>
      const contentType = event.node.res.getHeader('content-type')
      expect(response).toBeUndefined()
      expect(contentType).toBe('text/event-stream')
    })
  })
})
