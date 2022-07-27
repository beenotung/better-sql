import { AST } from './parse'

export function generateSQL(ast: AST.Select): string {
  const table = ast.table
  const selectFields: string[] = []

  let fromSQL = 'from ' + nameToSQL(table)
  let whereConditions: AST.Where[] = []

  function processTable(table: AST.Table) {
    const tableName = table.alias || table.name
    let { where } = table

    table.fields.forEach(field => {
      if (field.type === 'column') {
        selectFields.push(tableName + '.' + nameToSQL(field))
      } else if (field.type === 'table') {
        const subTable = nameToSQL(field)
        const subTableName = field.alias || field.name
        fromSQL += `
inner join ${subTable} on ${subTableName}.id = ${tableName}.${subTableName}_id`
        processTable(field)
      }
    })
    if (where) {
      if (shouldAddTablePrefix(where.left)) {
        where = { ...where, left: tableName + '.' + where.left }
      }
      if (shouldAddTablePrefix(where.right)) {
        where = { ...where, right: tableName + '.' + where.right }
      }
      whereConditions.push(where)
    }
  }

  processTable(table)

  const selectSQL = '  ' + selectFields.join('\n, ')

  let sql = `
select
${selectSQL}
${fromSQL}
`
  if (whereConditions.length > 0) {
    sql += `where `
    if (whereConditions.length === 1) {
      sql += whereToSQL(whereConditions[0])
    } else {
      sql += whereConditions.map(where => whereToSQL(where)).join('\n  and ')
    }
    sql += `
`
  }
  if (table.single) {
    sql += `limit 1
`
  }
  return sql
}

function nameToSQL(named: { name: string; alias?: string }): string {
  let sql = named.name
  if (named.alias) {
    sql += ' as ' + named.alias
  }
  return sql
}

function shouldAddTablePrefix(field: string): boolean {
  switch (field[0]) {
    case ':':
    case '$':
    case '@':
    case '?':
      return false
  }
  switch (field) {
    case 'null':
    case '0':
    case '0.0':
      return false
  }
  return !(+field || field.includes('.'))
}

function whereToSQL(where: AST.Where): string {
  let sql = [where.left, where.op, where.right].join(' ')
  let { next } = where
  if (next) {
    sql += ` ${next.op} ` + whereToSQL(next.where)
  }
  return sql
}
