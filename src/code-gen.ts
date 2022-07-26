import { AST } from './parse'

type Condition = {
  tableName: string
  expr: AST.WhereExpr
}

export function generateSQL(ast: AST.Select): string {
  return toSQL(ast)
}

function toSQL(ast: AST.Select): string {
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
  const context = { toCase }

  const fromStr: string = toCase('from')
  let fromSQL = fromStr + ' ' + nameWithAlias(table, toCase)

  let whereStr: string | undefined
  let havingStr: string | undefined

  const whereConditions: Condition[] = []
  const havingConditions: Condition[] = []

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
    const { where, groupBy, having, orderBy } = table

    limit = limit || table.limit
    offset = offset || table.offset

    table.fields.forEach(field => {
      if (field.type === 'column') {
        selectFields.push(
          nameWithTablePrefix({
            field: nameWithAlias(field, toCase),
            tableName,
          }),
        )
      } else if (field.type === 'table') {
        const subTable = nameWithAlias(field, toCase)
        const subTableName = field.alias || field.name
        const join = field.single ? toCase('inner join') : toCase('left join')
        fromSQL += `
${join} ${subTable} ${on} ${subTableName}.${id} = ${tableName}.${subTableName}_${id}`
        processTable(field)
      } else if (field.type === 'subQuery') {
        let sql = toSQL(field.select)
        sql = addIndentation(sql)
        sql = `(${sql})`
        if (field.alias) {
          const asStr = field.asStr || toCase('as')
          sql += ` ${asStr} ${field.alias}`
        }
        selectFields.push(sql)
      }
    })
    if (where) {
      whereStr = whereStr || where.whereStr
      whereConditions.push({ tableName, expr: where.expr })
    }
    if (having) {
      havingStr = havingStr || having.havingStr
      havingConditions.push({ tableName, expr: having.expr })
    }
    if (groupBy) {
      groupByStr = groupByStr || groupBy.groupByStr
      groupBy.fields.forEach(field => {
        groupByFields.push(nameWithTablePrefix({ field, tableName }))
      })
    }
    if (orderBy) {
      orderByStr = orderByStr || orderBy.orderByStr
      orderBy.fields.forEach(({ name, order }) => {
        let field = nameWithTablePrefix({ field: name, tableName })
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

  function addConditions(conditions: Condition[], conditionStr: string) {
    if (conditions.length === 0) {
      return
    }
    sql += conditionStr + ' '
    if (conditions.length === 1) {
      sql += whereToSQL(conditions[0].tableName, conditions[0].expr, context)
    } else {
      sql += conditions
        .map(condition => {
          let sql = whereToSQL(condition.tableName, condition.expr, context)
          if (needParentheses(condition.expr)) {
            sql = `(${sql})`
          }
          return sql
        })
        .join(`\n  ${and} `)
    }
    sql += `
`
  }

  addConditions(whereConditions, whereStr || toCase('where'))

  if (havingConditions.length > 0 && groupByFields.length === 0) {
    console.warn('using "having" without "group by"')
  }

  if (groupByFields.length > 0) {
    groupByStr = groupByStr || toCase('group by')
    sql += `${groupByStr}
  ${groupByFields.join(`
, `)}
`
  }

  addConditions(havingConditions, havingStr || toCase('having'))

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

type Named = {
  name: string
  alias?: string
  asStr?: string
}

function nameWithAlias(named: Named, toCase: (word: string) => string): string {
  const asStr = named.asStr || toCase('as')
  let sql = named.name
  if (named.alias) {
    sql += ' ' + asStr + ' ' + named.alias
  }
  return sql
}

export function nameWithTablePrefix(input: {
  field: string
  tableName: string
}) {
  let field = input.field
  if (shouldAddTablePrefix(field)) {
    const match = field.match(/.*\((.*)\).*/)
    if (match) {
      field = field.replace(match[1], input.tableName + '.' + match[1])
    } else {
      field = input.tableName + '.' + field
    }
  }
  return field
}

function shouldAddTablePrefix(field: string): boolean {
  switch (field[0]) {
    case ':':
    case '$':
    case '@':
    case '?':
    case "'":
    case '"':
      return false
  }
  switch (field) {
    case '0':
    case '0.0':
      return false
  }
  if (field.toLowerCase() === 'null') return false
  return !(+field || field.includes('.') || field.includes('*'))
}

function whereToSQL(
  tableName: string,
  expr: AST.WhereValueExpr,
  context: {
    toCase: (word: string) => string
  },
): string {
  if (typeof expr === 'string') {
    return nameWithTablePrefix({ field: expr, tableName })
  }
  const { toCase } = context
  switch (expr.type) {
    case 'not': {
      const notStr = expr.notStr || toCase('not')
      return notStr + ' ' + whereToSQL(tableName, expr.expr, context)
    }
    case 'parenthesis': {
      return '(' + whereToSQL(tableName, expr.expr, context) + ')'
    }
    case 'compare': {
      let sql = whereToSQL(tableName, expr.left, context)
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
      sql += ' ' + whereToSQL(tableName, expr.right, context)
      return sql
    }
    case 'between': {
      const betweenStr = expr.betweenStr || toCase('between')
      const andStr = expr.andStr || toCase('and')
      let sql: string = whereToSQL(tableName, expr.expr, context)
      if (expr.not) {
        sql += ' ' + expr.not
      }
      sql +=
        ' ' +
        betweenStr +
        ' ' +
        whereToSQL(tableName, expr.left, context) +
        ' ' +
        andStr +
        ' ' +
        whereToSQL(tableName, expr.right, context)
      return sql
    }
    case 'in': {
      const inStr = expr.inStr || toCase('in')
      let sql: string = whereToSQL(tableName, expr.expr, context)
      if (expr.not) {
        sql += ' ' + expr.not
      }
      let subQuery = toSQL(expr.select)
      subQuery = addIndentation(subQuery)
      sql += ` ${inStr} (${subQuery})`
      return sql
    }
    case 'select': {
      let sql = toSQL(expr)
      sql = addIndentation(sql)
      return sql
    }
  }
}

function addIndentation(sql: string): string {
  return sql
    .split('\n')
    .map(
      (line, i, lines) =>
        (i === 0 || i === lines.length - 1 ? '' : '  ') + line,
    )
    .join('\n')
}

function needParentheses(expr: AST.WhereValueExpr): boolean {
  for (;;) {
    if (typeof expr === 'string') {
      return false
    }
    switch (expr.type) {
      case 'not':
        expr = expr.expr
        continue
      case 'compare':
        return (
          expr.op.toLowerCase() === 'or' ||
          needParentheses(expr.left) ||
          needParentheses(expr.right)
        )
      case 'parenthesis':
      case 'between':
      case 'in':
        return false
      case 'select':
        return true
      default: {
        const _expr: never = expr
        throw new Error('Unexpected expression: ' + JSON.stringify(_expr))
      }
    }
  }
}
