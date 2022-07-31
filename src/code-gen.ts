import { AST } from './parse'

type WhereCondition = {
  tableName: string
  where: AST.Where
}

export function generateSQL(ast: AST.Select): string {
  const table = ast.table
  const selectFields: string[] = []

  let selectStr: string = ast.selectStr || 'select'

  const fromStr: string =
    selectStr === 'SELECT' ? 'FROM' : selectStr === 'Select' ? 'From' : 'from'

  if (ast.distinct) {
    selectStr += ' ' + ast.distinct
  }

  let fromSQL = fromStr + ' ' + nameToSQL(table)
  const whereConditions: WhereCondition[] = []

  let groupByStr: string | undefined
  const groupByFields: string[] = []

  function processTable(table: AST.Table) {
    const tableName = table.alias || table.name
    const { where, groupBy } = table

    if (groupBy) {
      groupByStr = groupByStr || groupBy.groupByStr
      groupBy.fields.forEach(field => {
        if (shouldAddTablePrefix(field)) {
          field = tableName + '.' + field
        }
        groupByFields.push(field)
      })
    }

    table.fields.forEach(field => {
      if (field.type === 'column') {
        selectFields.push(tableName + '.' + nameToSQL(field))
      } else if (field.type === 'table') {
        const subTable = nameToSQL(field)
        const subTableName = field.alias || field.name
        const join = field.single ? 'inner join' : 'left join'
        fromSQL += `
${join} ${subTable} on ${subTableName}.id = ${tableName}.${subTableName}_id`
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
      sql += whereToSQL(
        whereConditions[0].tableName,
        whereConditions[0].where.expr,
      )
    } else {
      sql += whereConditions
        .map(condition => {
          let sql = whereToSQL(condition.tableName, condition.where.expr)
          if (hasOr(condition.where.expr)) {
            sql = `(${sql})`
          }
          return sql
        })
        .join('\n  and ')
    }
    sql += `
`
  }

  if (groupByFields.length > 0) {
    groupByStr = groupByStr || 'group by'
    sql += `${groupByStr}
  ${groupByFields.join(`
, `)}
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

function whereToSQL(tableName: string, expr: AST.WhereExpr | string): string {
  if (typeof expr === 'string') {
    if (shouldAddTablePrefix(expr)) {
      expr = tableName + '.' + expr
    }
    return expr
  }
  switch (expr.type) {
    case 'not': {
      const notStr = expr.notStr || 'not'
      return notStr + ' ' + whereToSQL(tableName, expr.expr)
    }
    case 'parenthesis': {
      return '(' + whereToSQL(tableName, expr.expr) + ')'
    }
    case 'compare': {
      let sql = whereToSQL(tableName, expr.left)
      switch (expr.op.toLowerCase()) {
        case 'and':
          sql += '\n  ' + expr.op
          break
        case 'or':
          sql += '\n   ' + expr.op
          break
        default:
          sql += ' ' + expr.op
      }
      sql += ' ' + whereToSQL(tableName, expr.right)
      return sql
    }
  }
}

function hasOr(where: AST.WhereExpr): boolean {
  for (;;) {
    switch (where.type) {
      case 'not':
      case 'parenthesis':
        where = where.expr
        continue
      case 'compare':
        return (
          where.op.toLowerCase() === 'or' ||
          (typeof where.left !== 'string' && hasOr(where.left)) ||
          (typeof where.right !== 'string' && hasOr(where.right))
        )
    }
  }
}

function pickWhereStrFromConditions(
  whereConditions: WhereCondition[],
): string | undefined {
  for (const condition of whereConditions) {
    const where = condition.where
    if (where.whereStr) return where.whereStr
  }
}
