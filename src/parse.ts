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

const wordRegex = /^[a-zA-Z_]+/
const symbols = Object.fromEntries('{}[]()?<>=:,'.split('').map(c => [c, true]))

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
      for (;;) {
        rest = rest.trim()
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
    table: Table
  }
  export type Table = {
    type: 'table'
    name: string
    alias?: string
    single: boolean
    join?: string
    fields: Field[]
  }
  export type Field = Column | Table
  export type Column = {
    type: 'column'
    name: string
    alias?: string
  }
}

export function parse(tokens: Token.Any[]): AST.Expression {
  if (tokens.length === 0) {
    throw new Error('empty tokens')
  }
  const token = tokens[0]
  if (token.type === 'word' && token.value === 'select') {
    return {
      type: 'select',
      table: parseTable(tokens.slice(1)),
    }
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
  let token = rest[0]
  if (token.type === 'word' && token.value === 'as') {
    rest = rest.slice(1)
    let aliasResult = parseWord(rest, `alias of table "${tableName}"`)
    rest = aliasResult.rest
    alias = aliasResult.value
  }

  const fieldResult = parseFields(rest, tableName)
  rest = fieldResult.rest
  const { single, fields } = fieldResult

  let table: AST.Table = { type: 'table', name: tableName, single, fields }
  if (alias) {
    table.alias = alias
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
      let table: AST.Table = {
        type: 'table',
        name: field.name,
        single: fieldsResult.single,
        fields: fieldsResult.fields,
      }
      if (field.alias) {
        table.alias = field.alias
      }
      fields.push(table)
      continue
    }

    throw new Error(
      `expected table fields, got token: ${JSON.stringify(token)}`,
    )
  }

  return { single, fields, rest }
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
