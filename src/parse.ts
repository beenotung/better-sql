export function decode(text: string) {
  let tokens = tokenize(text)
  let root = parse(tokens)
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

let wordRegex = /^[a-zA-Z_]+/
let symbols = Object.fromEntries('{}[]()?<>=:'.split('').map(c => [c, true]))

export function tokenize(text: string): Token.Any[] {
  let tokens: Token.Any[] = []
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
        let char = rest[0]
        if (!char) return
        if (char in symbols) {
          rest = rest.slice(1)
          tokens.push({ type: 'symbol', value: char })
          continue
        }
        let match = rest.match(wordRegex)
        if (match) {
          let value = match[0]
          rest = rest.slice(value.length + 1)
          tokens.push({ type: 'word', value })
          continue
        }
        console.error('unknown token:', { char, rest })
        throw new Error('unknown token: ' + JSON.stringify(char))
      }
    })
  return tokens.slice(1)
}

export function parse(tokens: Token.Any[]): AST.Expression {
  if (tokens.length === 0) {
    throw new Error('empty tokens')
  }
  let token = tokens[0]
  if (token.type === 'word' && token.value === 'select') {
    return {
      type: 'select',
      table: parseTable(tokens.slice(1)),
    }
  }
  throw new Error('missing "select" token')
}

function parseTable(tokens: Token.Any[]): AST.Table {
  let name: string
  let rest = tokens
  for (;;) {
    if (rest.length == 0) {
      throw new Error('missing table name')
    }
    let token = rest[0]
    if (token.type === 'newline') {
      rest = rest.slice(1)
      continue
    }
    if (token.type === 'word') {
      name = token.value
      break
    }
    throw new Error('expect table name, got: ' + JSON.stringify(token))
  }

  let fields: AST.Field[] = []
  // for (;;) {}

  return { type: 'table', name, fields }
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
    fields: Field[]
  }
  export type Field = Column | Table
  export type Column = {
    type: 'column'
    name: string
    alias: string | null
  }
}

function parseSelect(text: string) {}

function parseWord(text: string) {}
