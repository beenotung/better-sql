export function decode(text: string) {
  const tokens = tokenize(text)
  const root = parse(tokens)
  return root
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
  }
  export type Field = Column | Table
  export type Column = {
    type: 'column'
    name: string
    alias?: string
  }
  export type Where = {
    type: 'where'
    whereStr?: string
    not?: string
    open?: '('
    left: string
    op: WhereOp
    right: string
    close?: ')'
    next?: {
      op: WhereOp
      where: Where
    }
  }
  export type WhereOp = string
}

export function parse(tokens: Token.Any[]): AST.Expression {
  if (tokens.length === 0) {
    throw new Error('empty tokens')
  }
  const token = tokens[0]
  if (isWord(token, 'select')) {
    const ast: AST.Select = {
      type: 'select',
      table: parseTable(tokens.slice(1)),
    }
    const selectStr = (token as Token.Word).value
    if (selectStr !== 'select') {
      ast.selectStr = selectStr
    }
    return ast
  }
  throw new Error('missing "select" token')
}

function parseTable(tokens: Token.Any[]): AST.Table {
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
  const { single, fields, where } = fieldResult

  const table: AST.Table = { type: 'table', name: tableName, single, fields }
  if (alias) {
    table.alias = alias
  }
  if (where) {
    table.where = where
  }
  return table
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

  return { single, fields, rest, where }
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
  if (isWord(rest[0], 'where')) {
    const whereStr = (rest[0] as Token.Word).value
    rest = rest.slice(1)
    const partResult = parseWherePart(rest, tableName)
    if (whereStr !== 'where') {
      partResult.where.whereStr = whereStr
    }
    return partResult
  }
  return { rest }
}

function parseWherePart(
  tokens: Token.Any[],
  tableName: string,
): { where: AST.Where; rest: Token.Any[] } {
  let rest = tokens
  rest = skipNewline(rest)
  if (rest.length === 0) {
    throw new Error(`empty where statement after table "${tableName}"`)
  }

  let not: string | undefined
  if (isWord(rest[0], 'not')) {
    not = (rest[0] as Token.Word).value
    rest = rest.slice(1)
    rest = skipNewline(rest)
  }

  let open: '(' | undefined
  if (isSymbol(rest[0], '(')) {
    open = '('
    rest = rest.slice(1)
    rest = skipNewline(rest)
  }

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

  rest = skipNewline(rest)

  let close: ')' | undefined
  if (isSymbol(rest[0], ')')) {
    close = ')'
    rest = rest.slice(1)
    rest = skipNewline(rest)
  }

  const where: AST.Where = { type: 'where', left, op, right }
  if (not) {
    where.not = not
  }
  if (open) {
    where.open = open
  }
  if (close) {
    where.close = close
  }

  if (rest.length > 0 && rest[0].type === 'word') {
    const word = rest[0].value.toLowerCase()
    switch (word) {
      case 'and':
      case 'or': {
        const op = rest[0].value
        rest = rest.slice(1)
        const wherePartResult = parseWherePart(rest, tableName)
        rest = wherePartResult.rest
        where.next = { op, where: wherePartResult.where }
      }
    }
  }

  return { where, rest }
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
