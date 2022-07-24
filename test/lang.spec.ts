import { expect } from 'chai'
import { decode } from '../src/parse'

describe('language TestSuit', () => {
  context('select expression', () => {
    context('single/multie row', () => {
      it('should parse multi-row select expression', () => {
        expect(decode(`select user [ id ]`)).to.deep.equals({
          type: 'select',
          table: {
            type: 'table',
            name: 'user',
            single: false,
            fields: [{ type: 'column', name: 'id' }],
          },
        })
      })

      it('should parse single-row select expression', () => {
        expect(decode(`select user { id }`)).to.deep.equals({
          type: 'select',
          table: {
            type: 'table',
            name: 'user',
            single: true,
            fields: [{ type: 'column', name: 'id' }],
          },
        })
      })
    })

    context('inline/multi-line expression', () => {
      it('should parse inline expression', () => {
        expect(decode(`select user { id, nickname }`)).to.deep.equals({
          type: 'select',
          table: {
            type: 'table',
            name: 'user',
            single: true,
            fields: [
              { type: 'column', name: 'id' },
              { type: 'column', name: 'nickname' },
            ],
          },
        })
      })

      it('should parse multi-line expression', () => {
        expect(
          decode(
            `
select user {
  id
  nickname
}
`,
          ),
        ).to.deep.equals({
          type: 'select',
          table: {
            type: 'table',
            name: 'user',
            single: true,
            fields: [
              { type: 'column', name: 'id' },
              { type: 'column', name: 'nickname' },
            ],
          },
        })
      })
    })

    context('nested select expression', () => {
      it('should parse single inner join select', () => {
        expect(
          decode(
            `
select post {
  title
  author {
    nickname
  }
}
`,
          ),
        ).to.deep.equals({
          type: 'select',
          table: {
            type: 'table',
            name: 'post',
            single: true,
            fields: [
              { type: 'column', name: 'title' },
              {
                type: 'table',
                name: 'author',
                single: true,
                fields: [{ type: 'column', name: 'nickname' }],
              },
            ],
          },
        })
      })
      it('should parse multi-nested inner join select', () => {
        expect(
          decode(
            `
select cart {
  user_id
  user {
    nickname
  }
  product_id
  product {
    price
    shop {
      name
    }
  }
}
`,
          ),
        ).to.deep.equals({
          type: 'select',
          table: {
            type: 'table',
            name: 'cart',
            single: true,
            fields: [
              { type: 'column', name: 'user_id' },
              {
                type: 'table',
                name: 'user',
                single: true,
                fields: [{ type: 'column', name: 'nickname' }],
              },
              { type: 'column', name: 'product_id' },
              {
                type: 'table',
                name: 'product',
                single: true,
                fields: [
                  { type: 'column', name: 'price' },
                  {
                    type: 'table',
                    name: 'shop',
                    single: true,
                    fields: [{ type: 'column', name: 'name' }],
                  },
                ],
              },
            ],
          },
        })
      })
    })

    context('select column with alias', () => {
      it('should parse multi-line column alias', () => {
        expect(
          decode(
            `
select post {
  id
  title as post_title
  author_id
}
`,
          ),
        ).to.deep.equals({
          type: 'select',
          table: {
            type: 'table',
            name: 'post',
            single: true,
            fields: [
              { type: 'column', name: 'id' },
              { type: 'column', name: 'title', alias: 'post_title' },
              { type: 'column', name: 'author_id' },
            ],
          },
        })
      })
    })
  })
})
