import Header from '../../components/Header'
import {useEffect, useState} from 'react'
import {generateClient} from 'aws-amplify/data'
import type {Schema} from '../../../amplify/data/resource'
import { useLocation, useNavigate } from 'react-router-dom'
import {fetchAuthSession} from 'aws-amplify/auth'
import {CognitoIdentityProviderClient, ListUsersCommand, AdminListGroupsForUserCommand} from '@aws-sdk/client-cognito-identity-provider'

export default function Organize() {
    const location = useLocation()
    const navigate = useNavigate()
    
    const [homes, setHomes] = useState<any[]>([])
    const [volunteers, setVolunteers] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedHomes, setSelectedHomes] = useState<Set<string>>(new Set())
    const [assignToVolunteer, setAssignToVolunteer] = useState('')
    
    // Initialize filter state from URL params
    const initializeFiltersFromURL = () => {
        const params = new URLSearchParams(location.search)
        return {
            searchTerm: params.get('address') || '',
            residentFilter: params.get('resident') || '',
            statusFilter: params.get('status') || 'all',
            assignmentFilter: params.get('assignment') || 'all',
            page: parseInt(params.get('page') || '1')
        }
    }
    
    // Filter state
    const [searchTerm, setSearchTerm] = useState(() => initializeFiltersFromURL().searchTerm)
    const [residentFilter, setResidentFilter] = useState(() => initializeFiltersFromURL().residentFilter)
    const [statusFilter, setStatusFilter] = useState(() => initializeFiltersFromURL().statusFilter)
    const [assignmentFilter, setAssignmentFilter] = useState(() => initializeFiltersFromURL().assignmentFilter)
    
    // Pagination state
    const [currentPage, setCurrentPage] = useState(() => initializeFiltersFromURL().page)
    const [totalCount, setTotalCount] = useState(0)
    const [nextToken, setNextToken] = useState<string | null>(null)
    const [previousTokens, setPreviousTokens] = useState<string[]>([])
    const pageSize = 50
    
    // Update URL when filters change
    const updateURL = (updates: Partial<{
        address: string
        resident: string
        status: string
        assignment: string
        page: number
    }>) => {
        const params = new URLSearchParams(location.search)
        
        // Update params
        Object.entries(updates).forEach(([key, value]) => {
            // Only set params if they have meaningful values
            // Empty strings, 'all', 1 (default page), null, undefined should be removed
            if (value && value !== '' && value !== 'all' && value !== 1) {
                params.set(key, value.toString())
            } else {
                params.delete(key)
            }
        })
        
        // Navigate to new URL
        const newSearch = params.toString()
        const newPath = newSearch ? `${location.pathname}?${newSearch}` : location.pathname
        navigate(newPath, { replace: true })
    }
    
    // Sorting state
    const [sortField, setSortField] = useState('street')
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

    const client = generateClient<Schema>()  // Use default auth (userPool) instead of apiKey

    useEffect(() => {
        // Clean up empty filters on mount
        const params = new URLSearchParams(location.search)
        let hasChanges = false
        
        if (params.get('address') === '') {
            params.delete('address')
            hasChanges = true
        }
        if (params.get('resident') === '') {
            params.delete('resident')
            hasChanges = true
        }
        
        if (hasChanges) {
            const newSearch = params.toString()
            const newPath = newSearch ? `${location.pathname}?${newSearch}` : location.pathname
            navigate(newPath, { replace: true })
        }
        
        loadData()
    }, [currentPage, sortField, sortDirection])
    
    // Get appropriate nextToken for current page
    function getNextTokenForPage() {
        if (currentPage === 1) return null
        return previousTokens[currentPage - 2] || null
    }

    async function loadData() {
        try {
            setLoading(true)
            
            // Build filter for homes - temporarily remove absentee filter for debugging
            let homeFilter: any = undefined // { absenteeOwner: { ne: true } }
            
            // Add search filter if applied - only if there's actual content
            const trimmedSearch = searchTerm.trim()
            if (trimmedSearch) {
                homeFilter = {
                    or: [
                        { street: { contains: trimmedSearch } },
                        { city: { contains: trimmedSearch } }
                    ]
                }
            }
            
            let homesWithDetails: any[] = []
            
            if (searchTerm.trim() || residentFilter.trim()) {
                // When searching, search ALL homes first, then add resident info
                console.log(`Searching for address: "${searchTerm.trim()}" and resident: "${residentFilter.trim()}"`)
                
                let searchResults: any[] = []
                let nextToken = null
                let searchCount = 0
                
                // Get ALL people first for resident filtering
                let allPeople: any[] = []
                let peopleNextToken = null
                
                do {
                    const peopleResult = await client.models.Person.list({ 
                        limit: 1000,
                        nextToken: peopleNextToken
                    })
                    allPeople.push(...peopleResult.data)
                    peopleNextToken = peopleResult.nextToken
                } while (peopleNextToken)
                
                // Find homes that match resident filter
                let residentMatchingHomeIds: Set<string> = new Set()
                if (residentFilter.trim()) {
                    const residentFilterLower = residentFilter.toLowerCase()
                    const matchingPeople = allPeople.filter(person => 
                        (person.firstName?.toLowerCase().includes(residentFilterLower)) ||
                        (person.lastName?.toLowerCase().includes(residentFilterLower)) ||
                        (`${person.firstName} ${person.lastName}`.toLowerCase().includes(residentFilterLower))
                    )
                    residentMatchingHomeIds = new Set(matchingPeople.map(p => p.homeId))
                    console.log(`Found ${matchingPeople.length} people matching "${residentFilter}" in ${residentMatchingHomeIds.size} homes`)
                }
                
                // Search through homes without GraphQL filter (do client-side filtering)
                do {
                    const result = await client.models.Home.list({
                        limit: 200,
                        nextToken
                    })
                    
                    for (const home of result.data) {
                        let matches = true
                        
                        // Apply address filter only if searchTerm has content
                        if (searchTerm.trim()) {
                            if (!home.street?.toLowerCase().includes(searchTerm.trim().toLowerCase())) {
                                matches = false
                            }
                        }
                        
                        // Apply resident filter only if residentFilter has content
                        if (residentFilter.trim()) {
                            if (!residentMatchingHomeIds.has(home.id)) {
                                matches = false
                            }
                        }
                        
                        if (matches) {
                            searchResults.push(home)
                        }
                    }
                    
                    nextToken = result.nextToken
                    searchCount += result.data.length
                } while (nextToken && searchResults.length < 500)
                
                console.log(`Searched ${searchCount} homes, found ${searchResults.length} matches`)
                
                // Remove duplicates from search results (by address, not just home ID)
                const uniqueSearchResults = searchResults.filter((home, index, self) => {
                    const address = `${home.street?.toLowerCase().trim()}, ${home.city?.toLowerCase().trim()}`
                    return index === self.findIndex(h => {
                        const hAddress = `${h.street?.toLowerCase().trim()}, ${h.city?.toLowerCase().trim()}`
                        return hAddress === address
                    })
                })
                console.log(`After removing address duplicates: ${uniqueSearchResults.length} unique homes (from ${searchResults.length} total results)`)
                
                // For pagination on search results
                const startIndex = (currentPage - 1) * pageSize
                const endIndex = startIndex + pageSize
                const currentPageHomes = uniqueSearchResults.slice(startIndex, endIndex)
                
                // Use the already loaded people data
                console.log(`Loaded ${allPeople.length} total people for search`)
                const allPeopleResult = { data: allPeople }
                
                // Load details for search results
                const searchDetailsPromises = currentPageHomes.map(async (home) => {
                    try {
                        // For this address, get residents from ALL matching home records (to handle DB duplicates)
                        const homeAddress = `${home.street?.toLowerCase().trim()}, ${home.city?.toLowerCase().trim()}`
                        
                        // Find all home IDs with the same address
                        const sameAddressHomeIds = searchResults
                            .filter(h => {
                                const hAddress = `${h.street?.toLowerCase().trim()}, ${h.city?.toLowerCase().trim()}`
                                return hAddress === homeAddress
                            })
                            .map(h => h.id)
                        
                        console.log(`Address "${home.street}" has ${sameAddressHomeIds.length} home records in DB`)
                        
                        // Get residents from all home records with this address
                        const allResidentsForAddress = allPeopleResult.data
                            .filter(p => sameAddressHomeIds.includes(p.homeId))
                        
                        // Remove duplicate residents (same name at same address)
                        const uniqueResidents = allResidentsForAddress.filter((person, index, self) => {
                            return index === self.findIndex(p => 
                                p.firstName === person.firstName && 
                                p.lastName === person.lastName
                            )
                        })
                        
                        // Sort residents (PRIMARY_OWNER first)
                        const residents = uniqueResidents.sort((a, b) => {
                            const roleOrder = { 'PRIMARY_OWNER': 1, 'SECONDARY_OWNER': 2, 'RENTER': 3, 'OTHER': 4 }
                            const aOrder = roleOrder[a.role] || 5
                            const bOrder = roleOrder[b.role] || 5
                            return aOrder - bOrder
                        })
                        
                        console.log(`Address "${home.street}": ${allResidentsForAddress.length} total residents, ${residents.length} unique residents`)
                        
                        // Get consents and assignments from all home records with this address
                        const consentsPromises = sameAddressHomeIds.map(homeId => 
                            client.models.Consent.list({ filter: { homeId: { eq: homeId } } })
                        )
                        const assignmentsPromises = sameAddressHomeIds.map(homeId => 
                            client.models.Assignment.list({ filter: { homeId: { eq: homeId } } })
                        )
                        
                        const [allConsentsResults, allAssignmentsResults] = await Promise.all([
                            Promise.all(consentsPromises),
                            Promise.all(assignmentsPromises)
                        ])
                        
                        // Combine and deduplicate consents and assignments
                        const allConsents = allConsentsResults.flatMap(result => result.data)
                        const allAssignments = allAssignmentsResults.flatMap(result => result.data)
                        
                        const consents = allConsents.filter((consent, index, self) => 
                            index === self.findIndex(c => c.id === consent.id)
                        )
                        const assignments = allAssignments
                            .filter(a => a.status !== 'DONE')
                            .filter((assignment, index, self) => 
                                index === self.findIndex(a => a.id === assignment.id)
                            )
                        
                        // Determine consent status
                        const allOwnersSigned = residents.length > 0 && 
                            residents.every(resident => resident.hasSigned)
                        
                        return { 
                            ...home, 
                            residents, 
                            consents,
                            assignments,
                            consentStatus: allOwnersSigned ? 'complete' : 'incomplete'
                        }
                    } catch (error) {
                        console.error(`Error loading home details:`, error)
                        return null
                    }
                })
                
                const searchDetailsResults = await Promise.all(searchDetailsPromises)
                homesWithDetails = searchDetailsResults.filter(home => home !== null)
                
                console.log(`Search processing complete: ${homesWithDetails.length} homes with details`)
                
                // Check for duplicates in search results
                const searchIds = homesWithDetails.map(h => h.id)
                const uniqueSearchIds = [...new Set(searchIds)]
                if (searchIds.length !== uniqueSearchIds.length) {
                    console.log(`⚠️ Found ${searchIds.length - uniqueSearchIds.length} duplicate homes in search details`)
                }
                
                // Update pagination for search results
                setTotalCount(uniqueSearchResults.length)
                const hasMorePages = endIndex < uniqueSearchResults.length
                setNextToken(hasMorePages ? 'more' : null)
                console.log(`Search mode: found ${uniqueSearchResults.length} total matches, showing page ${currentPage}`)
                
            } else {
                // No search - use original logic (homes with residents only)
                console.log('Finding homes with residents for Organize page...')
                
                // Get ALL people first (handle pagination)
                let allPeople: any[] = []
                let peopleNextToken = null
                
                do {
                    const peopleResult = await client.models.Person.list({ 
                        limit: 1000,
                        nextToken: peopleNextToken
                    })
                    allPeople.push(...peopleResult.data)
                    peopleNextToken = peopleResult.nextToken
                } while (peopleNextToken)
                
                console.log(`Found ${allPeople.length} people total`)
                const allPeopleResult = { data: allPeople }
                
                // Get unique homeIds that have residents
                const homeIdsWithResidents = [...new Set(allPeopleResult.data.map(p => p.homeId))]
                console.log(`Found ${homeIdsWithResidents.length} unique homes with residents`)
                
                // For pagination, slice the homeIds
                const startIndex = (currentPage - 1) * pageSize
                const endIndex = startIndex + pageSize
                const currentPageHomeIds = homeIdsWithResidents.slice(startIndex, endIndex)
                
                console.log(`Page ${currentPage}: showing homes ${startIndex + 1}-${Math.min(endIndex, homeIdsWithResidents.length)} of ${homeIdsWithResidents.length}`)
                
                // Get home details for current page
                const homesWithDetailsPromises = currentPageHomeIds.map(async (homeId) => {
                    try {
                        const homeResult = await client.models.Home.get({ id: homeId })
                        if (homeResult.data) {
                            const home = homeResult.data
                            
                            // Get residents for this home and sort them (PRIMARY_OWNER first)
                            const residents = allPeopleResult.data
                                .filter(p => p.homeId === homeId)
                                .sort((a, b) => {
                                    // PRIMARY_OWNER first, then SECONDARY_OWNER, then others
                                    const roleOrder = { 'PRIMARY_OWNER': 1, 'SECONDARY_OWNER': 2, 'RENTER': 3, 'OTHER': 4 }
                                    const aOrder = roleOrder[a.role] || 5
                                    const bOrder = roleOrder[b.role] || 5
                                    return aOrder - bOrder
                                })
                            
                            // Get consents and assignments
                            const [consentsResult, assignmentsResult] = await Promise.all([
                                client.models.Consent.list({ filter: { homeId: { eq: home.id } } }),
                                client.models.Assignment.list({ filter: { homeId: { eq: home.id } } })
                            ])
                            
                            const consents = consentsResult.data
                            const assignments = assignmentsResult.data.filter(a => a.status !== 'DONE')
                            
                            // Determine consent status
                            const allOwnersSigned = residents.length > 0 && 
                                residents.every(resident => resident.hasSigned)
                            
                            return { 
                                ...home, 
                                residents, 
                                consents,
                                assignments,
                                consentStatus: allOwnersSigned ? 'complete' : 'incomplete'
                            }
                        }
                    } catch (error) {
                        console.error(`Error loading home ${homeId}:`, error)
                    }
                    return null
                })
                
                const allHomesWithDetails = await Promise.all(homesWithDetailsPromises)
                homesWithDetails = allHomesWithDetails.filter(home => home !== null)
                
                console.log(`Loaded ${homesWithDetails.length} homes with residents for page ${currentPage}`)
                
                // Update pagination info  
                setTotalCount(homeIdsWithResidents.length)
                const hasMorePages = endIndex < homeIdsWithResidents.length
                setNextToken(hasMorePages ? 'more' : null)
                console.log(`Browse mode: ${homeIdsWithResidents.length} total homes with residents, showing page ${currentPage} (${homesWithDetails.length} homes)`)
            }
            
            // Apply additional filters that can't be done at DB level
            let filteredData = homesWithDetails
            
            if (statusFilter !== 'all') {
                filteredData = filteredData.filter(home => home.consentStatus === statusFilter)
            }
            
            if (assignmentFilter !== 'all') {
                if (assignmentFilter === 'assigned') {
                    filteredData = filteredData.filter(home => home.assignments.length > 0)
                } else if (assignmentFilter === 'unassigned') {
                    filteredData = filteredData.filter(home => home.assignments.length === 0)
                }
            }
            
            // Apply sorting
            filteredData.sort((a, b) => {
                let aVal: any, bVal: any
                
                switch (sortField) {
                    case 'street':
                        aVal = a.street || ''
                        bVal = b.street || ''
                        break
                    case 'city':
                        aVal = a.city || ''
                        bVal = b.city || ''
                        break
                    case 'consentStatus':
                        aVal = a.consentStatus
                        bVal = b.consentStatus
                        break
                    default:
                        aVal = a.street || ''
                        bVal = b.street || ''
                }
                
                if (typeof aVal === 'string') {
                    const comparison = aVal.toLowerCase().localeCompare(bVal.toLowerCase())
                    return sortDirection === 'asc' ? comparison : -comparison
                }
                
                if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
                if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
                return 0
            })
            
            // Final check for duplicates before setting state (by address, not just ID)
            const finalUniqueHomes = filteredData.filter((home, index, self) => {
                const address = `${home.street?.toLowerCase().trim()}, ${home.city?.toLowerCase().trim()}`
                return index === self.findIndex(h => {
                    const hAddress = `${h.street?.toLowerCase().trim()}, ${h.city?.toLowerCase().trim()}`
                    return hAddress === address
                })
            })
            
            if (filteredData.length !== finalUniqueHomes.length) {
                console.log(`⚠️ Removed ${filteredData.length - finalUniqueHomes.length} duplicate addresses before setting state`)
            }
            
            console.log(`Final: setting ${finalUniqueHomes.length} homes, totalCount should be ${totalCount}`)
            setHomes(finalUniqueHomes)
            
            // Load volunteers and eligible users
            if (volunteers.length === 0) {
                try {
                    // First, load existing Volunteer records
                    const existingVolunteers = await client.models.Volunteer.list()
                    const volunteerMap = new Map()
                    
                    // Add existing volunteers to map
                    existingVolunteers.data.forEach(v => {
                        volunteerMap.set(v.userSub, {
                            id: v.id,  // This is the Volunteer model ID
                            userSub: v.userSub,
                            email: v.email,
                            displayName: v.displayName || v.email,
                            role: 'Volunteer'
                        })
                    })
                    
                    // Then load users from Cognito who can be assigned work
                    const session = await fetchAuthSession()
                    const cognitoClient = new CognitoIdentityProviderClient({
                        region: 'us-east-1',
                        credentials: session.credentials
                    })
                    
                    const userPoolId = 'us-east-1_GrxwbZK9I'
                    
                    // Get all users from Cognito
                    const listUsersResult = await cognitoClient.send(new ListUsersCommand({
                        UserPoolId: userPoolId,
                        Limit: 60
                    }))
                    
                    // Filter users who are in relevant groups
                    for (const user of listUsersResult.Users || []) {
                        const email = user.Attributes?.find(attr => attr.Name === 'email')?.Value
                        const firstName = user.Attributes?.find(attr => attr.Name === 'given_name')?.Value
                        const lastName = user.Attributes?.find(attr => attr.Name === 'family_name')?.Value
                        
                        // Get user's groups
                        try {
                            const groupsResult = await cognitoClient.send(new AdminListGroupsForUserCommand({
                                UserPoolId: userPoolId,
                                Username: user.Username!
                            }))
                            
                            const groups = groupsResult.Groups?.map(g => g.GroupName!) || []
                            
                            // Check if user is in any of the relevant groups
                            if (groups.includes('Administrator') || groups.includes('Organizer') || groups.includes('Canvasser')) {
                                const displayName = `${firstName || ''} ${lastName || ''}`.trim() || email
                                const role = groups.includes('Administrator') ? 'Administrator' : 
                                           groups.includes('Organizer') ? 'Organizer' : 'Canvasser'
                                
                                // Check if this user already has a Volunteer record
                                const existing = volunteerMap.get(user.Username)
                                if (existing) {
                                    // Update with latest info from Cognito
                                    existing.displayName = displayName
                                    existing.email = email
                                    existing.role = role
                                } else {
                                    // Add as potential volunteer (will create Volunteer record when assigned)
                                    volunteerMap.set(user.Username, {
                                        id: user.Username,  // Use Username as ID for now
                                        userSub: user.Username,
                                        email: email,
                                        displayName: displayName,
                                        role: role
                                    })
                                }
                            }
                        } catch (error) {
                            console.error(`Failed to get groups for user ${email}:`, error)
                        }
                    }
                    
                    const allVolunteers = Array.from(volunteerMap.values())
                    console.log(`Found ${allVolunteers.length} volunteers/eligible users`)
                    setVolunteers(allVolunteers)
                } catch (error) {
                    console.error('Failed to load volunteers:', error)
                }
            }
            
        } catch (error) {
            console.error('Failed to load data:', error)
        } finally {
            setLoading(false)
        }
    }
    
    function applyFilters() {
        setCurrentPage(1) // Reset to first page when filters change
        setSelectedHomes(new Set()) // Clear selections
        setPreviousTokens([]) // Clear pagination tokens
        setNextToken(null)
        
        // Update URL with current filters
        updateURL({
            address: searchTerm,
            resident: residentFilter,
            status: statusFilter,
            assignment: assignmentFilter,
            page: 1
        })
        
        loadData()
    }
    
    async function clearFilters() {
        // Clear all filter state
        setSearchTerm('')
        setResidentFilter('')
        setStatusFilter('all')
        setAssignmentFilter('all')
        setCurrentPage(1)
        setSelectedHomes(new Set())
        setPreviousTokens([])
        setNextToken(null)
        
        // Clear URL params
        navigate(location.pathname, { replace: true })
        
        // Manually reload data with cleared filters
        try {
            setLoading(true)
            
            // Get ALL people first (handle pagination)
            let allPeople: any[] = []
            let peopleNextToken = null
            
            do {
                const peopleResult = await client.models.Person.list({ 
                    limit: 1000,
                    nextToken: peopleNextToken
                })
                allPeople.push(...peopleResult.data)
                peopleNextToken = peopleResult.nextToken
            } while (peopleNextToken)
            
            console.log(`Found ${allPeople.length} people total`)
            
            // Get unique homeIds that have residents
            const homeIdsWithResidents = [...new Set(allPeople.map(p => p.homeId))]
            console.log(`Found ${homeIdsWithResidents.length} unique homes with residents`)
            
            // For pagination, slice the homeIds (page 1, no filters)
            const startIndex = 0 // First page
            const endIndex = pageSize
            const currentPageHomeIds = homeIdsWithResidents.slice(startIndex, endIndex)
            
            console.log(`Page 1: showing homes 1-${Math.min(endIndex, homeIdsWithResidents.length)} of ${homeIdsWithResidents.length}`)
            
            // Get home details for current page
            const homesWithDetailsPromises = currentPageHomeIds.map(async (homeId) => {
                try {
                    const homeResult = await client.models.Home.get({ id: homeId })
                    if (homeResult.data) {
                        const home = homeResult.data
                        
                        // Get residents for this home and sort them (PRIMARY_OWNER first)
                        const residents = allPeople
                            .filter(p => p.homeId === homeId)
                            .sort((a, b) => {
                                const roleOrder = { 'PRIMARY_OWNER': 1, 'SECONDARY_OWNER': 2, 'RENTER': 3, 'OTHER': 4 }
                                const aOrder = roleOrder[a.role] || 5
                                const bOrder = roleOrder[b.role] || 5
                                return aOrder - bOrder
                            })
                        
                        // Get consents and assignments
                        const [consentsResult, assignmentsResult] = await Promise.all([
                            client.models.Consent.list({ filter: { homeId: { eq: home.id } } }),
                            client.models.Assignment.list({ filter: { homeId: { eq: home.id } } })
                        ])
                        
                        const consents = consentsResult.data
                        const assignments = assignmentsResult.data.filter(a => a.status !== 'DONE')
                        
                        // Determine consent status
                        const allOwnersSigned = residents.length > 0 && 
                            residents.every(resident => resident.hasSigned)
                        
                        return { 
                            ...home, 
                            residents, 
                            consents,
                            assignments,
                            consentStatus: allOwnersSigned ? 'complete' : 'incomplete'
                        }
                    }
                } catch (error) {
                    console.error(`Error loading home ${homeId}:`, error)
                }
                return null
            })
            
            const allHomesWithDetails = await Promise.all(homesWithDetailsPromises)
            const homesWithDetails = allHomesWithDetails.filter(home => home !== null)
            
            console.log(`Loaded ${homesWithDetails.length} homes with residents for page 1 (cleared filters)`)
            
            // Update pagination info  
            setTotalCount(homeIdsWithResidents.length)
            const hasMorePages = endIndex < homeIdsWithResidents.length
            setNextToken(hasMorePages ? 'more' : null)
            
            setHomes(homesWithDetails)
            
        } catch (error) {
            console.error('Failed to reload data after clearing filters:', error)
        } finally {
            setLoading(false)
        }
    }
    
    function handleSort(field: string) {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortDirection('asc')
        }
    }

    function toggleHomeSelection(homeId: string) {
        const newSelected = new Set(selectedHomes)
        if (newSelected.has(homeId)) {
            newSelected.delete(homeId)
        } else {
            newSelected.add(homeId)
        }
        setSelectedHomes(newSelected)
    }

    function selectAll() {
        const allIds = new Set(homes.map(home => home.id))
        setSelectedHomes(allIds)
    }

    function clearSelection() {
        setSelectedHomes(new Set())
    }

    async function unassignSelectedHomes() {
        if (selectedHomes.size === 0) {
            alert('Please select homes to unassign')
            return
        }

        if (!confirm(`Are you sure you want to unassign ${selectedHomes.size} homes?`)) {
            return
        }

        try {
            // For each selected home, find and delete its assignments
            const deletePromises = []
            const assignmentIdsToDelete = new Set<string>()
            
            for (const homeId of selectedHomes) {
                const home = homes.find(h => h.id === homeId)
                if (home && home.assignments) {
                    for (const assignment of home.assignments) {
                        assignmentIdsToDelete.add(assignment.id)
                        deletePromises.push(
                            client.models.Assignment.delete({ id: assignment.id })
                        )
                    }
                }
            }

            if (deletePromises.length === 0) {
                alert('No assignments found for selected homes')
                return
            }

            await Promise.all(deletePromises)

            // Update homes state to remove assignments without reloading
            setHomes(prevHomes => 
                prevHomes.map(home => {
                    if (selectedHomes.has(home.id)) {
                        // Remove assignments for this home
                        return {
                            ...home,
                            assignments: home.assignments?.filter(
                                a => !assignmentIdsToDelete.has(a.id)
                            ) || []
                        }
                    }
                    return home
                })
            )

            alert(`Unassigned ${selectedHomes.size} homes successfully`)
            setSelectedHomes(new Set())
            // Don't call loadData() - we've updated the state directly
        } catch (error) {
            console.error('Failed to unassign homes:', error)
            alert('Failed to unassign homes')
        }
    }

    async function assignSelectedHomes() {
        if (!assignToVolunteer || selectedHomes.size === 0) {
            alert('Please select homes and a volunteer')
            return
        }

        try {
            // First, ensure the volunteer exists in the Volunteer model
            const selectedVolunteer = volunteers.find(v => v.id === assignToVolunteer)
            if (!selectedVolunteer) {
                alert('Selected volunteer not found')
                return
            }
            
            // Check if Volunteer record exists for this user
            const existingVolunteers = await client.models.Volunteer.list({
                filter: { userSub: { eq: assignToVolunteer } }
            })
            
            let volunteerId = existingVolunteers.data[0]?.id
            
            // Create Volunteer record if it doesn't exist
            if (!volunteerId) {
                console.log('Creating new Volunteer record for:', {
                    userSub: assignToVolunteer,
                    displayName: selectedVolunteer.displayName,
                    email: selectedVolunteer.email
                })
                
                try {
                    const newVolunteer = await client.models.Volunteer.create({
                        userSub: assignToVolunteer,
                        displayName: selectedVolunteer.displayName,
                        email: selectedVolunteer.email
                    })
                    console.log('Created volunteer:', newVolunteer)
                    
                    if (newVolunteer.data) {
                        volunteerId = newVolunteer.data.id
                    } else if (newVolunteer.errors) {
                        console.error('Errors creating volunteer:', newVolunteer.errors)
                        alert(`Failed to create volunteer record: ${newVolunteer.errors.map(e => e.message).join(', ')}`)
                        return
                    }
                } catch (error) {
                    console.error('Exception creating volunteer:', error)
                    alert(`Failed to create volunteer record: ${error.message}`)
                    return
                }
            }
            
            if (!volunteerId) {
                console.error('No volunteer ID after creation attempt')
                alert('Failed to create volunteer record - no ID returned')
                return
            }

            const assignments = Array.from(selectedHomes).map(homeId => ({
                homeId,
                volunteerId: volunteerId, // Use the Volunteer model ID, not the user ID
                assignedAt: new Date().toISOString(),
                status: 'NOT_STARTED'
            }))

            const createdAssignments = await Promise.all(
                assignments.map(assignment => 
                    client.models.Assignment.create(assignment)
                )
            )

            // Update the volunteer list to include the new Volunteer record if it was created
            if (!existingVolunteers.data[0]) {
                // A new volunteer was created, add it to the volunteers list
                setVolunteers(prev => {
                    const updated = [...prev]
                    const index = updated.findIndex(v => v.id === assignToVolunteer || v.userSub === assignToVolunteer)
                    if (index >= 0) {
                        // Update the existing entry with the new Volunteer ID
                        updated[index] = {
                            ...updated[index],
                            id: volunteerId,  // Update with the actual Volunteer model ID
                        }
                    }
                    return updated
                })
            }

            // Update homes state with new assignments without reloading
            setHomes(prevHomes => 
                prevHomes.map(home => {
                    // Check if this home was assigned
                    const newAssignment = createdAssignments.find(
                        result => result.data && result.data.homeId === home.id
                    )
                    
                    if (newAssignment && newAssignment.data) {
                        // Add the new assignment to this home
                        return {
                            ...home,
                            assignments: [...(home.assignments || []), newAssignment.data]
                        }
                    }
                    return home
                })
            )

            alert(`Assigned ${selectedHomes.size} homes successfully`)
            setSelectedHomes(new Set())
            setAssignToVolunteer('')
            // Don't call loadData() - we've updated the state directly
        } catch (error) {
            console.error('Failed to assign homes:', error)
            alert('Failed to assign homes')
        }
    }

    return (
        <div>
            <Header/>
            <div style={{maxWidth: 1400, margin: '20px auto', padding: 12}}>
                <h2>Organize Canvassing</h2>
                <p>Assign homes to canvassers and track progress. Showing non-absentee homes only.</p>
                
                {/* Filters */}
                <div style={{
                    display: 'flex', 
                    gap: 16, 
                    marginBottom: 16, 
                    flexWrap: 'wrap',
                    backgroundColor: '#f8f9fa',
                    padding: 16,
                    borderRadius: 8,
                    alignItems: 'end'
                }}>
                    <div>
                        <label style={{display: 'block', marginBottom: 4}}>Address:</label>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    applyFilters()
                                }
                            }}
                            placeholder="Enter address to search..."
                            style={{padding: 8, borderRadius: 4, border: '1px solid #ddd'}}
                        />
                    </div>
                    
                    <div>
                        <label style={{display: 'block', marginBottom: 4}}>Resident Name:</label>
                        <input
                            type="text"
                            value={residentFilter}
                            onChange={(e) => setResidentFilter(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    applyFilters()
                                }
                            }}
                            placeholder="Enter resident name..."
                            style={{padding: 8, borderRadius: 4, border: '1px solid #ddd'}}
                        />
                    </div>
                    
                    <div>
                        <label style={{display: 'block', marginBottom: 4}}>Consent Status:</label>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            style={{padding: 8, borderRadius: 4, border: '1px solid #ddd'}}
                        >
                            <option value="all">All</option>
                            <option value="incomplete">Incomplete</option>
                            <option value="complete">Complete</option>
                        </select>
                    </div>
                    
                    <div>
                        <label style={{display: 'block', marginBottom: 4}}>Assignment:</label>
                        <select
                            value={assignmentFilter}
                            onChange={(e) => setAssignmentFilter(e.target.value)}
                            style={{padding: 8, borderRadius: 4, border: '1px solid #ddd'}}
                        >
                            <option value="all">All</option>
                            <option value="assigned">Assigned</option>
                            <option value="unassigned">Unassigned</option>
                        </select>
                    </div>
                    
                    <button
                        onClick={applyFilters}
                        style={{
                            backgroundColor: '#007bff',
                            color: 'white',
                            border: 'none',
                            padding: '8px 16px',
                            borderRadius: 4,
                            cursor: 'pointer'
                        }}
                    >
                        Apply Filters
                    </button>
                    
                    <button
                        onClick={clearFilters}
                        style={{
                            backgroundColor: '#6c757d',
                            color: 'white',
                            border: 'none',
                            padding: '8px 16px',
                            borderRadius: 4,
                            cursor: 'pointer'
                        }}
                    >
                        Clear Filters
                    </button>
                </div>

                {/* Bulk Actions */}
                <div style={{
                    display: 'flex',
                    gap: 16,
                    marginBottom: 16,
                    alignItems: 'center',
                    backgroundColor: '#e9ecef',
                    padding: 16,
                    borderRadius: 8
                }}>
                    <div>
                        <strong>{selectedHomes.size}</strong> homes selected
                    </div>
                    
                    <button
                        onClick={selectAll}
                        style={{
                            backgroundColor: '#6c757d',
                            color: 'white',
                            border: 'none',
                            padding: '6px 12px',
                            borderRadius: 4,
                            cursor: 'pointer'
                        }}
                    >
                        Select All ({homes.length})
                    </button>
                    
                    <button
                        onClick={clearSelection}
                        style={{
                            backgroundColor: '#dc3545',
                            color: 'white',
                            border: 'none',
                            padding: '6px 12px',
                            borderRadius: 4,
                            cursor: 'pointer'
                        }}
                    >
                        Clear Selection
                    </button>
                    
                    <div style={{display: 'flex', gap: 8, alignItems: 'center'}}>
                        <select
                            value={assignToVolunteer}
                            onChange={(e) => setAssignToVolunteer(e.target.value)}
                            style={{padding: 8, borderRadius: 4, border: '1px solid #ddd'}}
                        >
                            <option value="">Select volunteer...</option>
                            {volunteers.map(volunteer => (
                                <option key={volunteer.id} value={volunteer.id}>
                                    {volunteer.displayName || volunteer.email} ({volunteer.role})
                                </option>
                            ))}
                        </select>
                        
                        <button
                            onClick={assignSelectedHomes}
                            disabled={selectedHomes.size === 0 || !assignToVolunteer}
                            style={{
                                backgroundColor: selectedHomes.size > 0 && assignToVolunteer ? '#28a745' : '#6c757d',
                                color: 'white',
                                border: 'none',
                                padding: '8px 16px',
                                borderRadius: 4,
                                cursor: selectedHomes.size > 0 && assignToVolunteer ? 'pointer' : 'not-allowed'
                            }}
                        >
                            Assign Selected
                        </button>
                        
                        <button
                            onClick={unassignSelectedHomes}
                            disabled={selectedHomes.size === 0}
                            style={{
                                backgroundColor: selectedHomes.size > 0 ? '#dc3545' : '#6c757d',
                                color: 'white',
                                border: 'none',
                                padding: '8px 16px',
                                borderRadius: 4,
                                cursor: selectedHomes.size > 0 ? 'pointer' : 'not-allowed'
                            }}
                        >
                            Unassign Selected
                        </button>
                    </div>
                </div>

                {/* Stats */}
                <div style={{marginBottom: 16, fontSize: '0.9em', color: '#666'}}>
                    {searchTerm.trim() || residentFilter.trim() ? (
                        (() => {
                            const filters = []
                            if (searchTerm.trim()) filters.push(`address: "${searchTerm}"`)
                            if (residentFilter.trim()) filters.push(`resident: "${residentFilter}"`)
                            return `Showing ${homes.length} homes on page ${currentPage} of ${Math.ceil(totalCount / pageSize)} (Found ${totalCount} matches for ${filters.join(' and ')})`
                        })()
                    ) : (
                        `Showing ${homes.length} homes on page ${currentPage} of ${Math.ceil(totalCount / pageSize)} (Total: ${totalCount} homes with residents)`
                    )}
                </div>

                {/* Table */}
                <div style={{overflowX: 'auto'}}>
                    <table style={{width: '100%', borderCollapse: 'collapse'}}>
                        <thead>
                            <tr style={{backgroundColor: '#f8f9fa'}}>
                                <th style={{border: '1px solid #ddd', padding: 8, width: 40}}>
                                    <input
                                        type="checkbox"
                                        checked={homes.length > 0 && selectedHomes.size === homes.length}
                                        onChange={() => selectedHomes.size === homes.length ? clearSelection() : selectAll()}
                                    />
                                </th>
                                <th 
                                    style={{
                                        border: '1px solid #ddd', 
                                        padding: 8, 
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        backgroundColor: sortField === 'street' ? '#e9ecef' : 'transparent'
                                    }}
                                    onClick={() => handleSort('street')}
                                >
                                    Address {sortField === 'street' && (sortDirection === 'asc' ? '↑' : '↓')}
                                </th>
                                <th style={{border: '1px solid #ddd', padding: 8, textAlign: 'left'}}>Residents</th>
                                <th 
                                    style={{
                                        border: '1px solid #ddd', 
                                        padding: 8, 
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        backgroundColor: sortField === 'consentStatus' ? '#e9ecef' : 'transparent'
                                    }}
                                    onClick={() => handleSort('consentStatus')}
                                >
                                    Consent Status {sortField === 'consentStatus' && (sortDirection === 'asc' ? '↑' : '↓')}
                                </th>
                                <th style={{border: '1px solid #ddd', padding: 8, textAlign: 'left'}}>Assignment</th>
                                <th style={{border: '1px solid #ddd', padding: 8, textAlign: 'left'}}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={6} style={{
                                        border: '1px solid #ddd', 
                                        padding: 40, 
                                        textAlign: 'center',
                                        color: '#666'
                                    }}>
                                        Loading homes...
                                    </td>
                                </tr>
                            ) : homes.map(home => (
                                <tr key={home.id} style={{backgroundColor: selectedHomes.has(home.id) ? '#e3f2fd' : 'white'}}>
                                    <td style={{border: '1px solid #ddd', padding: 8}}>
                                        <input
                                            type="checkbox"
                                            checked={selectedHomes.has(home.id)}
                                            onChange={() => toggleHomeSelection(home.id)}
                                        />
                                    </td>
                                    <td style={{border: '1px solid #ddd', padding: 8}}>
                                        {/* Handle case where unitNumber and street might contain duplicate data */}
                                        {home.unitNumber && home.street && home.unitNumber !== home.street 
                                            ? `${home.unitNumber} ${home.street}` 
                                            : (home.street || home.unitNumber)
                                        }<br/>
                                        <span style={{fontSize: '0.9em', color: '#666'}}>
                                            {home.city}, {home.state} {home.postalCode}
                                        </span>
                                    </td>
                                    <td style={{border: '1px solid #ddd', padding: 8}}>
                                        {home.residents?.map((resident: any, i: number) => (
                                            <div key={resident.id} style={{marginBottom: 4}}>
                                                {resident.firstName} {resident.lastName}
                                                <span style={{fontSize: '0.8em', color: resident.hasSigned ? '#28a745' : '#dc3545'}}>
                                                    {resident.hasSigned ? ' ✓' : ' ✗'}
                                                </span>
                                                {resident.role && (
                                                    <span style={{fontSize: '0.8em', color: '#666'}}>
                                                        {' (' + resident.role.replace('_', ' ') + ')'}
                                                    </span>
                                                )}
                                            </div>
                                        )) || 'No residents'}
                                    </td>
                                    <td style={{border: '1px solid #ddd', padding: 8}}>
                                        <span style={{
                                            padding: '4px 8px',
                                            borderRadius: 4,
                                            fontSize: '0.8em',
                                            backgroundColor: home.consentStatus === 'complete' ? '#d4edda' : '#f8d7da',
                                            color: home.consentStatus === 'complete' ? '#155724' : '#721c24'
                                        }}>
                                            {home.consentStatus === 'complete' ? 'Complete' : 'Incomplete'}
                                        </span>
                                        <div style={{fontSize: '0.8em', color: '#666', marginTop: 4}}>
                                            {home.consents.length} of {home.residents.length} signed
                                        </div>
                                    </td>
                                    <td style={{border: '1px solid #ddd', padding: 8}}>
                                        {home.assignments.length > 0 ? (
                                            home.assignments.map((assignment: any) => (
                                                <div key={assignment.id} style={{fontSize: '0.9em'}}>
                                                    {volunteers.find(v => v.id === assignment.volunteerId)?.displayName || 'Unknown'}
                                                    <div style={{fontSize: '0.8em', color: '#666'}}>
                                                        {assignment.status.replace('_', ' ')}
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <span style={{color: '#666', fontSize: '0.9em'}}>Unassigned</span>
                                        )}
                                    </td>
                                    <td style={{border: '1px solid #ddd', padding: 8}}>
                                        <button
                                            onClick={() => window.open(`/history?address=${encodeURIComponent(home.street)}`, '_blank')}
                                            style={{
                                                backgroundColor: '#17a2b8',
                                                color: 'white',
                                                border: 'none',
                                                padding: '4px 8px',
                                                borderRadius: 4,
                                                cursor: 'pointer',
                                                fontSize: '0.8em'
                                            }}
                                        >
                                            View History
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalCount > pageSize && (
                    <div style={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: 8,
                        marginTop: 16,
                        padding: 16
                    }}>
                        <button
                            onClick={() => {
                                const newPage = Math.max(1, currentPage - 1)
                                setCurrentPage(newPage)
                                updateURL({
                                    address: searchTerm,
                                    resident: residentFilter,
                                    status: statusFilter,
                                    assignment: assignmentFilter,
                                    page: newPage
                                })
                            }}
                            disabled={currentPage === 1}
                            style={{
                                backgroundColor: currentPage === 1 ? '#6c757d' : '#007bff',
                                color: 'white',
                                border: 'none',
                                padding: '6px 12px',
                                borderRadius: 4,
                                cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                            }}
                        >
                            Previous
                        </button>
                        
                        <span style={{margin: '0 16px'}}>
                            Page {currentPage} of {Math.ceil(totalCount / pageSize)}
                        </span>
                        
                        <button
                            onClick={() => {
                                const newPage = currentPage + 1
                                setCurrentPage(newPage)
                                updateURL({
                                    address: searchTerm,
                                    resident: residentFilter,
                                    status: statusFilter,
                                    assignment: assignmentFilter,
                                    page: newPage
                                })
                            }}
                            disabled={currentPage >= Math.ceil(totalCount / pageSize)}
                            style={{
                                backgroundColor: currentPage < Math.ceil(totalCount / pageSize) ? '#007bff' : '#6c757d',
                                color: 'white',
                                border: 'none',
                                padding: '6px 12px',
                                borderRadius: 4,
                                cursor: currentPage < Math.ceil(totalCount / pageSize) ? 'pointer' : 'not-allowed'
                            }}
                        >
                            Next
                        </button>
                    </div>
                )}

                {homes.length === 0 && !loading && (
                    <div style={{textAlign: 'center', padding: 40, color: '#666'}}>
                        No homes match the current filters.
                    </div>
                )}
            </div>
        </div>
    )
}
