import { AST } from './parse'

export function generateSQL(ast: AST.Select): string {
  const table = ast.table
  const selectFields: string[] = []

  let fromSQL = 'from ' + nameToSQL(table)

  function processTable(table: AST.Table) {
    const tableName = table.alias || table.name
    table.fields.forEach(field => {
      if (field.type === 'column') {
        selectFields.push(tableName + '.' + nameToSQL(field))
      } else if (field.type === 'table') {
        processTable(field)
        const subTable = nameToSQL(field)
        const subTableName = field.alias || field.name
        fromSQL += `
inner join ${subTable} on ${subTableName}.id = ${tableName}.${subTableName}_id`
      }
    })
  }

  processTable(table)

  const selectSQL = '  ' + selectFields.join('\n, ')

  let sql = `
select
${selectSQL}
${fromSQL}
`
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
