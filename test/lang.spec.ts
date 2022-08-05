import { expect } from 'chai'
import { AST, decode } from '../src/parse'
import { generateSQL, nameWithTablePrefix } from '../src/code-gen'

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

      context('where condition with "between" expression', () => {
        it('should parse "between" where condition', () => {
          let query = `
select post [
  title
] where publish_time between '2022-01-01' and '2022-12-31'
`
          let ast = decode(query)
          expectAST(ast, {
            type: 'select',
            table: {
              type: 'table',
              name: 'post',
              single: false,
              fields: [{ type: 'column', name: 'title' }],
              where: {
                expr: {
                  type: 'between',
                  expr: 'publish_time',
                  left: "'2022-01-01'",
                  right: "'2022-12-31'",
                },
              },
            },
          })
          let sql = generateSQL(ast)
          expect(sql).to.equals(/* sql */ `
select
  post.title
from post
where post.publish_time between '2022-01-01' and '2022-12-31'
`)
        })

        it('should parse "not between" where condition', () => {
          let query = `
select post [
  title
] where publish_time not between '2022-01-01' and '2022-12-31'
`
          let ast = decode(query)
          expectAST(ast, {
            type: 'select',
            table: {
              type: 'table',
              name: 'post',
              single: false,
              fields: [{ type: 'column', name: 'title' }],
              where: {
                expr: {
                  type: 'between',
                  not: 'not',
                  expr: 'publish_time',
                  left: "'2022-01-01'",
                  right: "'2022-12-31'",
                },
              },
            },
          })
          let sql = generateSQL(ast)
          expect(sql).to.equals(/* sql */ `
select
  post.title
from post
where post.publish_time not between '2022-01-01' and '2022-12-31'
`)
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

      context('"like" and user-defined functions', () => {
        function test(func: string) {
          it(`should parse "${func}"`, () => {
            let query = `
select post [
  title
]
where title ${func} :search
`
            let ast = decode(query)
            expectAST(ast, {
              type: 'select',
              table: {
                type: 'table',
                name: 'post',
                single: false,
                fields: [{ type: 'column', name: 'title' }],
                where: {
                  expr: {
                    type: 'compare',
                    left: 'title',
                    op: func,
                    right: ':search',
                  },
                },
              },
            })
            let sql = generateSQL(ast)
            expect(sql).to.equals(/* sql */ `
select
  post.title
from post
where post.title ${func} :search
`)
          })

          it(`should parse "not ${func}"`, () => {
            let query = `
select post [
  title
]
where title not ${func} :search
`
            let ast = decode(query)
            expectAST(ast, {
              type: 'select',
              table: {
                type: 'table',
                name: 'post',
                single: false,
                fields: [{ type: 'column', name: 'title' }],
                where: {
                  expr: {
                    type: 'compare',
                    left: 'title',
                    op: `not ${func}`,
                    right: ':search',
                  },
                },
              },
            })
            let sql = generateSQL(ast)
            expect(sql).to.equals(/* sql */ `
select
  post.title
from post
where post.title not ${func} :search
`)
          })
        }
        test('like')
        test('glob')
        test('regexp')
        test('match')
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

    context('group by statement', () => {
      it('should parse single group by column on single table', () => {
        let query = `
select post [
  author_id
  created_at
] group by author_id
`
        let ast = decode(query)
        expectAST(ast, {
          type: 'select',
          table: {
            type: 'table',
            name: 'post',
            single: false,
            fields: [
              { type: 'column', name: 'author_id' },
              { type: 'column', name: 'created_at' },
            ],
            groupBy: { fields: ['author_id'] },
          },
        })
        let sql = generateSQL(ast)
        expect(sql).to.equals(/* sql */ `
select
  post.author_id
, post.created_at
from post
group by
  post.author_id
`)
      })

      it('should parse group by columns in nested tables', () => {
        let query = `
select post [
  author_id
  created_at
  author {
    nickname
  } group by cohort
] group by type_id
`
        let ast = decode(query)
        expectAST(ast, {
          type: 'select',
          table: {
            type: 'table',
            name: 'post',
            single: false,
            fields: [
              { type: 'column', name: 'author_id' },
              { type: 'column', name: 'created_at' },
              {
                type: 'table',
                name: 'author',
                single: true,
                fields: [{ type: 'column', name: 'nickname' }],
                groupBy: { fields: ['cohort'] },
              },
            ],
            groupBy: { fields: ['type_id'] },
          },
        })
        let sql = generateSQL(ast)
        expect(sql).to.equals(/* sql */ `
select
  post.author_id
, post.created_at
, author.nickname
from post
inner join author on author.id = post.author_id
group by
  author.cohort
, post.type_id
`)
      })

      it('should parse multi group by columns on single table', () => {
        let query = `
select post [
  author_id
  created_at
] group by author_id, version
`
        let ast = decode(query)
        expectAST(ast, {
          type: 'select',
          table: {
            type: 'table',
            name: 'post',
            single: false,
            fields: [
              { type: 'column', name: 'author_id' },
              { type: 'column', name: 'created_at' },
            ],
            groupBy: { fields: ['author_id', 'version'] },
          },
        })
        let sql = generateSQL(ast)
        expect(sql).to.equals(/* sql */ `
select
  post.author_id
, post.created_at
from post
group by
  post.author_id
, post.version
`)
      })

      it('should parse multi group by columns on nested tables', () => {
        let query = `
select post [
  author_id
  author {
    nickname
    grade
    cohort
  } group by grade, cohort
  version
] group by author_id, version
`
        let ast = decode(query)
        expectAST(ast, {
          type: 'select',
          table: {
            type: 'table',
            name: 'post',
            single: false,
            fields: [
              { type: 'column', name: 'author_id' },
              {
                type: 'table',
                name: 'author',
                single: true,
                fields: [
                  { type: 'column', name: 'nickname' },
                  { type: 'column', name: 'grade' },
                  { type: 'column', name: 'cohort' },
                ],
                groupBy: { fields: ['grade', 'cohort'] },
              },
              { type: 'column', name: 'version' },
            ],
            groupBy: { fields: ['author_id', 'version'] },
          },
        })
        let sql = generateSQL(ast)
        expect(sql).to.equals(/* sql */ `
select
  post.author_id
, author.nickname
, author.grade
, author.cohort
, post.version
from post
inner join author on author.id = post.author_id
group by
  author.grade
, author.cohort
, post.author_id
, post.version
`)
      })

      it('should parse aggregate function', () => {
        let query = `
select post [
  author_id
  created_at
  count(*) as post_count
] group by author_id
`
        let ast = decode(query)
        expectAST(ast, {
          type: 'select',
          table: {
            type: 'table',
            name: 'post',
            single: false,
            fields: [
              { type: 'column', name: 'author_id' },
              { type: 'column', name: 'created_at' },
              { type: 'column', name: 'count(*)', alias: 'post_count' },
            ],
            groupBy: { fields: ['author_id'] },
          },
        })
        let sql = generateSQL(ast)
        expect(sql).to.equals(/* sql */ `
select
  post.author_id
, post.created_at
, count(*) as post_count
from post
group by
  post.author_id
`)
      })

      it('should parse "having" statement', () => {
        let query = `
select post [
  author_id
  created_at
  count(*) as post_count
] group by author_id
  having count(*) > 10
`
        let ast = decode(query)
        expectAST(ast, {
          type: 'select',
          table: {
            type: 'table',
            name: 'post',
            single: false,
            fields: [
              { type: 'column', name: 'author_id' },
              { type: 'column', name: 'created_at' },
              { type: 'column', name: 'count(*)', alias: 'post_count' },
            ],
            groupBy: { fields: ['author_id'] },
            having: {
              expr: { type: 'compare', left: 'count(*)', op: '>', right: '10' },
            },
          },
        })
        let sql = generateSQL(ast)
        expect(sql).to.equals(/* sql */ `
select
  post.author_id
, post.created_at
, count(*) as post_count
from post
group by
  post.author_id
having count(*) > 10
`)
      })
    })

    context('order by statement', () => {
      it('should parse single order by column', () => {
        let query = `
  select post [
    id
    title
  ] order by created_at
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
            orderBy: { fields: [{ name: 'created_at' }] },
          },
        })
        let sql = generateSQL(ast)
        expect(sql).to.equals(/* sql */ `
select
  post.id
, post.title
from post
order by
  post.created_at
`)
      })

      it('should parse order by with explicit order', () => {
        let query = `
  select post [
    id
    title
  ] order by created_at asc
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
            orderBy: { fields: [{ name: 'created_at', order: 'asc' }] },
          },
        })
        let sql = generateSQL(ast)
        expect(sql).to.equals(/* sql */ `
select
  post.id
, post.title
from post
order by
  post.created_at asc
`)
      })

      it('should parse order by with null order', () => {
        let query = `
  select post [
    id
    title
  ] order by created_at asc nulls last
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
            orderBy: {
              fields: [{ name: 'created_at', order: 'asc nulls last' }],
            },
          },
        })
        let sql = generateSQL(ast)
        expect(sql).to.equals(/* sql */ `
select
  post.id
, post.title
from post
order by
  post.created_at asc nulls last
`)
      })

      it('should parse case-insensitive order by', () => {
        let query = `
  select post [
    id
    title
  ] order by created_at collate nocase asc
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
            orderBy: {
              fields: [{ name: 'created_at', order: 'collate nocase asc' }],
            },
          },
        })
        let sql = generateSQL(ast)
        expect(sql).to.equals(/* sql */ `
select
  post.id
, post.title
from post
order by
  post.created_at collate nocase asc
`)
      })

      it('should parse multi order by', () => {
        let query = `
  select post [
    id
    author {
      nickname
    } order by register_time desc nulls last
    title
  ] order by publish_time asc, type_id asc nulls first
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
                orderBy: {
                  fields: [{ name: 'register_time', order: 'desc nulls last' }],
                },
              },

              { type: 'column', name: 'title' },
            ],
            orderBy: {
              fields: [
                { name: 'publish_time', order: 'asc' },
                { name: 'type_id', order: 'asc nulls first' },
              ],
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
order by
  author.register_time desc nulls last
, post.publish_time asc
, post.type_id asc nulls first
`)
      })
    })

    context('"limit" and "offset"', () => {
      it('should parse explicit "limit"', () => {
        let query = `
select post [
  id
]
limit 10
`
        let ast = decode(query)
        expectAST(ast, {
          type: 'select',
          table: {
            type: 'table',
            name: 'post',
            single: false,
            fields: [{ type: 'column', name: 'id' }],
            limit: 'limit 10',
          },
        })
        let sql = generateSQL(ast)
        expect(sql).to.equals(/* sql */ `
select
  post.id
from post
limit 10
`)
      })

      it('should parse "offset"', () => {
        let query = `
select post [
  id
]
limit 10
offset 20
`
        let ast = decode(query)
        expectAST(ast, {
          type: 'select',
          table: {
            type: 'table',
            name: 'post',
            single: false,
            fields: [{ type: 'column', name: 'id' }],
            limit: 'limit 10',
            offset: 'offset 20',
          },
        })
        let sql = generateSQL(ast)
        expect(sql).to.equals(/* sql */ `
select
  post.id
from post
limit 10
offset 20
`)
      })
    })

    context('nested select with "in" expression', () => {
      it('should parse nested select with "in" expression', () => {
        let query = `
select post [
  title
] where author_id in (
  select user [ id ]
  where is_admin = 1
)
`
        let ast = decode(query)
        expectAST(ast, {
          type: 'select',
          table: {
            type: 'table',
            single: false,
            name: 'post',
            fields: [{ type: 'column', name: 'title' }],
            where: {
              expr: {
                type: 'in',
                expr: 'author_id',
                select: {
                  type: 'select',
                  table: {
                    type: 'table',
                    name: 'user',
                    single: false,
                    fields: [{ type: 'column', name: 'id' }],
                    where: {
                      expr: {
                        type: 'compare',
                        left: 'is_admin',
                        op: '=',
                        right: '1',
                      },
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
  post.title
from post
where post.author_id in (
  select
    user.id
  from user
  where user.is_admin = 1
)
`)
      })

      it('should parse nested select with "not in" expression', () => {
        let query = `
select post [
  title
] where author_id not in (
  select user [ id ]
  where is_admin = 1
)
`
        let ast = decode(query)
        expectAST(ast, {
          type: 'select',
          table: {
            type: 'table',
            single: false,
            name: 'post',
            fields: [{ type: 'column', name: 'title' }],
            where: {
              expr: {
                type: 'in',
                expr: 'author_id',
                not: 'not',
                select: {
                  type: 'select',
                  table: {
                    type: 'table',
                    name: 'user',
                    single: false,
                    fields: [{ type: 'column', name: 'id' }],
                    where: {
                      expr: {
                        type: 'compare',
                        left: 'is_admin',
                        op: '=',
                        right: '1',
                      },
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
  post.title
from post
where post.author_id not in (
  select
    user.id
  from user
  where user.is_admin = 1
)
`)
      })

      it('should parse multi-level nested select with "in" expression', () => {
        let query = `
select post [
  title
] where author_id not in (
  select user [ id ]
  where type_id in (
    select user_type [ id ]
  )
)
`
        let ast = decode(query)
        expectAST(ast, {
          type: 'select',
          table: {
            type: 'table',
            single: false,
            name: 'post',
            fields: [{ type: 'column', name: 'title' }],
            where: {
              expr: {
                type: 'in',
                expr: 'author_id',
                not: 'not',
                select: {
                  type: 'select',
                  table: {
                    type: 'table',
                    name: 'user',
                    single: false,
                    fields: [{ type: 'column', name: 'id' }],
                    where: {
                      expr: {
                        type: 'in',
                        expr: 'type_id',
                        select: {
                          type: 'select',
                          table: {
                            type: 'table',
                            name: 'user_type',
                            single: false,
                            fields: [{ type: 'column', name: 'id' }],
                          },
                        },
                      },
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
  post.title
from post
where post.author_id not in (
  select
    user.id
  from user
  where user.type_id in (
    select
      user_type.id
    from user_type
  )
)
`)
      })
    })

    context('nested select sub-query', () => {
      it('should parse inline select sub-query with column alias', () => {
        let query = `
select post [
  id
  title
  (select user { nickname } where id = post.author_id) as by
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
              { type: 'column', name: 'title' },
              {
                type: 'subQuery',
                alias: 'by',
                select: {
                  type: 'select',
                  table: {
                    type: 'table',
                    name: 'user',
                    single: true,
                    fields: [{ type: 'column', name: 'nickname' }],
                    where: {
                      expr: {
                        type: 'compare',
                        left: 'id',
                        op: '=',
                        right: 'post.author_id',
                      },
                    },
                  },
                },
              },
            ],
          },
        })
        let sql = generateSQL(ast)
        expect(sql).to.equals(/* sql */ `
select
  post.id
, post.title
, (
  select
    user.nickname
  from user
  where user.id = post.author_id
  limit 1
) as by
from post
`)
      })
    })

    it('should parse "where", "group by", "order by", "limit", "offset" in any order', () => {
      let query = `
select post [
  id
]
offset 20
limit 10
order by publish_time asc
group by type_id
where author_id = :author
`
      let ast = decode(query)
      let sql = generateSQL(ast)
      expect(sql).to.equals(/* sql */ `
select
  post.id
from post
where post.author_id = :author
group by
  post.type_id
order by
  post.publish_time asc
limit 10
offset 20
`)
    })

    it('should preserve original upper/lower case in the query', () => {
      let query = `
SELECT DISTINCT THREAD AS POST [
  VER AS VERSION
  TITLE
]
WHERE AUTHOR_ID = :Author_ID
  AND PUBLISH_TIME NOT BETWEEN '2022-01-01' AND '2022-12-31'
   OR NOT DELETE_TIME IS NULL
GROUP BY VERSION
ORDER BY VERSION COLLATE NOCASE DESC NULLS FIRST
LIMIT 10
OFFSET 20
`
      let ast = decode(query)
      expectAST(ast, {
        type: 'select',
        selectStr: 'SELECT',
        distinct: 'DISTINCT',
        table: {
          type: 'table',
          name: 'THREAD',
          alias: 'POST',
          asStr: 'AS',
          single: false,
          fields: [
            { type: 'column', name: 'VER', alias: 'VERSION', asStr: 'AS' },
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
                right: ':Author_ID',
              },
              op: 'AND',
              right: {
                type: 'compare',
                left: {
                  type: 'between',
                  betweenStr: 'BETWEEN',
                  not: 'NOT',
                  andStr: 'AND',
                  expr: 'PUBLISH_TIME',
                  left: "'2022-01-01'",
                  right: "'2022-12-31'",
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
          groupBy: { groupByStr: 'GROUP BY', fields: ['VERSION'] },
          orderBy: {
            orderByStr: 'ORDER BY',
            fields: [
              { name: 'VERSION', order: 'COLLATE NOCASE DESC NULLS FIRST' },
            ],
          },
          limit: 'LIMIT 10',
          offset: 'OFFSET 20',
        },
      })
      let sql = generateSQL(ast)
      expect(sql).to.equals(/* sql */ `
SELECT DISTINCT
  POST.VER AS VERSION
, POST.TITLE
FROM THREAD AS POST
WHERE POST.AUTHOR_ID = :Author_ID
  AND POST.PUBLISH_TIME NOT BETWEEN '2022-01-01' AND '2022-12-31'
   OR NOT POST.DELETE_TIME IS NULL
GROUP BY
  POST.VERSION
ORDER BY
  POST.VERSION COLLATE NOCASE DESC NULLS FIRST
LIMIT 10
OFFSET 20
`)
    })
  })

  context('code-gen helpers', () => {
    it('should insert table prefix on column name', () => {
      let name = nameWithTablePrefix({ field: 'score', tableName: 'exam' })
      expect(name).to.equals('exam.score')
    })

    it('should insert table prefix in aggregate function', () => {
      let name = nameWithTablePrefix({ field: 'sum(score)', tableName: 'exam' })
      expect(name).to.equals('sum(exam.score)')
    })
  })
})
