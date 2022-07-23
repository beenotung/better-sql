import { decode } from '../src/parse'

let text = `
select post [
	id as post_id
	title
	author_id
	author { nickname, avatar }
	type_id
	type { name }
	?created_at >= :since
]
`

let res = decode(text)

console.log(res)
