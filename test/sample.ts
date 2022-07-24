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

console.log(res)
/* sql */ ;`
select
  post.id as post_id
, post.title
, post.author_id
, user.nickname
, user.avatar
, post.type_id
, type.name
from post
inner join user on user.id = post.author_id
inner join type on type.id = post.type_id
where post.created_at >= :since
`
