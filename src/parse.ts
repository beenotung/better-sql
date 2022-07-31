export function decode(text: string) {
  const tokens = tokenize(text)
  const { rest, ast } = parse(tokens)
  if (rest.length > 0) {
    console.error('unconsumed tokens:', rest)
    throw new Error(`unexpected token: "${rest[0].type}"`)
  }
  return ast
}

export namespace Token {
  export type Word = {
    type: 'word'
    value: string
  }
  export type Symbol = {
    type: 'symbol'
    value: string
  }
  export type Newline = {
    type: 'newline'
  }
  export type Any = Word | Symbol | Newline
}

const wordRegex = /^[a-zA-Z_0-9:@\$\?]+/
const symbols = Object.fromEntries('{}[]()<>!=,'.split('').map(c => [c, true]))
const keywords = ['<>', '!=', '<=', '>=']

export function tokenize(text: string): Token.Any[] {
  const tokens: Token.Any[] = []
  text
    .trim()
    .split('\n')
    .map(line => line.trim())
    .filter(line => line)
    .forEach(line => {
      tokens.push({ type: 'newline' })
      let rest = line
      main: for (;;) {
        rest = rest.trim()

        for (const keyword of keywords) {
          if (
            rest.startsWith(keyword) &&
            (rest[keyword.length] === ' ' || rest[keyword.length] === '\n')
          ) {
            rest = rest.slice(keyword.length)
            tokens.push({ type: 'symbol', value: keyword })
            continue main
          }
        }

        const parts = rest
          .split(' ')
          .map(part => part.trim())
          .filter(part => part.length > 0)
        if (
          parts[0]?.toLowerCase() === 'is' &&
          parts[1]?.toLowerCase() === 'not' &&
          parts[2]?.toLowerCase().startsWith('null')
        ) {
          tokens.push({ type: 'symbol', value: parts[0] + ' ' + parts[1] })
          tokens.push({ type: 'word', value: parts[2].slice(0, 'null'.length) })
          rest = rest.slice(rest.indexOf(parts[2] + 'null'.length))
          continue
        }
        if (
          parts[0]?.toLowerCase() === 'is' &&
          parts[1]?.toLowerCase().startsWith('null')
        ) {
          tokens.push({ type: 'symbol', value: parts[0] })
          tokens.push({ type: 'word', value: parts[1].slice(0, 'null'.length) })
          rest = rest.slice(rest.indexOf(parts[1]) + 'null'.length)
          continue
        }

        const char = rest[0]
        if (!char) return
        if (char in symbols) {
          rest = rest.slice(1)
          tokens.push({ type: 'symbol', value: char })
          continue
        }
        const match = rest.match(wordRegex)
        if (match) {
          const value = match[0]
          rest = rest.slice(value.length)
          tokens.push({ type: 'word', value })
          continue
        }
        console.error('unknown token:', { char, rest })
        throw new Error('unknown token: ' + JSON.stringify(char))
      }
    })
  return tokens.slice(1)
}

export namespace AST {
  export type Expression = Select
  export type Select = {
    type: 'select'
    distinct?: string
    selectStr?: string
    table: Table
  }
  export type Table = {
    type: 'table'
    name: string
    alias?: string
    single: boolean
    join?: string
    fields: Field[]
    where?: Where
    groupBy?: GroupBy
  }
  export type Field = Column | Table
  export type Column = {
    type: 'column'
    name: string
    alias?: string
  }
  export type Where = {
    whereStr?: string
    expr: WhereExpr
  }
  export type WhereExpr =
    | {
        type: 'compare'
        left: WhereExpr | string
        op: string
        right: WhereExpr | string
      }
    | {
        type: 'not'
        notStr?: 'not' | string
        expr: WhereExpr
      }
    | {
        type: 'parenthesis'
        expr: WhereExpr
      }
  export type GroupBy = {
    groupByStr?: string
    fields: string[]
  }
}

export function parse(tokens: Token.Any[]) {
  let rest = skipNewline(tokens)
  if (rest.length === 0) {
    throw new Error('empty tokens')
  }
  if (isWord(rest[0], 'select')) {
    const selectStr = remarkStr(rest[0], 'select')
    rest = rest.slice(1)
    rest = skipNewline(rest)

    let distinct: string | undefined
    if (isWord(rest[0], 'distinct')) {
      distinct = (rest[0] as Token.Word).value
      rest = rest.slice(1)
      rest = skipNewline(rest)
    }

    const tableResult = parseTable(rest)
    rest = tableResult.rest
    rest = skipNewline(rest)

    const { table } = tableResult
    const ast: AST.Select = {
      type: 'select',
      table,
    }
    if (selectStr) {
      ast.selectStr = selectStr
    }
    if (distinct) {
      ast.distinct = distinct
    }
    return { ast, rest }
  }
  throw new Error('missing "select" token')
}

