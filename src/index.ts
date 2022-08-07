import { generateSQL } from './code-gen'
import { decode } from './parse'

export function queryToSQL(query: string): string {
  const ast = decode(query)
  const sql = generateSQL(ast)
  return sql.trim()
}
