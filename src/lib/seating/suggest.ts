import type { Person } from './people'

/** Finding guests by typed name, for seating someone from inside a table's sheet. Pure. */

const fold = (text: string): string => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/** Lower is better; null means no match. Exact name, then start of the name, then start of any word, then anywhere. */
function rank(person: Person, needle: string): number | null {
  const names = [person.name, person.name.split(' · ')[0], person.shortName].map(fold)
  if (names.includes(needle)) return 0
  if (names.some(name => name.startsWith(needle))) return 1
  if (names.some(name => name.split(/[\s·']+/).some(word => word.startsWith(needle)))) return 2
  return names.some(name => name.includes(needle)) ? 3 : null
}

/** The people a typed fragment could mean, best first. Order within a rank follows the list given. */
export function suggestPeople(query: string, people: readonly Person[], limit = 6): Person[] {
  const needle = fold(query)
  if (!needle) return []
  return people
    .map((person, order) => ({ person, order, score: rank(person, needle) }))
    .filter((entry): entry is { person: Person; order: number; score: number } => entry.score !== null)
    .sort((a, b) => a.score - b.score || a.order - b.order)
    .slice(0, limit)
    .map(entry => entry.person)
}

/**
 * Splits typed or pasted text on commas and new lines. Every piece before the
 * last separator is finished; what follows it is still being typed.
 */
export function splitNames(text: string): { finished: string[]; typing: string } {
  const pieces = text.split(/[,\n]/)
  const typing = pieces.pop() ?? ''
  return { finished: pieces.map(piece => piece.trim()).filter(Boolean), typing: typing.replace(/^\s+/, '') }
}
