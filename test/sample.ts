import { decode } from '../src/parse'

let text = `
select post [
	id as post_id
	title
	author_id
	author {
    nickname
    avatar
  }
	type_id
	type { name }
	?created_at >= :since
]
`

let res = decode(text)

console.log('decoded:', res)

let sql = /* sql */ `
select
  post.id as post_id
, post.title
, post.author_id
, author.nickname
, author.avatar
, post.type_id
, post_type.name
from post
inner join user as author on author.id = post.author_id
inner join post_type on post_type.id = post.type_id
where post.created_at >= :since
`

console.log('sql:', sql)
