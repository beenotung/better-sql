declare var noscriptMsg: HTMLDivElement

declare var queryInput: HTMLTextAreaElement
declare var sqlOutput: HTMLTextAreaElement

declare var querySpace: HTMLDivElement
declare var sqlSpace: HTMLDivElement

queryInput.addEventListener('input', updateQuery)

queryInput.addEventListener('keypress', checkBracket)
queryInput.addEventListener('keypress', checkEnter)

let brackets: Record<string, string> = {
  '[': ']',
  '{': '}',
  '(': ')',
}

function checkBracket(event: KeyboardEvent) {
  let open = event.key
  let close = brackets[open]
  if (!close) return
  let start = queryInput.selectionStart
  let end = queryInput.selectionEnd
  if (start !== end) return
  let text = queryInput.value
  let before = text.slice(0, start)
  let after = text.slice(start)
  text = before + open + close + after
  queryInput.value = text
  queryInput.selectionStart = start + 1
  queryInput.selectionEnd = end + 1
  event.preventDefault()
  updateQuery()
}

function checkEnter(event: KeyboardEvent) {
  if (event.key !== 'Enter') return

  let start = queryInput.selectionStart
  let end = queryInput.selectionEnd
  if (start !== end) return

  let text = queryInput.value
  let before = text.slice(0, start)

  let open = before[before.length - 1]
  let isOpen = open in brackets

  let after = text.slice(start)
  let lastLine = before.split('\n').pop() || ''
  let indent = lastLine.match(/ */)?.[0] || ''
  let outerIndent = indent
  if (isOpen) {
    indent += '  '
  }

  text = before + '\r\n' + indent
  if (isOpen) {
    text += '\r\n' + outerIndent
  }
  text += after

  queryInput.value = text
  queryInput.selectionStart = start + 1 + indent.length
  queryInput.selectionEnd = end + 1 + indent.length
  event.preventDefault()

  updateQuery()
}

function updateTextAreaHeight() {
  calcHeight(queryInput, querySpace)
  calcHeight(sqlOutput, sqlSpace)
}

function calcHeight(textarea: HTMLTextAreaElement, space: HTMLDivElement) {
  space.textContent = textarea.value
  let style = getComputedStyle(textarea)
  space.style.fontSize = style.fontSize
  space.style.fontFamily = style.fontFamily
  textarea.style.minHeight = space.getBoundingClientRect().height + 'px'
}

function updateQuery() {
  sqlOutput.value = queryInput.value
  updateTextAreaHeight()
}

let sampleQuery = /* sql */ `
select post [
  id as post_id
  title
  author_id
  user as author {
    nickname
    avatar
  } where delete_time is null
  type_id
  post_type { name as type }
] where created_at >= :since and delete_time is null
`.trim()

if (queryInput.value === '') {
  queryInput.value = sampleQuery
}
updateQuery()

noscriptMsg.remove()