function parseTable(tokens: Token.Any[]) {
  let rest = tokens

  const tableNameResult = parseWord(rest, 'table name')
  const tableName = tableNameResult.value
  rest = tableNameResult.rest

  if (rest.length === 0) {
    throw new Error(`unexpected termination after table name "${tableName}"`)
  }

  let alias: string | undefined
  const token = rest[0]
  if (token.type === 'word' && token.value === 'as') {
    rest = rest.slice(1)
    const aliasResult = parseWord(rest, `alias of table "${tableName}"`)
    rest = aliasResult.rest
    alias = aliasResult.value
  }

  const fieldResult = parseFields(rest, tableName)
  rest = fieldResult.rest
  const { single, fields, where, groupBy } = fieldResult

  const table: AST.Table = { type: 'table', name: tableName, single, fields }
  if (alias) {
    table.alias = alias
  }
  if (where) {
    table.where = where
  }
  if (groupBy) {
    table.groupBy = groupBy
  }
  return { table, rest }
}

function parseFields(tokens: Token.Any[], tableName: string) {
  let rest = tokens

  const openBracketResult = parseOpenBracket(
    rest,
    `open bracket for table "${tableName}"`,
  )
  rest = openBracketResult.rest
  const { closeBracket, single } = openBracketResult

  const fields: AST.Field[] = []

  function popField(message: string) {
    const field = fields.pop()
    if (!field) {
      throw new Error(message)
    }
    return field
  }

  for (;;) {
    if (rest.length === 0) {
      throw new Error(
        `missing close bracket "${closeBracket}" for table "${tableName}"`,
      )
    }

    const token = rest[0]

    if (token.type === 'symbol' && token.value === closeBracket) {
      rest = rest.slice(1)
      break
    }

    if (token.type === 'word') {
      const value = token.value
      rest = rest.slice(1)
      if (value === 'as') {
        const field = popField(`missing field name before "as" alias`)
        if (field.type === 'table') {
          throw new Error(`expected "as" alias after table "${field.name}"`)
        }
        const wordResult = parseWord(rest, `alias of column "${field.name}"`)
        rest = wordResult.rest
        field.alias = wordResult.value
        fields.push(field)
        continue
      }
      fields.push({ type: 'column', name: value })
      continue
    }

    if (
      token.type === 'newline' ||
      (token.type === 'symbol' && token.value === ',')
    ) {
      rest = rest.slice(1)
      continue
    }

    if (isOpenBracket(token)) {
      const field = popField(
        `missing relation table name in fields of table "${tableName}"`,
      )
      const fieldsResult = parseFields(rest, field.name)
      rest = fieldsResult.rest
      const table: AST.Table = {
        type: 'table',
        name: field.name,
        single: fieldsResult.single,
        fields: fieldsResult.fields,
      }
      if (field.alias) {
        table.alias = field.alias
      }
      if (fieldsResult.where) {
        table.where = fieldsResult.where
      }
      if (fieldsResult.groupBy) {
        table.groupBy = fieldsResult.groupBy
      }
      fields.push(table)
      continue
    }

    throw new Error(
      `expected table fields, got token: ${JSON.stringify(token)}`,
    )
  }

  const whereResult = parseWhere(rest, tableName)
  rest = whereResult.rest
  const { where } = whereResult

  const groupByResult = parseGroupBy(rest, tableName)
  rest = groupByResult.rest
  const { groupBy } = groupByResult

  return { single, fields, rest, where, groupBy }
}

function parseWord(tokens: Token.Any[], name: string) {
  let rest = tokens
  for (;;) {
    if (rest.length === 0) {
      throw new Error(`missing ${name}`)
    }
    const token = rest[0]
    if (token.type === 'newline') {
      rest = rest.slice(1)
      continue
    }
    if (token.type === 'word') {
      return { value: token.value, rest: rest.slice(1) }
    }
    throw new Error(`expect ${name}, got: ${JSON.stringify(token)}`)
  }
}

function parseSymbol(tokens: Token.Any[], name: string) {
  let rest = tokens
  for (;;) {
    if (rest.length === 0) {
      throw new Error(`missing ${name}`)
    }
    const token = rest[0]
    if (token.type === 'newline') {
      rest = rest.slice(1)
      continue
    }
    if (token.type === 'symbol') {
      return { value: token.value, rest: rest.slice(1) }
    }
    throw new Error(`expect ${name} but got: ${JSON.stringify(token)}`)
  }
}

function isOpenBracket(token: Token.Any): boolean {
  return token.type === 'symbol' && (token.value === '{' || token.value === '[')
}

function parseOpenBracket(tokens: Token.Any[], name: string) {
  let rest = tokens

  const result = parseSymbol(rest, name)
  const openBracket = result.value
  rest = result.rest
  let single: boolean
  let closeBracket: string

  switch (openBracket) {
    case '[': {
      single = false
      closeBracket = ']'
      break
    }
    case '{': {
      single = true
      closeBracket = '}'
      break
    }
    default: {
      throw new Error(
        `expect "[" or "{" as ${name}, got: ${JSON.stringify(openBracket)}`,
      )
    }
  }

  return { rest, single, openBracket, closeBracket }
}

