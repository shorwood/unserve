import { assertNil, assertString, assertStringNotEmpty, assertStringUuid, createArrayParser, createParser } from '@unshared/validation'
import { toSlug } from '@unshared/string'
import { createRoute } from '@unserve/server'
import { ModuleUser } from '@unserve/module-user'
import { ModuleStorage } from '@unserve/module-storage'
import { ModuleIcon } from '@unserve/module-icon'
import { assertSections } from '../utils'
import { ModuleContent } from '../index'

export function contentPageUpdate(this: ModuleContent) {
  return createRoute(
    {
      name: 'PUT /api/pages/:id',
      parameters: createParser({
        id: assertStringUuid,
      }),
      body: createParser({
        name: [[assertNil], [assertStringNotEmpty]],
        icon: [[assertNil], [assertString]],
        slug: [[assertNil], [assertString]],
        tags: [[assertNil], [createArrayParser(assertStringNotEmpty)]],
        sections: [[assertNil], [assertSections]],
        description: [[assertNil], [assertString]],
        languageCode: [[assertNil], [assertString]],
        categoryId: [[assertNil], [assertStringUuid]],
        imageId: [[assertNil], [assertStringUuid]],
        bannerId: [[assertNil], [assertStringUuid]],
      }),
    },
    async({ event, parameters, body }) => {
      const iconModule = this.getModule(ModuleIcon)
      const assetModule = this.getModule(ModuleStorage)
      const userModule = this.getModule(ModuleUser)

      // --- Check if the user has the right permissions.
      await userModule.a11n(event, { permissions: [this.permissions.PAGE_UPDATE.id] })

      // --- Find the latest content of the website page and check if
      // --- it is published. If not, update the page and description
      // --- of the latest content. Otherwise, create a new content.
      await this.withTransaction(async() => {

        // --- Find the website page.
        const { id } = parameters
        const { ContentPage } = this.entities
        const page = await ContentPage.findOne({
          where: { id },
          relations: {
            tags: true,
            image: true,
            banner: true,
            category: true,
            icon: { collection: true },
            content: { language: true },
          },
        })

        // --- Find the latest content of the website page.
        if (!page) throw new Error('Website content not found.')
        let content = page.content.at(-1)
        if (!content || content?.publishedAt) {
          const { ContentPageContent } = this.entities
          content = ContentPageContent.create()
          page.content.push(content)
        }

        // --- Update the website page.
        if (body.name) page.name = body.name
        if (body.slug) page.slug = toSlug(body.slug)
        if (body.tags !== undefined) page.tags = await this.resolveTags(body.tags)
        if (body.icon !== undefined) page.icon = await iconModule.resolveIcon(body.icon)
        if (body.imageId !== undefined) page.image = await assetModule.resolveFile(body.imageId)
        if (body.bannerId !== undefined) page.banner = await assetModule.resolveFile(body.bannerId)
        if (body.categoryId !== undefined) page.category = await this.resolveCategory(body.categoryId)

        // --- Update the website content content.
        content.name = page.name
        content.slug = page.slug
        content.sections = body.sections ?? []
        content.description = body.description ?? content.description
        content.language = await this.resolveLanguage(body.languageCode)

        // --- Save and return the updated website page.
        await page.save()
        return page.serialize(this, { withSections: true })
      })
    },
  )
}