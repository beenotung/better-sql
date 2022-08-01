import { AST } from './parse'

type WhereCondition = {
  tableName: string
  where: AST.Where
}

export function generateSQL(ast: AST.Select): string {
  const table = ast.table
  const selectFields: string[] = []

  let selectStr: string = ast.selectStr || 'select'
  if (ast.distinct) {
    selectStr += ' ' + ast.distinct
  }

  function toCase(word: string) {
    return word
      .split(' ')
      .map(word => {
        switch (ast.selectStr) {
          case 'SELECT':
            return word.toUpperCase()
          case 'Select':
            return word[0].toUpperCase() + word.slice(1).toLowerCase()
          default:
            return word.toLowerCase()
        }
      })
      .join(' ')
  }

  const fromStr: string = toCase('from')
  let fromSQL = fromStr + ' ' + nameToSQL(table, toCase)
  const whereConditions: WhereCondition[] = []

  let groupByStr: string | undefined
  const groupByFields: string[] = []

  let orderByStr: string | undefined
  const orderByFields: string[] = []

  let { limit, offset } = table

  const on = toCase('on')
  const id = toCase('id')
  const and = toCase('and')

  function processTable(table: AST.Table) {
    const tableName = table.alias || table.name
    const { where, groupBy, orderBy } = table

    limit = limit || table.limit
    offset = offset || table.offset

    table.fields.forEach(field => {
      if (field.type === 'column') {
        selectFields.push(tableName + '.' + nameToSQL(field, toCase))
      } else if (field.type === 'table') {
        const subTable = nameToSQL(field, toCase)
        const subTableName = field.alias || field.name
        const join = field.single ? toCase('inner join') : toCase('left join')
        fromSQL += `
${join} ${subTable} ${on} ${subTableName}.${id} = ${tableName}.${subTableName}_${id}`
        processTable(field)
      }
    })
    if (where) {
      whereConditions.push({ tableName, where })
    }
    if (groupBy) {
      groupByStr = groupByStr || groupBy.groupByStr
      groupBy.fields.forEach(field => {
        if (shouldAddTablePrefix(field)) {
          field = tableName + '.' + field
        }
        groupByFields.push(field)
      })
    }
    if (orderBy) {
      orderByStr = orderByStr || orderBy.orderByStr
      orderBy.fields.forEach(({ name, order }) => {
        let field = name
        if (shouldAddTablePrefix(field)) {
          field = tableName + '.' + field
        }
        if (order) {
          field += ' ' + order
        }
        orderByFields.push(field)
      })
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
      pickWhereStrFromConditions(whereConditions) || toCase('where')
    sql += whereStr + ' '
    if (whereConditions.length === 1) {
      sql += whereToSQL(
        whereConditions[0].tableName,
        whereConditions[0].where.expr,
        toCase,
      )
    } else {
      sql += whereConditions
        .map(condition => {
          let sql = whereToSQL(
            condition.tableName,
            condition.where.expr,
            toCase,
          )
          if (hasOr(condition.where.expr)) {
            sql = `(${sql})`
          }
          return sql
        })
        .join(`\n  ${and} `)
    }
    sql += `
`
  }

  if (groupByFields.length > 0) {
    groupByStr = groupByStr || toCase('group by')
    sql += `${groupByStr}
  ${groupByFields.join(`
, `)}
`
  }

  if (orderByFields.length > 0) {
    orderByStr = orderByStr || toCase('order by')
    sql += `${orderByStr}
  ${orderByFields.join(`
, `)}
`
  }

  if (table.single && !limit) {
    limit = toCase('limit') + ' 1'
  }
  if (limit) {
    sql += `${limit}
`
  }
  if (offset) {
    sql += `${offset}
`
  }
  return sql
}

function nameToSQL(
  named: {
    name: string
    alias?: string
    asStr?: string
  },
  toCase: (word: string) => string,
): string {
  const asStr = named.asStr || toCase('as')
  let sql = named.name
  if (named.alias) {
    sql += ' ' + asStr + ' ' + named.alias
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

function whereToSQL(
  tableName: string,
  expr: AST.WhereExpr | string,
  toCase: (word: string) => string,
): string {
  if (typeof expr === 'string') {
    if (shouldAddTablePrefix(expr)) {
      expr = tableName + '.' + expr
    }
    return expr
  }
  switch (expr.type) {
    case 'not': {
      const notStr = expr.notStr || toCase('not')
      return notStr + ' ' + whereToSQL(tableName, expr.expr, toCase)
    }
    case 'parenthesis': {
      return '(' + whereToSQL(tableName, expr.expr, toCase) + ')'
    }
    case 'compare': {
      let sql = whereToSQL(tableName, expr.left, toCase)
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
      sql += ' ' + whereToSQL(tableName, expr.right, toCase)
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
