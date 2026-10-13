import { describe, expect, it } from 'vitest'
import { ignoresPlayerShortcut, isTypingTarget } from './shortcut-target'

const inside = (matches: string[]) => (selector: string) => (matches.some((m) => selector.includes(m)) ? {} : null)

describe('player shortcut targets', () => {
  it('ignores keys typed into text fields', () => {
    expect(isTypingTarget({ tagName: 'INPUT', type: 'search' })).toBe(true)
    expect(isTypingTarget({ tagName: 'input' })).toBe(true)
    expect(isTypingTarget({ tagName: 'TEXTAREA' })).toBe(true)
    expect(isTypingTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true)
    expect(isTypingTarget({ tagName: 'INPUT', type: 'range' })).toBe(false)
    expect(isTypingTarget({ tagName: 'BUTTON' })).toBe(false)
    expect(isTypingTarget(null)).toBe(false)
  })

  it('leaves dialogs and menus outside the player alone', () => {
    expect(ignoresPlayerShortcut({ tagName: 'BUTTON', closest: inside(['role="dialog"']) })).toBe(true)
    expect(ignoresPlayerShortcut({ tagName: 'BUTTON', closest: inside(['role="dialog"', 'data-testid="player"']) })).toBe(false)
    expect(ignoresPlayerShortcut({ tagName: 'BUTTON', closest: inside([]) })).toBe(false)
  })
})
