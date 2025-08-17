/**
 * Centralized query configuration for GraphQL pagination limits
 * 
 * All query limits should be defined here to ensure consistency
 * and easy management across the application.
 */

export const QUERY_LIMITS = {
  // Standard pagination batch size for large datasets
  STANDARD_BATCH_SIZE: 1000,
  
  // Specific limits for different data types
  ADDRESSES_BATCH_SIZE: 1000,
  RESIDENTS_BATCH_SIZE: 1000,
  CONSENTS_BATCH_SIZE: 1000,
  INTERACTION_RECORDS_BATCH_SIZE: 1000,
  ASSIGNMENTS_BATCH_SIZE: 1000,
  
  // Small dataset limits (single query, no pagination needed)
  VOLUNTEERS_LIMIT: 200,           // Usually < 50 volunteers
  REGISTRATIONS_LIMIT: 500,        // New member registrations
  USER_PROFILES_LIMIT: 500,        // Admin/user accounts
  
  // Search and display limits
  SEARCH_BATCH_SIZE: 200,          // For search results pagination
  DISPLAY_PAGE_SIZE: 50,           // For UI pagination
  
  // Legacy/temporary limits (to be phased out)
  LEGACY_LIMIT: 5000,              // Old hardcoded limit - DO NOT USE
} as const

/**
 * Helper function to create paginated query configuration
 */
export function createPaginationConfig(limit: number, nextToken?: string | null) {
  return {
    limit,
    ...(nextToken && { nextToken })
  }
}

/**
 * Helper function to load all records with pagination
 * Generic pagination handler that can be used for any model
 */
export async function loadAllRecords<T>(
  queryFn: (config: { limit: number; nextToken?: string | null }) => Promise<{
    data: T[]
    nextToken?: string | null
  }>,
  batchSize: number = QUERY_LIMITS.STANDARD_BATCH_SIZE
): Promise<T[]> {
  const allRecords: T[] = []
  let nextToken: string | null = null
  
  do {
    const result = await queryFn(createPaginationConfig(batchSize, nextToken))
    allRecords.push(...result.data)
    nextToken = result.nextToken || null
  } while (nextToken)
  
  return allRecords
}

/**
 * Predefined query configurations for common use cases
 */
export const QUERY_CONFIGS = {
  addresses: () => createPaginationConfig(QUERY_LIMITS.ADDRESSES_BATCH_SIZE),
  residents: () => createPaginationConfig(QUERY_LIMITS.RESIDENTS_BATCH_SIZE),
  consents: () => createPaginationConfig(QUERY_LIMITS.CONSENTS_BATCH_SIZE),
  interactions: () => createPaginationConfig(QUERY_LIMITS.INTERACTION_RECORDS_BATCH_SIZE),
  assignments: () => createPaginationConfig(QUERY_LIMITS.ASSIGNMENTS_BATCH_SIZE),
  volunteers: () => createPaginationConfig(QUERY_LIMITS.VOLUNTEERS_LIMIT),
  registrations: () => createPaginationConfig(QUERY_LIMITS.REGISTRATIONS_LIMIT),
  userProfiles: () => createPaginationConfig(QUERY_LIMITS.USER_PROFILES_LIMIT),
} as const