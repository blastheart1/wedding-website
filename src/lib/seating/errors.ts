/** A request the seat plan refuses, with a message that is safe to show and the HTTP status to answer with. */
export class SeatingError extends Error {
  readonly status: number

  constructor(message: string, status = 409) {
    super(message)
    this.name = 'SeatingError'
    this.status = status
  }
}

export const SEATING_NOT_READY = 'The seat plan needs a database update before it can be used. Ask for the seating migration to be applied.'

const codeOf = (error: unknown): string | undefined =>
  typeof error === 'object' && error !== null ? (error as { code?: string }).code : undefined

/** PostgreSQL "relation does not exist": the seating migration has not been applied yet. */
export const isMissingTable = (error: unknown): boolean => codeOf(error) === '42P01'

/** PostgreSQL unique violation: two people saved a change to the same seat at once. */
export const isUniqueViolation = (error: unknown): boolean => codeOf(error) === '23505'

/** PostgreSQL foreign key violation: the table or invitation was removed in the meantime. */
export const isMissingReference = (error: unknown): boolean => codeOf(error) === '23503'
