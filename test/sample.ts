import { expect } from 'chai'
import { generateSQL } from '../src/code-gen'
import { decode } from '../src/parse'

let text = /* sql */ `
select post [
  id as post_id
  title
  author_id
  user as author {
    nickname
    avatar
  } where delete_time is null
  type_id
  post_type { name as type }
] where created_at >= :since and delete_time is null
`

let ast = decode(text)
let query = generateSQL(ast)
let sql = /* sql */ `
select
  post.id as post_id
, post.title
, post.author_id
, author.nickname
, author.avatar
, post.type_id
, post_type.name as type
from post
inner join user as author on author.id = post.author_id
inner join post_type on post_type.id = post.post_type_id
where author.delete_time is null
  and post.created_at >= :since
  and post.delete_time is null
`
expect(query).to.equals(sql)
