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
  })
})
