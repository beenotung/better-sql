import { expect } from 'chai'
import { decode } from '../src/parse'

describe('language TestSuit', () => {
  context('select expression', () => {
    context('single table', () => {
      function test(options: {
        single: boolean
        fields: string[]
        multiline: boolean
      }) {
        let name =
          `should parse` +
          ' ' +
          (options.multiline ? 'multi-line' : 'inline') +
          ' ' +
          (options.fields.length > 1 ? 'multi-field' : 'single-field') +
          ' ' +
          (options.single ? 'single-row' : 'multi-row') +
          ' ' +
          `select expression`
        let [open, close] = options.single ? '{}' : '[]'
        let query = `select user ${open}`
        if (options.multiline) {
          query += '\n  '
        }
        if (options.multiline) {
          query += options.fields.join('\n  ')
        } else {
          query += options.fields.join(', ')
        }
        if (options.multiline) {
          query += '\n'
        }
        query += close
        let fields = options.fields.map(name => ({ type: 'column', name }))
        console.log(`> it ${name}:`)
        console.log(query)
        it(name, () => {
          let ast = decode(query)
          expect(ast).to.deep.equals({
            type: 'select',
            table: {
              type: 'table',
              single: options.single,
              name: 'user',
              fields,
            },
          })
        })
      }
      for (let fields of [['id'], ['id', 'username']]) {
        for (let multiline of [true, false]) {
          for (let single of [true, false]) {
            test({ single, fields, multiline })
          }
        }
      }
    })
  })
})
