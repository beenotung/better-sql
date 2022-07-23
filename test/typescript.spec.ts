import { expect } from 'chai'

describe('ts-mocha setup', () => {
  it('should be able to compile', () => {
    let a: number = 1
    let b: number = 2
    let c: number = a + b
    expect(c).to.equals(3)
  })
})
