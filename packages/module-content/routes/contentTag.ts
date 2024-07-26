import { assertStringUuid, createParser } from '@unshared/validation'
import { createRoute } from '@unserve/server'
import { ModuleContent } from '../index'

export function contentTagGet(this: ModuleContent) {
  return createRoute(
    {
      name: 'GET /api/tags/:id',
      parameters: createParser({
        id: assertStringUuid,
      }),
    },
    async({ parameters }) => {
      const { ContentTag } = this.entities
      const { id } = parameters

      const tag = await ContentTag.findOne({ where: { id } })
      if (!tag) throw new Error('Tag not found')
      return tag.serialize()
    },
  )
}