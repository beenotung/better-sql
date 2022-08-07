import { expect } from 'chai'
import { generateSQL } from '../src/code-gen'
import { decode } from '../src/parse'

let text = /* sql */ `
select post [
  id as post_id
  title
  author_id
  user as author { nickname, avatar } where delete_time is null
  type_id
  post_type {
    name as type
    is_hidden
  } where is_hidden = 0 or user.is_admin = 1
] where created_at >= :since
    and delete_time is null
    and title like :keyword
  order by created_at desc
  limit 25
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
, post_type.is_hidden
from post
inner join user as author on author.id = post.author_id
inner join post_type on post_type.id = post.post_type_id
where author.delete_time is null
  and (post_type.is_hidden = 0
   or user.is_admin = 1)
  and post.created_at >= :since
  and post.delete_time is null
  and post.title like :keyword
order by
  post.created_at desc
limit 25
`
expect(query).to.equals(sql)
