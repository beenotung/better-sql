# better-sql.ts

Generate sql query from a concise query syntax inspired from [EdgeDB](https://www.edgedb.com/blog/edgedb-1-0) and [GraphQL](https://graphql.org/).

[![npm Package Version](https://img.shields.io/npm/v/better-sql.ts)](https://www.npmjs.com/package/better-sql.ts)

<!-- [![npm Package Downloads](https://img.shields.io/npm/dm/better-sql.ts)](https://www.npmtrends.com/better-sql-lang) -->

## Supported Features

- [x] automatically add table name on columns if not specified
- [x] inner join with nested `table {fields}`
- [x] left join with nested `table [fields]`
- [x] nested select sub-query
- [x] `where` statement
- [x] `having` statement
- [x] `group by` statement
- [x] aggregate function, e.g. `sum(score)`
- [x] `order by` statement
- [x] `limit` and `offset` statement

## Example

<table>
<tbody>
<tr>
<td>
A query in better-sql:

```sql
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
]
where created_at >= :since
  and delete_time is null


```

</td>
<td>
is converted into formatted sql as below:

```sql
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
```

</td>
</tr>
</tbody>
</table>

Details refers to [sample.ts](./test/sample.ts) and [lang.spec.ts](./test/lang.spec.ts)
