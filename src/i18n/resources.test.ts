import { describe, expect, it } from 'vitest'
import { NAMESPACES, resources, SUPPORTED_LANGUAGES } from './resources'

type Tree = { [key: string]: string | Tree }

const PLURAL = /_(zero|one|two|few|many|other)$/

/** Flattens to "a.b.c" → value, folding plural variants (key_one, key_other) into one key. */
function flatten(tree: Tree, prefix = ''): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const [k, v] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${k}` : k
    if (typeof v === 'string') {
      const key = path.replace(PLURAL, '')
      out.set(key, [...(out.get(key) ?? []), v])
    } else {
      for (const [ck, cv] of flatten(v, path)) out.set(ck, cv)
    }
  }

  return out
}

const placeholders = (values: string[]) => [...new Set(values.flatMap((v) => [...v.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1])))].sort()
const tags = (values: string[]) => [...new Set(values.flatMap((v) => [...v.matchAll(/<(\w+)>/g)].map((m) => m[1])))].sort()

describe('locale resources', () => {
  for (const ns of NAMESPACES) {
    const source = flatten(resources.vi[ns] as Tree)

    for (const lng of SUPPORTED_LANGUAGES.filter((l) => l !== 'vi')) {
      const target = flatten(resources[lng][ns] as Tree)

      it(`${lng}/${ns} has exactly the keys of vi/${ns}`, () => {
        expect([...target.keys()].sort()).toEqual([...source.keys()].sort())
      })

      it(`${lng}/${ns} keeps every placeholder and tag`, () => {
        for (const [key, values] of source) {
          const other = target.get(key) ?? []
          expect(placeholders(other), `${ns}:${key}`).toEqual(placeholders(values))
          expect(tags(other), `${ns}:${key}`).toEqual(tags(values))
        }
      })
    }

    it(`vi/${ns} has no empty strings`, () => {
      for (const [key, values] of source) expect(values.every((v) => v.trim() !== ''), `${ns}:${key}`).toBe(true)
    })
  }
})
