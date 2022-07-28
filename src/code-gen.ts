import { AST } from './parse'

type WhereCondition = {
  tableName: string
  where: AST.Where
}

export function generateSQL(ast: AST.Select): string {
  const table = ast.table
  const selectFields: string[] = []

  const selectStr: string = ast.selectStr || 'select'
  const fromStr: string =
    selectStr === 'SELECT' ? 'FROM' : selectStr === 'Select' ? 'From' : 'from'

  let fromSQL = fromStr + ' ' + nameToSQL(table)
  const whereConditions: WhereCondition[] = []

  function processTable(table: AST.Table) {
    const tableName = table.alias || table.name
    const { where } = table

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
      whereConditions.push({ tableName, where })
    }
  }

  processTable(table)

  const selectSQL = '  ' + selectFields.join('\n, ')

  let sql = `
${selectStr}
${selectSQL}
${fromSQL}
`
  if (whereConditions.length > 0) {
    const whereStr: string =
      pickWhereStrFromConditions(whereConditions) || 'where'
    sql += whereStr + ' '
    if (whereConditions.length === 1) {
      sql += whereToSQL(whereConditions[0])
    } else {
      sql += whereConditions
        .map(condition => {
          let sql = whereToSQL(condition)
          if (hasOr(condition.where)) {
            sql = `(${sql})`
          }
          return sql
        })
        .join('\n  and ')
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
    case '0':
    case '0.0':
      return false
  }
  if (field.toLowerCase() === 'null') return false
  return !(+field || field.includes('.'))
}

function whereToSQL(whereCondition: WhereCondition): string {
  const { tableName, where } = whereCondition
  let { left, right } = where
  if (shouldAddTablePrefix(left)) {
    left = tableName + '.' + left
  }
  if (shouldAddTablePrefix(right)) {
    right = tableName + '.' + right
  }
  let sql = [left, where.op, right].join(' ')
  if (where.not) {
    sql = where.not + ' ' + sql
  }
  const { next } = where
  if (next) {
    const space = ' '.repeat('where'.length - next.op.length)
    sql +=
      `\n${space}${next.op} ` + whereToSQL({ tableName, where: next.where })
  }
  return sql
}

function hasOr(where: AST.Where): boolean {
  if (where.op.toLowerCase() === 'or') return true
  if (where.next) {
    if (where.next.op.toLowerCase() === 'or') return true
    if (where.next) return hasOr(where.next.where)
  }
  return false
}

function pickWhereStrFromConditions(
  whereConditions: WhereCondition[],
): string | undefined {
  for (const condition of whereConditions) {
    const str = pickWhereStrFromAST(condition.where)
    if (str) return str
  }
}

function pickWhereStrFromAST(where: AST.Where): string | undefined {
  if (where.whereStr) return where.whereStr
  if (where.next) return pickWhereStrFromAST(where.next.where)
}