function skipNewline(tokens: Token.Any[]) {
  let rest = tokens
  while (rest.length > 0 && rest[0].type === 'newline') {
    rest = rest.slice(1)
  }
  return rest
}

function parseWhere(
  tokens: Token.Any[],
  tableName: string,
): { rest: Token.Any[]; where?: AST.Where } {
  let rest = skipNewline(tokens)
  if (!isWord(rest[0], 'where')) {
    return { rest }
  }
  const whereStr = remarkStr(rest[0], 'where')
  rest = rest.slice(1)
  const partResult = parseWhereExpr(rest, tableName)
  rest = partResult.rest
  const expr = partResult.expr
  const where: AST.Where = { expr }
  if (whereStr) {
    where.whereStr = whereStr
  }
  return { rest, where }
}

function parseWhereExpr(
  tokens: Token.Any[],
  tableName: string,
): { expr: AST.WhereExpr; rest: Token.Any[] } {
  let rest = tokens
  rest = skipNewline(rest)
  if (rest.length === 0) {
    throw new Error(`empty where statement after table "${tableName}"`)
  }

  if (isWord(rest[0], 'not')) {
    const notStr = remarkStr(rest[0], 'not')
    rest = rest.slice(1)
    const result = parseWhereExpr(rest, tableName)
    rest = result.rest
    let expr = result.expr
    expr = { type: 'not', expr }
    if (notStr) {
      expr.notStr = notStr
    }
    return { rest, expr }
  }

  let expr: AST.WhereExpr
  if (isSymbol(rest[0], '(')) {
    rest = rest.slice(1)
    const result = parseWhereExpr(rest, tableName)
    rest = result.rest
    rest = skipNewline(rest)
    if (!isSymbol(rest[0], ')')) {
      throw new Error(
        `missing close parenthesis in where statement after table "${tableName}"`,
      )
    }
    rest = rest.slice(1)
    expr = { type: 'parenthesis', expr: result.expr }
  } else {
    const leftResult = parseWord(
      rest,
      `left-hand side of where statement after table "${tableName}"`,
    )
    rest = leftResult.rest
    const left = leftResult.value

    const opResult = parseSymbol(
      rest,
      `operator of where statement after table "${tableName}"`,
    )
    rest = opResult.rest
    const op = opResult.value

    const rightResult = parseWord(
      rest,
      `right-hand side of where statement after table "${tableName}"`,
    )
    rest = rightResult.rest
    const right = rightResult.value

    expr = { type: 'compare', left, op, right }
  }

  rest = skipNewline(rest)

  check_logic: while (rest.length > 0 && rest[0].type === 'word') {
    const word = rest[0].value.toLowerCase()
    switch (word) {
      case 'and':
      case 'or': {
        const op = rest[0].value
        rest = rest.slice(1)
        const exprResult = parseWhereExpr(rest, tableName)
        rest = exprResult.rest
        expr = { type: 'compare', left: expr, op, right: exprResult.expr }
        rest = skipNewline(rest)
        continue
      }
      default:
        break check_logic
    }
  }

  return { expr, rest }
}

function isWord(token: Token.Any | undefined, word: string) {
  return (
    token &&
    token.type === 'word' &&
    token.value.toLowerCase() === word.toLowerCase()
  )
}

function isSymbol(token: Token.Any | undefined, symbol: string) {
  return (
    token && token.type === 'symbol' && token.value.toLowerCase() === symbol
  )
}

function remarkStr(word: Token.Any, expect: string): string | undefined {
  if (word.type === 'word' && word.value !== expect) {
    return word.value
  }
}

function parseGroupBy(
  tokens: Token.Any[],
  tableName: string,
): { rest: Token.Any[]; groupBy?: AST.GroupBy } {
  let rest = skipNewline(tokens)

  if (!(isWord(rest[0], 'group') && isWord(rest[1], 'by'))) {
    return { rest }
  }

  const groupByStr: string | undefined =
    (rest[0] as Token.Word).value + ' ' + (rest[1] as Token.Word).value
  rest = rest.slice(2)
  rest = skipNewline(rest)

  if (rest.length === 0) {
    throw new Error(`empty "group by" statement after table "${tableName}"`)
  }

  const fields: string[] = []

  let word = parseWord(
    rest,
    `first field name of "group by" statement after table "${tableName}"`,
  )
  rest = word.rest
  fields.push(word.value)
  for (; rest.length > 0; ) {
    rest = skipNewline(rest)
    if (!isSymbol(rest[0], ',')) {
      break
    }
    rest = rest.slice(1)
    let word = parseWord(
      rest,
      `more field name of "group by" statement after table "${tableName}"`,
    )
    rest = word.rest
    fields.push(word.value)
  }

  const ast: AST.GroupBy = { fields }

  if (groupByStr !== 'group by') {
    ast.groupByStr = groupByStr
  }

  return { rest, groupBy: ast }
}
