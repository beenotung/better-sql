import { expect } from 'chai'
import { AST, decode } from '../src/parse'
import { generateSQL } from '../src/code-gen'

function expectAST<T extends AST.Expression>(actual: T, expected: T) {
  expect(actual).to.deep.equals(expected)
}

describe('language TestSuit', () => {
  context('select expression', () => {
    context('single/multi row', () => {
      it('should parse multi-row select expression', () => {
        let query = `select user [ id ]`
        let ast = decode(query)
        expectAST(ast, {
          type: 'select',
          table: {
            type: 'table',
            name: 'user',
            single: false,
            fields: [{ type: 'column', name: 'id' }],
          },
        })
        let sql = generateSQL(ast)
        expect(sql).to.equals(/* sql */ `
select
  user.id
from user
`)
      })

      it('should parse single-row select expression', () => {
        let query = `select user { id }`
        let ast = decode(query)
        expectAST(ast, {
          type: 'select',
          table: {
            type: 'table',
            name: 'user',
            single: true,
            fields: [{ type: 'column', name: 'id' }],
          },
        })
        let sql = generateSQL(ast)
        expect(sql).to.equals(/* sql */ `
select
  user.id
from user
limit 1
`)
      })
    })

    context('inline/multi-line expression', () => {
      it('should parse inline expression', () => {
        let query = `select user { id, nickname }`
        let ast = decode(query)
        expectAST(ast, {
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
        let sql = generateSQL(ast)
        expect(sql).to.equals(/* sql */ `
select
  user.id
, user.nickname
from user
limit 1
`)
      })

      it('should parse multi-line expression', () => {
        let query = `
select user {
  id
  nickname
}
`
        let ast = decode(query)
        expectAST(ast, {
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
        let sql = generateSQL(ast)
        expect(sql).to.equals(/* sql */ `
select
  user.id
, user.nickname
from user
limit 1
`)
      })
    })

    context('nested select expression', () => {
      it('should parse single inner join select', () => {
        let query = `
select post [
  title
  author {
    nickname
  }
]
`
        let ast = decode(query)
        expectAST(ast, {
          type: 'select',
          table: {
            type: 'table',
            name: 'post',
            single: false,
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
        let sql = generateSQL(ast)
        expect(sql).to.equals(/* sql */ `
select
  post.title
, author.nickname
from post
inner join author on author.id = post.author_id
`)
      })

      it('should parse single left join select', () => {
        let query = `
select post [
  title
  author [
    nickname
  ]
]
`
        let ast = decode(query)
        expectAST(ast, {
          type: 'select',
          table: {
            type: 'table',
            name: 'post',
            single: false,
            fields: [
              { type: 'column', name: 'title' },
              {
                type: 'table',
                name: 'author',
                single: false,
                fields: [{ type: 'column', name: 'nickname' }],
              },
            ],
          },
        })
        let sql = generateSQL(ast)
        expect(sql).to.equals(/* sql */ `
select
  post.title
, author.nickname
from post
left join author on author.id = post.author_id
`)
      })

      it('should parse multi-nested inner join select', () => {
        let query = `
select cart [
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
]
`
        let ast = decode(query)
        expectAST(ast, {
          type: 'select',
          table: {
            type: 'table',
            name: 'cart',
            single: false,
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
        let sql = generateSQL(ast)
        expect(sql).to.equals(/* sql */ `
select
  cart.user_id
, user.nickname
, cart.product_id
, product.price
, shop.name
from cart
inner join user on user.id = cart.user_id
inner join product on product.id = cart.product_id
inner join shop on shop.id = product.shop_id
`)
      })
    })

    context('select column with alias', () => {
      it('should parse multi-line column alias', () => {
        let query = `
select post [
  id
  title as post_title
  author_id
]
`
        let ast = decode(query)
        expectAST(ast, {
          type: 'select',
          table: {
            type: 'table',
            name: 'post',
            single: false,
            fields: [
              { type: 'column', name: 'id' },
              { type: 'column', name: 'title', alias: 'post_title' },
              { type: 'column', name: 'author_id' },
            ],
          },
        })
        let sql = generateSQL(ast)
        expect(sql).to.equals(/* sql */ `
select
  post.id
, post.title as post_title
, post.author_id
from post
`)
      })

      it('should parse inline column alias', () => {
        let query = `select post [ id, title as post_title, author_id ]`
        let ast = decode(query)
        expectAST(ast, {
          type: 'select',
          table: {
            type: 'table',
            name: 'post',
            single: false,
            fields: [
              { type: 'column', name: 'id' },
              { type: 'column', name: 'title', alias: 'post_title' },
              { type: 'column', name: 'author_id' },
            ],
          },
        })
        let sql = generateSQL(ast)
        expect(sql).to.equals(/* sql */ `
select
  post.id
, post.title as post_title
, post.author_id
from post
`)
      })

      it('should parse column alias in nested select', () => {
        let query = `
select post [
  id
  title as post_title
  author {
    nickname as author
  }
]
`
        let ast = decode(query)
        expectAST(ast, {
          type: 'select',
          table: {
            type: 'table',
            name: 'post',
            single: false,
            fields: [
              { type: 'column', name: 'id' },
              { type: 'column', name: 'title', alias: 'post_title' },
              {
                type: 'table',
                name: 'author',
                single: true,
                fields: [{ type: 'column', name: 'nickname', alias: 'author' }],
              },
            ],
          },
        })
        let sql = generateSQL(ast)
        expect(sql).to.equals(/* sql */ `
select
  post.id
, post.title as post_title
, author.nickname as author
from post
inner join author on author.id = post.author_id
`)
      })
    })

    context('join table with alias', () => {
      it('should parse table name alias', () => {
        let query = `select thread as post [ id ]`
        let ast = decode(query)
        expectAST(ast, {
          type: 'select',
          table: {
            type: 'table',
            name: 'thread',
            single: false,
            alias: 'post',
            fields: [{ type: 'column', name: 'id' }],
          },
        })
        let sql = generateSQL(ast)
        expect(sql).to.equals(/* sql */ `
select
  post.id
from thread as post
`)
      })

      it('should parse nested table name alias', () => {
        let query = `
select thread as post [
  id
  user as author {
    username
    id as author_id
    is_admin
  }
  title
]
`
        let ast = decode(query)
        expectAST(ast, {
          type: 'select',
          table: {
            type: 'table',
            name: 'thread',
            single: false,
            alias: 'post',
            fields: [
              { type: 'column', name: 'id' },
              {
                type: 'table',
                name: 'user',
                single: true,
                alias: 'author',
                fields: [
                  { type: 'column', name: 'username' },
                  { type: 'column', name: 'id', alias: 'author_id' },
                  { type: 'column', name: 'is_admin' },
                ],
              },
              { type: 'column', name: 'title' },
            ],
          },
        })
        let sql = generateSQL(ast)
        expect(sql).to.equals(/* sql */ `
select
  post.id
, author.username
, author.id as author_id
, author.is_admin
, post.title
from thread as post
inner join user as author on author.id = post.author_id
`)
      })
    })

    context('where statement', () => {
      context('where condition on single column with literal value', () => {
        context('tailing where condition after table fields', () => {
          let ast: AST.Select = {
            type: 'select',
            table: {
              type: 'table',
              name: 'user',
              single: false,
              fields: [
                { type: 'column', name: 'id' },
                { type: 'column', name: 'username' },
              ],
              where: {
                expr: {
                  type: 'compare',
                  left: 'is_admin',
                  op: '=',
                  right: '1',
                },
              },
            },
          }

          it('should parse inline where condition', () => {
            let query = `
select user [
  id
  username
] where is_admin = 1
`
            expect(decode(query)).to.deep.equals(ast)
            let sql = generateSQL(ast)
            expect(sql).to.equals(/* sql */ `
select
  user.id
, user.username
from user
where user.is_admin = 1
`)
          })

          it('should parse multiline where condition', () => {
            let query = `
select user [
  id
  username
]
where is_admin = 1
`
            expect(decode(query)).to.deep.equals(ast)
            let sql = generateSQL(ast)
            expect(sql).to.equals(/* sql */ `
select
  user.id
, user.username
from user
where user.is_admin = 1
`)
          })
        })

        context('where condition in nested table fields', () => {
          let ast: AST.Select = {
            type: 'select',
            table: {
              type: 'table',
              name: 'post',
              single: false,
              fields: [
                { type: 'column', name: 'id' },
                {
                  type: 'table',
                  name: 'author',
                  single: true,
                  fields: [{ type: 'column', name: 'nickname' }],
                  where: {
                    expr: {
                      type: 'compare',
                      left: 'is_admin',
                      op: '=',
                      right: '1',
                    },
                  },
                },
                { type: 'column', name: 'title' },
              ],
              where: {
                expr: {
                  type: 'compare',
                  left: 'delete_time',
                  op: 'is',
                  right: 'null',
                },
              },
            },
          }

          it('should parse nested inline where condition', () => {
            let query = `
select post [
  id
  author {
    nickname
  } where is_admin = 1
  title
] where delete_time is null
`
            expect(decode(query)).to.deep.equals(ast)
            let sql = generateSQL(ast)
            expect(sql).to.equals(/* sql */ `
select
  post.id
, author.nickname
, post.title
from post
inner join author on author.id = post.author_id
where author.is_admin = 1
  and post.delete_time is null
`)
          })
        })
      })

      context('where condition with variables', () => {
        function test(variable: string) {
          it(`should parse "${variable}"`, () => {
            let query = `
select post [
  id
  title
] where user_id = ${variable}
`
            let ast = decode(query)
            expectAST(ast, {
              type: 'select',
              table: {
                type: 'table',
                name: 'post',
                single: false,
                fields: [
                  { type: 'column', name: 'id' },
                  { type: 'column', name: 'title' },
                ],
                where: {
                  expr: {
                    type: 'compare',
                    left: 'user_id',
                    op: '=',
                    right: variable,
                  },
                },
              },
            })
            let sql = generateSQL(ast)
            expect(sql).to.equals(/* sql */ `
select
  post.id
, post.title
from post
where post.user_id = ${variable}
`)
          })
        }
        test(':user_id')
        test('$user_id')
        test('@user_id')
        test('?')
      })

      context('where condition on multiple column', () => {
        it('should parse multiple column where statement with "and" logic on single table', () => {
          let query = `
select post [
  id
  title
]
where delete_time is null
  and user_id = ?
`
          let ast = decode(query)
          expectAST(ast, {
            type: 'select',
            table: {
              type: 'table',
              name: 'post',
              single: false,
              fields: [
                { type: 'column', name: 'id' },
                { type: 'column', name: 'title' },
              ],
              where: {
                expr: {
                  type: 'compare',
                  left: {
                    type: 'compare',
                    left: 'delete_time',
                    op: 'is',
                    right: 'null',
                  },
                  op: 'and',
                  right: {
                    type: 'compare',
                    left: 'user_id',
                    op: '=',
                    right: '?',
                  },
                },
              },
            },
          })
          let sql = generateSQL(ast)
          expect(sql).to.equals(/* sql */ `
select
  post.id
, post.title
from post
where post.delete_time is null
  and post.user_id = ?
`)
        })

        it('should parse multiple column where statement with "and" logic on nested table', () => {
          let query = `
select post [
  id
  title
  author {
  nickname
} where is_admin = 1
]
where delete_time is null
  and user_id = ?
`
          let ast = decode(query)
          expectAST(ast, {
            type: 'select',
            table: {
              type: 'table',
              name: 'post',
              single: false,
              fields: [
                { type: 'column', name: 'id' },
                { type: 'column', name: 'title' },
                {
                  type: 'table',
                  name: 'author',
                  single: true,
                  fields: [{ type: 'column', name: 'nickname' }],
                  where: {
                    expr: {
                      type: 'compare',
                      left: 'is_admin',
                      op: '=',
                      right: '1',
                    },
                  },
                },
              ],
              where: {
                expr: {
                  type: 'compare',
                  left: {
                    type: 'compare',
                    left: 'delete_time',
                    op: 'is',
                    right: 'null',
                  },
                  op: 'and',
                  right: {
                    type: 'compare',
                    left: 'user_id',
                    op: '=',
                    right: '?',
                  },
                },
              },
            },
          })
          let sql = generateSQL(ast)
          expect(sql).to.equals(/* sql */ `
select
  post.id
, post.title
, author.nickname
from post
inner join author on author.id = post.author_id
where author.is_admin = 1
  and post.delete_time is null
  and post.user_id = ?
`)
        })
      })

      context('where condition with "or" logic', () => {
        it('should parse "or" logic on single table', () => {
          let query = `
select post [
  id
  title
]
where type_id = 1
   or type_id = 2
`
          let ast = decode(query)
          expectAST(ast, {
            type: 'select',
            table: {
              type: 'table',
              name: 'post',
              single: false,
              fields: [
                { type: 'column', name: 'id' },
                { type: 'column', name: 'title' },
              ],
              where: {
                expr: {
                  type: 'compare',
                  left: {
                    type: 'compare',
                    left: 'type_id',
                    op: '=',
                    right: '1',
                  },
                  op: 'or',
                  right: {
                    type: 'compare',
                    left: 'type_id',
                    op: '=',
                    right: '2',
                  },
                },
              },
            },
          })
          let sql = generateSQL(ast)
          expect(sql).to.equals(/* sql */ `
select
  post.id
, post.title
from post
where post.type_id = 1
   or post.type_id = 2
`)
        })

        it('should parse "or" logic on nested table select', () => {
          let query = `
select post [
  id
  author {
    nickname
  }
  where is_admin = 1
     or is_editor = 1
  title
]
where type_id = 1
   or type_id = 2
`
          let ast = decode(query)
          expectAST(ast, {
            type: 'select',
            table: {
              type: 'table',
              name: 'post',
              single: false,
              fields: [
                { type: 'column', name: 'id' },
                {
                  type: 'table',
                  name: 'author',
                  single: true,
                  fields: [{ type: 'column', name: 'nickname' }],
                  where: {
                    expr: {
                      type: 'compare',
                      left: {
                        type: 'compare',
                        left: 'is_admin',
                        op: '=',
                        right: '1',
                      },
                      op: 'or',
                      right: {
                        type: 'compare',
                        left: 'is_editor',
                        op: '=',
                        right: '1',
                      },
                    },
                  },
                },
                { type: 'column', name: 'title' },
              ],
              where: {
                expr: {
                  type: 'compare',
                  left: {
                    type: 'compare',
                    left: 'type_id',
                    op: '=',
                    right: '1',
                  },
                  op: 'or',
                  right: {
                    type: 'compare',
                    left: 'type_id',
                    op: '=',
                    right: '2',
                  },
                },
              },
            },
          })
          let sql = generateSQL(ast)
          expect(sql).to.equals(/* sql */ `
select
  post.id
, author.nickname
, post.title
from post
inner join author on author.id = post.author_id
where (author.is_admin = 1
   or author.is_editor = 1)
  and (post.type_id = 1
   or post.type_id = 2)
`)
        })
      })

      context('where condition with "not" logic', () => {
        it('should parse where condition with "not" logic on single column', () => {
          let query = `
select post [
  id
  title
]
where not type_id = 1
`
          let ast = decode(query)
          expectAST(ast, {
            type: 'select',
            table: {
              type: 'table',
              name: 'post',
              single: false,
              fields: [
                { type: 'column', name: 'id' },
                { type: 'column', name: 'title' },
              ],
              where: {
                expr: {
                  type: 'not',
                  expr: {
                    type: 'compare',
                    left: 'type_id',
                    op: '=',
                    right: '1',
                  },
                },
              },
            },
          })
          let sql = generateSQL(ast)
          expect(sql).to.equals(/* sql */ `
select
  post.id
, post.title
from post
where not post.type_id = 1
`)
        })
      })

      context('where condition with parenthesis', () => {
        it('should parse single parenthesis group', () => {
          let query = `
select post [
  id
  title
] where (type_id = 1)
`
          let ast = decode(query)
          expectAST(ast, {
            type: 'select',
            table: {
              type: 'table',
              name: 'post',
              single: false,
              fields: [
                { type: 'column', name: 'id' },
                { type: 'column', name: 'title' },
              ],
              where: {
                expr: {
                  type: 'parenthesis',
                  expr: {
                    type: 'compare',
                    left: 'type_id',
                    op: '=',
                    right: '1',
                  },
                },
              },
            },
          })
          let sql = generateSQL(ast)
          expect(sql).to.equals(/* sql */ `
select
  post.id
, post.title
from post
where (post.type_id = 1)
`)
        })

        context('parenthesis around "not" logic', () => {
          it('should parse parenthesis before "not" logic', () => {
            let query = `
select post [
  id
  title
] where (not type_id = 1)
`
            let ast = decode(query)
            expectAST(ast, {
              type: 'select',
              table: {
                type: 'table',
                name: 'post',
                single: false,
                fields: [
                  { type: 'column', name: 'id' },
                  { type: 'column', name: 'title' },
                ],
                where: {
                  expr: {
                    type: 'parenthesis',
                    expr: {
                      type: 'not',
                      expr: {
                        type: 'compare',
                        left: 'type_id',
                        op: '=',
                        right: '1',
                      },
                    },
                  },
                },
              },
            })
            let sql = generateSQL(ast)
            expect(sql).to.equals(/* sql */ `
select
  post.id
, post.title
from post
where (not post.type_id = 1)
`)
          })

          it('should parse parenthesis after "not" logic', () => {
            let query = `
select post [
  id
  title
] where not (type_id = 1)
`
            let ast = decode(query)
            expectAST(ast, {
              type: 'select',
              table: {
                type: 'table',
                name: 'post',
                single: false,
                fields: [
                  { type: 'column', name: 'id' },
                  { type: 'column', name: 'title' },
                ],
                where: {
                  expr: {
                    type: 'not',
                    expr: {
                      type: 'parenthesis',
                      expr: {
                        type: 'compare',
                        left: 'type_id',
                        op: '=',
                        right: '1',
                      },
                    },
                  },
                },
              },
            })
            let sql = generateSQL(ast)
            expect(sql).to.equals(/* sql */ `
select
  post.id
, post.title
from post
where not (post.type_id = 1)
`)
          })
        })

        it('should parse multi parenthesis groups', () => {
          let query = `
select post [
  id
  title
] where (delete_time is null or recover_time is not null)
    and (type_id = 1 or type_id = 2)
`
          let ast = decode(query)
          expectAST(ast, {
            type: 'select',
            table: {
              type: 'table',
              name: 'post',
              single: false,
              fields: [
                { type: 'column', name: 'id' },
                { type: 'column', name: 'title' },
              ],
              where: {
                expr: {
                  type: 'compare',
                  left: {
                    type: 'parenthesis',
                    expr: {
                      type: 'compare',
                      left: {
                        type: 'compare',
                        left: 'delete_time',
                        op: 'is',
                        right: 'null',
                      },
                      op: 'or',
                      right: {
                        type: 'compare',
                        left: 'recover_time',
                        op: 'is not',
                        right: 'null',
                      },
                    },
                  },
                  op: 'and',
                  right: {
                    type: 'parenthesis',
                    expr: {
                      type: 'compare',
                      left: {
                        type: 'compare',
                        left: 'type_id',
                        op: '=',
                        right: '1',
                      },
                      op: 'or',
                      right: {
                        type: 'compare',
                        left: 'type_id',
                        op: '=',
                        right: '2',
                      },
                    },
                  },
                },
              },
            },
          })
          let sql = generateSQL(ast)
          expect(sql).to.equals(/* sql */ `
select
  post.id
, post.title
from post
where (post.delete_time is null
   or post.recover_time is not null)
  and (post.type_id = 1
   or post.type_id = 2)
`)
        })
      })
    })

    it('should parse distinct select', () => {
      let query = `
select distinct post [
  title
  version
]
`
      let ast = decode(query)
      expectAST(ast, {
        type: 'select',
        distinct: 'distinct',
        table: {
          type: 'table',
          name: 'post',
          single: false,
          fields: [
            { type: 'column', name: 'title' },
            { type: 'column', name: 'version' },
          ],
        },
      })
      let sql = generateSQL(ast)
      expect(sql).to.equals(/* sql */ `
select distinct
  post.title
, post.version
from post
`)
    })

    it('should preserve original upper/lower case in the query', () => {
      let query = `
SELECT DISTINCT POST [
  VERSION
  TITLE
]
WHERE AUTHOR_ID = :AUTHOR_ID
  AND TYPE_ID = :Type_ID
   OR NOT DELETE_TIME IS NULL
`
      let ast = decode(query)
      expectAST(ast, {
        type: 'select',
        selectStr: 'SELECT',
        distinct: 'DISTINCT',
        table: {
          type: 'table',
          name: 'POST',
          single: false,
          fields: [
            { type: 'column', name: 'VERSION' },
            { type: 'column', name: 'TITLE' },
          ],
          where: {
            whereStr: 'WHERE',
            expr: {
              type: 'compare',
              left: {
                type: 'compare',
                left: 'AUTHOR_ID',
                op: '=',
                right: ':AUTHOR_ID',
              },
              op: 'AND',
              right: {
                type: 'compare',
                left: {
                  type: 'compare',
                  left: 'TYPE_ID',
                  op: '=',
                  right: ':Type_ID',
                },
                op: 'OR',
                right: {
                  type: 'not',
                  notStr: 'NOT',
                  expr: {
                    type: 'compare',
                    left: 'DELETE_TIME',
                    op: 'IS',
                    right: 'NULL',
                  },
                },
              },
            },
          },
        },
      })
      let sql = generateSQL(ast)
      expect(sql).to.equals(/* sql */ `
SELECT DISTINCT
  POST.VERSION
, POST.TITLE
FROM POST
WHERE POST.AUTHOR_ID = :AUTHOR_ID
  AND POST.TYPE_ID = :Type_ID
   OR NOT POST.DELETE_TIME IS NULL
`)
    })
  })
})
