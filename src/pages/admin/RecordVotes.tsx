import Header from '../../components/Header'
import {useEffect, useState} from 'react'
import {generateClient} from 'aws-amplify/data'
import type {Schema} from '../../../amplify/data/resource'
import Papa from 'papaparse'

function normalizeStreet(street: string): string {
    return street.toLowerCase()
        .replace(/\bterrace\b/g, 'ter')
        .replace(/\bcircle\b/g, 'cir')
        .replace(/\bcourt\b/g, 'ct')
        .replace(/\bdrive\b/g, 'dr')
        .replace(/\bstreet\b/g, 'st')
        .replace(/\bavenue\b/g, 'ave')
        .replace(/\broad\b/g, 'rd')
        .replace(/\blane\b/g, 'ln')
        .replace(/\bsquare\b/g, 'sq')
        .replace(/\bplace\b/g, 'pl')
        .replace(/\bboulevard\b/g, 'blvd')
        .replace(/\s+/g, ' ')
        .trim()
}

export default function RecordConsents() {
    const [searchTerm, setSearchTerm] = useState('')
    const [addresses, setAddresses] = useState<any[]>([])
    
    const client = generateClient<Schema>()
    const [filteredAddresses, setFilteredAddresses] = useState<any[]>([])
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [uploadStatus, setUploadStatus] = useState('')
    const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 })
    const [uploadFormat, setUploadFormat] = useState<'full' | 'simple'>('full')
    const [notFoundRecords, setNotFoundRecords] = useState<string[]>([])
    const [uploadResults, setUploadResults] = useState<any>(null)

    useEffect(() => {
        loadAddresses()
    }, [])

    useEffect(() => {
        if (searchTerm) {
            const filtered = addresses.filter(address => 
                address.street.toLowerCase().includes(searchTerm.toLowerCase()) ||
                address.residents?.some((resident: any) => 
                    `${resident.firstName} ${resident.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
                )
            )
            setFilteredAddresses(filtered)
        } else {
            setFilteredAddresses([])
        }
    }, [searchTerm, addresses])

    async function loadAddresses() {
        try {
            const result = await client.models.Address.list()
            const addressesWithResidents = await Promise.all(
                result.data.map(async (address) => {
                    const residents = await client.models.Resident.list({
                        filter: { addressId: { eq: address.id } }
                    })
                    return { ...address, residents: residents.data }
                })
            )
            setAddresses(addressesWithResidents)
        } catch (error) {
            console.error('Failed to load addresses:', error)
        }
    }

    async function recordConsent(residentId: string, addressId: string, showAlert = true, email?: string, source = 'manual') {
        try {
            // Check if consent already exists (idempotent)
            const existingConsents = await client.models.Consent.list({
                filter: { residentId: { eq: residentId } }
            })

            if (existingConsents.data.length === 0) {
                // Create new consent
                await client.models.Consent.create({
                    residentId,
                    addressId,
                    recordedAt: new Date().toISOString(),
                    source: source,
                    email: email || null
                })
            } else {
                // Update existing consent with email if provided
                const existingConsent = existingConsents.data[0]
                if (email && !existingConsent.email) {
                    await client.models.Consent.update({
                        id: existingConsent.id,
                        email: email
                    })
                }
            }

            await client.models.Resident.update({
                id: residentId,
                hasSigned: true,
                signedAt: new Date().toISOString()
            })

            await loadAddresses() // Refresh data
            if (showAlert) alert('Consent recorded successfully!')
        } catch (error) {
            console.error('Failed to record consent:', error)
            if (showAlert) alert('Failed to record consent')
        }
    }

    async function deleteAllConsents() {
        if (!confirm('⚠️ WARNING: This will DELETE ALL consents and reset all residents to unsigned. Are you sure?')) {
            return
        }

        try {
            setUploadStatus('Deleting all consents...')
            setUploadProgress({ current: 0, total: 0 })

            // Delete all consents
            let consentsNextToken = null
            let deletedCount = 0
            do {
                const consents = await client.models.Consent.list({ limit: 100, nextToken: consentsNextToken })
                for (const consent of consents.data) {
                    await client.models.Consent.delete({ id: consent.id })
                    deletedCount++
                    if (deletedCount % 50 === 0) {
                        setUploadProgress({ current: deletedCount, total: deletedCount })
                    }
                }
                consentsNextToken = consents.nextToken
            } while (consentsNextToken)

            setUploadStatus('Resetting resident signatures...')

            // Reset all residents' hasSigned status
            let residentsNextToken = null
            let resetCount = 0
            do {
                const residents = await client.models.Resident.list({ limit: 100, nextToken: residentsNextToken })
                for (const resident of residents.data) {
                    if (resident.hasSigned) {
                        await client.models.Resident.update({
                            id: resident.id,
                            hasSigned: false,
                            signedAt: null
                        })
                        resetCount++
                        if (resetCount % 50 === 0) {
                            setUploadProgress({ current: resetCount, total: resetCount })
                        }
                    }
                }
                residentsNextToken = residents.nextToken
            } while (residentsNextToken)

            setUploadStatus(`✅ Deleted ${deletedCount} consents and reset ${resetCount} residents`)
            setUploadProgress({ current: 0, total: 0 })
            await loadAddresses()
        } catch (error) {
            console.error('Error deleting consents:', error)
            setUploadStatus(`❌ Error: ${error}`)
        }
    }

    async function removeDuplicateConsents() {
        if (!confirm('⚠️ This will remove duplicate consent records, keeping only one per resident. Continue?')) {
            return
        }

        try {
            setUploadStatus('Loading all consents...')
            setUploadProgress({ current: 0, total: 0 })

            // Load all consents
            let allConsents: any[] = []
            let nextToken = null
            do {
                const result = await client.models.Consent.list({ limit: 1000, nextToken: nextToken })
                allConsents.push(...result.data)
                nextToken = result.nextToken
            } while (nextToken)

            setUploadStatus(`Analyzing ${allConsents.length} consents...`)

            // Group by residentId
            const consentsByResident = new Map<string, any[]>()
            for (const consent of allConsents) {
                const residentId = consent.residentId
                if (!consentsByResident.has(residentId)) {
                    consentsByResident.set(residentId, [])
                }
                consentsByResident.get(residentId)!.push(consent)
            }

            // Find duplicates
            const duplicates: any[] = []
            for (const [residentId, consents] of consentsByResident.entries()) {
                if (consents.length > 1) {
                    duplicates.push({ residentId, consents })
                }
            }

            if (duplicates.length === 0) {
                setUploadStatus('✅ No duplicates found!')
                return
            }

            const totalToDelete = duplicates.reduce((sum, d) => sum + d.consents.length - 1, 0)
            setUploadStatus(`Found ${duplicates.length} residents with duplicates. Removing ${totalToDelete} duplicate consents...`)
            setUploadProgress({ current: 0, total: totalToDelete })

            let deletedCount = 0

            for (const { residentId, consents } of duplicates) {
                // Sort by: prefer one with email, then by most recent createdAt
                const sorted = consents.sort((a, b) => {
                    if (a.email && !b.email) return -1
                    if (!a.email && b.email) return 1
                    if (a.createdAt && b.createdAt) {
                        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                    }
                    return 0
                })

                // Keep the first one, delete the rest
                const toDelete = sorted.slice(1)

                for (const consent of toDelete) {
                    await client.models.Consent.delete({ id: consent.id })
                    deletedCount++
                    if (deletedCount % 10 === 0) {
                        setUploadProgress({ current: deletedCount, total: totalToDelete })
                    }
                }
            }

            setUploadStatus(`✅ Removed ${deletedCount} duplicate consents! Remaining: ${allConsents.length - deletedCount}`)
            setUploadProgress({ current: 0, total: 0 })
            await loadAddresses()
        } catch (error) {
            console.error('Error removing duplicates:', error)
            setUploadStatus(`❌ Error: ${error}`)
        }
    }

    async function handleFileUpload() {
        if (!selectedFile) {
            setUploadStatus('❌ No file selected')
            return
        }

        let rows: any[] = []

        try {
            setUploadStatus('Reading file...')
            const text = await selectedFile.text()

            // Parse CSV properly with papaparse
            const parsed = Papa.parse(text, {
                header: true,
                skipEmptyLines: true
            })

            rows = parsed.data as any[]

            if (rows.length === 0) {
                setUploadStatus('❌ CSV file is empty')
                setUploadProgress({ current: 0, total: 0 })
                return
            }

            setUploadProgress({ current: 0, total: rows.length })
        } catch (error) {
            console.error('Error reading file:', error)
            setUploadStatus('❌ Error reading file. Please try selecting the file again.')
            setUploadProgress({ current: 0, total: 0 })
            setSelectedFile(null)
            return
        }

        // Handle simple format (person_id, expanded_name, expanded_email)
        if (uploadFormat === 'simple') {
            setUploadStatus('Loading all residents from database...')
            let allResidents: any[] = []
            let residentsNextToken = null
            do {
                const residentsResult = await client.models.Resident.list({
                    limit: 1000,
                    nextToken: residentsNextToken
                })
                allResidents.push(...residentsResult.data)
                residentsNextToken = residentsResult.nextToken
            } while (residentsNextToken)

            console.log(`=== Loaded ${allResidents.length} total residents from database ===`)

            // Load existing consents
            setUploadStatus('Loading existing consents...')
            let allConsents: any[] = []
            let consentsNextToken = null
            do {
                const consentsResult = await client.models.Consent.list({
                    limit: 1000,
                    nextToken: consentsNextToken
                })
                allConsents.push(...consentsResult.data)
                consentsNextToken = consentsResult.nextToken
            } while (consentsNextToken)

            const residentsWithConsents = new Set(allConsents.map(c => c.residentId))
            console.log(`=== Found ${residentsWithConsents.size} residents with existing consents ===`)

            let processed = 0
            let newRecords = 0
            let alreadySigned = 0
            let emailsUpdated = 0
            let notFound = 0
            let skippedMissingData = 0
            const errors: string[] = []

            setUploadStatus('Processing consent records...')

            for (const row of rows) {
                const personId = row.person_id?.trim()
                const email = row.email?.trim()
                const submissionId = row.submission_id?.trim() || row.Number?.trim() // Handle both column names

                if (!personId) {
                    skippedMissingData++
                    processed++
                    continue
                }

                try {
                    // Find resident by personId or externalId
                    const foundResident = allResidents.find(r =>
                        r.personId === personId || r.externalId === personId
                    )

                    if (foundResident) {
                        // Check if resident already has consent
                        if (residentsWithConsents.has(foundResident.id)) {
                            // Update email and/or submissionId if needed
                            const existingConsent = allConsents.find(c => c.residentId === foundResident.id)
                            if (existingConsent) {
                                const updates: any = { id: existingConsent.id }
                                let needsUpdate = false

                                if (email && !existingConsent.email) {
                                    updates.email = email
                                    needsUpdate = true
                                }

                                if (submissionId && !existingConsent.submissionId) {
                                    updates.submissionId = submissionId
                                    needsUpdate = true
                                }

                                if (needsUpdate) {
                                    await client.models.Consent.update(updates)
                                    emailsUpdated++
                                }
                            }
                            alreadySigned++
                        } else {
                            // Create new consent
                            await client.models.Consent.create({
                                residentId: foundResident.id,
                                addressId: foundResident.addressId!,
                                recordedAt: new Date().toISOString(),
                                source: 'csv-upload',
                                email: email || null,
                                submissionId: submissionId || null
                            })
                            await client.models.Resident.update({
                                id: foundResident.id,
                                hasSigned: true,
                                signedAt: new Date().toISOString()
                            })
                            residentsWithConsents.add(foundResident.id)
                            newRecords++
                        }
                    } else {
                        notFound++
                        errors.push(`person_id: ${personId}`)
                    }
                } catch (err) {
                    console.error(`Error processing person_id ${personId}:`, err)
                    errors.push(`person_id ${personId} - Error: ${err}`)
                }

                processed++
                setUploadProgress({ current: processed, total: rows.length })
            }

            await loadAddresses()

            const statusParts = [
                `${rows.length} rows in CSV`,
                `${newRecords} new consents created`,
                `${alreadySigned} already signed${emailsUpdated > 0 ? ` (${emailsUpdated} emails updated)` : ''}`,
                `${notFound} not found in DB`,
                `${skippedMissingData} missing person_id`
            ]

            const finalStatus = `✅ ${statusParts.join(' | ')}`
            setUploadStatus(finalStatus)
            setUploadProgress({ current: 0, total: 0 })
            setSelectedFile(null)
            setNotFoundRecords(errors)
            setUploadResults({
                totalRows: rows.length,
                newRecords,
                alreadySigned,
                emailsUpdated,
                notFound,
                skippedMissingData
            })

            console.log('\n' + '='.repeat(80))
            console.log('UPLOAD SUMMARY:')
            console.log('='.repeat(80))
            console.log(`Total rows in CSV: ${rows.length}`)
            console.log(`New consents created: ${newRecords}`)
            console.log(`Already signed (skipped): ${alreadySigned}`)
            console.log(`Emails updated: ${emailsUpdated}`)
            console.log(`Not found in database: ${notFound}`)
            console.log(`Missing person_id (skipped): ${skippedMissingData}`)
            console.log('='.repeat(80))

            if (errors.length > 0 && errors.length <= 20) {
                console.log('\nNot found in database:', errors)
            } else if (errors.length > 20) {
                console.log('\nNot found in database (first 20):', errors.slice(0, 20))
                console.log(`... and ${errors.length - 20} more`)
            }

            return
        }

        // Original full format logic below
        // Load ALL residents (like /organize page does)
        setUploadStatus('Loading all residents from database...')
        let allResidents: any[] = []
        let residentsNextToken = null
        do {
            const residentsResult = await client.models.Resident.list({
                limit: 1000,
                nextToken: residentsNextToken
            })
            allResidents.push(...residentsResult.data)
            residentsNextToken = residentsResult.nextToken
        } while (residentsNextToken)

        console.log(`=== Loaded ${allResidents.length} total residents from database ===`)

        // Load existing consents to check which residents already have consents
        setUploadStatus('Loading existing consents...')
        let allConsents: any[] = []
        let consentsNextToken = null
        do {
            const consentsResult = await client.models.Consent.list({
                limit: 1000,
                nextToken: consentsNextToken
            })
            allConsents.push(...consentsResult.data)
            consentsNextToken = consentsResult.nextToken
        } while (consentsNextToken)

        // Create a Set of residentIds that already have consents
        const residentsWithConsents = new Set(allConsents.map(c => c.residentId))
        console.log(`=== Found ${residentsWithConsents.size} residents with existing consents ===`)

        let processed = 0
        let newRecords = 0
        let alreadySigned = 0
        let emailsUpdated = 0
        let notFound = 0
        let skippedMissingData = 0
        let skippedDuplicates = 0
        const errors: string[] = []
        const processedInThisUpload = new Set<string>() // Track processed residents in this upload

        setUploadStatus('Processing consent records...')

        for (const row of rows) {
            const firstName = row.resident_first_name?.trim()
            const lastName = row.resident_last_name?.trim()
            const street = row.resident_street?.trim() || row.expanded_street?.trim()
            const email = row.resident_email?.trim() || row.expanded_email?.trim() // Capture email from CSV
            const submissionId = row.submission_id?.trim() || row.Number?.trim() // Handle both column names

            if (!firstName || !lastName || !street) {
                skippedMissingData++
                processed++
                if (skippedMissingData <= 5) {
                    console.log(`   ⚠️  SKIPPED (missing data): firstName="${firstName}", lastName="${lastName}", street="${street}"`)
                }
                continue
            }

            try {
                // Find resident by name (client-side filtering like /organize page)
                const nameMatches = allResidents.filter(r =>
                    r.firstName?.toLowerCase() === firstName?.toLowerCase() &&
                    r.lastName?.toLowerCase() === lastName?.toLowerCase()
                )

                if (processed < 5) {
                    console.log(`[${processed + 1}] Searching: ${firstName} ${lastName} at ${street}`)
                    console.log(`   Found ${nameMatches.length} name matches`)
                }

                // Find the one with matching address
                let foundResident = null
                const normalizedCsvStreet = normalizeStreet(street)

                for (const resident of nameMatches) {
                    const address = await client.models.Address.get({ id: resident.addressId! })
                    if (processed < 5 && address.data) {
                        console.log(`   Comparing: "${normalizedCsvStreet}" vs "${normalizeStreet(address.data.street)}"`)
                    }
                    if (address.data && normalizeStreet(address.data.street) === normalizedCsvStreet) {
                        foundResident = resident
                        break
                    }
                }

                if (foundResident) {
                    // Skip if we already processed this resident in this upload session
                    if (processedInThisUpload.has(foundResident.id)) {
                        skippedDuplicates++
                        if (skippedDuplicates <= 10) {
                            console.log(`   ⏭️  SKIPPED (duplicate in CSV): ${firstName} ${lastName}`)
                        }
                        processed++
                        continue
                    }

                    // Mark as processed in this upload
                    processedInThisUpload.add(foundResident.id)

                    // Check if resident already has consent
                    if (residentsWithConsents.has(foundResident.id)) {
                        // Update email and/or submissionId if needed
                        const existingConsent = allConsents.find(c => c.residentId === foundResident.id)
                        if (existingConsent) {
                            const updates: any = { id: existingConsent.id }
                            let needsUpdate = false

                            if (email && !existingConsent.email) {
                                updates.email = email
                                needsUpdate = true
                            }

                            if (submissionId && !existingConsent.submissionId) {
                                updates.submissionId = submissionId
                                needsUpdate = true
                            }

                            if (needsUpdate) {
                                await client.models.Consent.update(updates)
                                emailsUpdated++
                            }
                        }
                        alreadySigned++
                    } else {
                        // Create new consent
                        await client.models.Consent.create({
                            residentId: foundResident.id,
                            addressId: foundResident.addressId!,
                            recordedAt: new Date().toISOString(),
                            source: 'csv-upload',
                            email: email || null,
                            submissionId: submissionId || null
                        })
                        await client.models.Resident.update({
                            id: foundResident.id,
                            hasSigned: true,
                            signedAt: new Date().toISOString()
                        })
                        residentsWithConsents.add(foundResident.id) // Track for this session
                        newRecords++
                    }
                } else {
                    notFound++
                    if (processed < 10) {
                        console.log(`   ❌ NOT FOUND: ${firstName} ${lastName} at ${street}`)
                    }
                    errors.push(`${firstName} ${lastName} at ${street}`)
                }
            } catch (err) {
                console.error(`Error processing ${firstName} ${lastName}:`, err)
                errors.push(`${firstName} ${lastName} - Error: ${err}`)
            }

            processed++
            setUploadProgress({ current: processed, total: rows.length })
        }

        await loadAddresses() // Refresh the data

        // Build detailed status message
        const statusParts = [
            `${rows.length} rows in CSV`,
            `${newRecords} new consents created`,
            `${alreadySigned} already signed${emailsUpdated > 0 ? ` (${emailsUpdated} emails updated)` : ''}`,
            `${notFound} not found in DB`,
            `${skippedDuplicates} duplicates in CSV`,
            `${skippedMissingData} missing data`
        ]

        const finalStatus = `✅ ${statusParts.join(' | ')}`
        setUploadStatus(finalStatus)
        setUploadProgress({ current: 0, total: 0 })
        setSelectedFile(null)
        setNotFoundRecords(errors)
        setUploadResults({
            totalRows: rows.length,
            newRecords,
            alreadySigned,
            emailsUpdated,
            notFound,
            skippedDuplicates,
            skippedMissingData
        })

        console.log('\n' + '='.repeat(80))
        console.log('UPLOAD SUMMARY:')
        console.log('='.repeat(80))
        console.log(`Total rows in CSV: ${rows.length}`)
        console.log(`New consents created: ${newRecords}`)
        console.log(`Already signed (skipped): ${alreadySigned}`)
        console.log(`Emails updated: ${emailsUpdated}`)
        console.log(`Not found in database: ${notFound}`)
        console.log(`Duplicates in CSV (skipped): ${skippedDuplicates}`)
        console.log(`Missing data (skipped): ${skippedMissingData}`)
        console.log('='.repeat(80))
        console.log(`Expected total consents: ${newRecords + alreadySigned}`)
        console.log('='.repeat(80))

        if (errors.length > 0 && errors.length <= 20) {
            console.log('\nNot found in database:', errors)
        } else if (errors.length > 20) {
            console.log('\nNot found in database (first 20):', errors.slice(0, 20))
            console.log(`... and ${errors.length - 20} more`)
        }
    }

    return (
        <div>
            <Header/>
            <div style={{maxWidth: 1000, margin: '20px auto', padding: 16}}>
                <h2>Record Consent Forms</h2>
                
                <div style={{marginBottom: 24}}>
                    <h3>Search and Record Individual Consents</h3>
                    <input 
                        type='text'
                        placeholder='Search by name or address...'
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{width: '100%', padding: 8, marginBottom: 16}}
                    />
                    
                    {filteredAddresses.length > 0 && (
                        <div style={{border: '1px solid #ddd', borderRadius: 4, maxHeight: 400, overflowY: 'auto'}}>
                            {filteredAddresses.map(address => (
                                <div key={address.id} style={{padding: 12, borderBottom: '1px solid #eee'}}>
                                    <strong>{address.street}</strong>
                                    <div style={{marginTop: 8}}>
                                        {address.residents?.map((resident: any) => (
                                            <div key={resident.id} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0'}}>
                                                <span>
                                                    {resident.firstName} {resident.lastName} 
                                                    {resident.hasSigned && <span style={{color: 'green', marginLeft: 8}}>✓ Signed</span>}
                                                </span>
                                                {!resident.hasSigned && (
                                                    <button 
                                                        onClick={() => recordConsent(resident.id, address.id)}
                                                        style={{backgroundColor: '#007bff', color: 'white', border: 'none', padding: '4px 8px', borderRadius: 4}}
                                                    >
                                                        Record Consent
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div>
                    <h3>Bulk Upload Consents (CSV)</h3>

                    <div style={{marginBottom: 16, padding: 12, backgroundColor: '#f8f9fa', borderRadius: 4}}>
                        <strong>Select CSV Format:</strong>
                        <div style={{marginTop: 8}}>
                            <label style={{display: 'block', marginBottom: 8}}>
                                <input
                                    type='radio'
                                    value='simple'
                                    checked={uploadFormat === 'simple'}
                                    onChange={(e) => setUploadFormat('simple')}
                                    style={{marginRight: 8}}
                                />
                                <strong>Simple format:</strong> person_id, submission_id, email (extra columns ignored)
                            </label>
                            <label style={{display: 'block'}}>
                                <input
                                    type='radio'
                                    value='full'
                                    checked={uploadFormat === 'full'}
                                    onChange={(e) => setUploadFormat('full')}
                                    style={{marginRight: 8}}
                                />
                                <strong>Full format:</strong> person_id, expanded_name, expanded_email, expanded_street, resident_street, resident_first_name, resident_last_name, resident_email, match_type (optional: submission_id or Number)
                            </label>
                        </div>
                        <div style={{marginTop: 8, fontSize: '0.9em', color: '#666'}}>
                            💡 Re-uploading files will update existing consents with missing email or submission_id values without creating duplicates.
                        </div>
                    </div>

                    <input
                        type='file'
                        accept='.csv'
                        onChange={(e) => {
                            setSelectedFile(e.target.files?.[0] || null)
                            setNotFoundRecords([])
                            setUploadResults(null)
                        }}
                        style={{marginBottom: 12}}
                    />
                    <button
                        onClick={handleFileUpload}
                        disabled={!selectedFile || uploadProgress.total > 0}
                        style={{
                            backgroundColor: selectedFile && uploadProgress.total === 0 ? '#28a745' : '#ccc',
                            color: 'white',
                            border: 'none',
                            padding: '8px 16px',
                            borderRadius: 4,
                            marginLeft: 12
                        }}
                    >
                        Upload CSV
                    </button>
                    {uploadProgress.total > 0 && (
                        <div style={{marginTop: 12}}>
                            <div style={{
                                width: '100%',
                                height: 24,
                                backgroundColor: '#e0e0e0',
                                borderRadius: 4,
                                overflow: 'hidden'
                            }}>
                                <div style={{
                                    width: `${(uploadProgress.current / uploadProgress.total) * 100}%`,
                                    height: '100%',
                                    backgroundColor: '#28a745',
                                    transition: 'width 0.3s ease'
                                }}/>
                            </div>
                            <p style={{marginTop: 4, color: '#666', fontSize: 14}}>
                                Processing {uploadProgress.current} of {uploadProgress.total}
                            </p>
                        </div>
                    )}
                    {uploadStatus && uploadProgress.total === 0 && <p style={{marginTop: 8, color: '#666'}}>{uploadStatus}</p>}

                    {/* Display upload results */}
                    {uploadResults && (
                        <div style={{marginTop: 16, padding: 16, backgroundColor: '#f8f9fa', borderRadius: 4}}>
                            <h4>Upload Summary</h4>
                            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8}}>
                                <div>Total rows in CSV: <strong>{uploadResults.totalRows}</strong></div>
                                <div style={{color: '#28a745'}}>New consents: <strong>{uploadResults.newRecords}</strong></div>
                                <div>Already signed: <strong>{uploadResults.alreadySigned}</strong></div>
                                <div>Emails updated: <strong>{uploadResults.emailsUpdated}</strong></div>
                                <div style={{color: '#dc3545'}}>Not found: <strong>{uploadResults.notFound}</strong></div>
                                {uploadResults.skippedDuplicates !== undefined && (
                                    <div>Duplicates skipped: <strong>{uploadResults.skippedDuplicates}</strong></div>
                                )}
                                <div>Missing data: <strong>{uploadResults.skippedMissingData}</strong></div>
                            </div>
                        </div>
                    )}

                    {/* Display not found records */}
                    {notFoundRecords.length > 0 && (
                        <div style={{marginTop: 16, padding: 16, backgroundColor: '#fff3cd', border: '1px solid #ffc107', borderRadius: 4}}>
                            <h4 style={{marginTop: 0, color: '#856404'}}>⚠️ Records Not Found in Database ({notFoundRecords.length})</h4>
                            <div style={{
                                maxHeight: 300,
                                overflowY: 'auto',
                                backgroundColor: 'white',
                                padding: 12,
                                borderRadius: 4,
                                border: '1px solid #ddd'
                            }}>
                                {notFoundRecords.map((record, index) => (
                                    <div key={index} style={{
                                        padding: '4px 0',
                                        borderBottom: index < notFoundRecords.length - 1 ? '1px solid #eee' : 'none',
                                        fontFamily: 'monospace',
                                        fontSize: '0.9em'
                                    }}>
                                        {record}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div style={{marginTop: 32, paddingTop: 24, borderTop: '2px solid #ddd'}}>
                    <h3 style={{color: '#dc3545'}}>⚠️ Danger Zone</h3>

                    <div style={{marginBottom: 16}}>
                        <p style={{color: '#666', marginBottom: 8}}>Remove duplicate consent records (keeps one per resident with email preference):</p>
                        <button
                            onClick={removeDuplicateConsents}
                            disabled={uploadProgress.total > 0}
                            style={{
                                backgroundColor: uploadProgress.total === 0 ? '#ffc107' : '#ccc',
                                color: '#333',
                                border: 'none',
                                padding: '8px 16px',
                                borderRadius: 4,
                                cursor: uploadProgress.total === 0 ? 'pointer' : 'not-allowed',
                                fontWeight: 'bold'
                            }}
                        >
                            🧹 Remove Duplicate Consents
                        </button>
                    </div>

                    <div>
                        <p style={{color: '#666', marginBottom: 8}}>Delete ALL consent records and reset all residents to unsigned status:</p>
                        <button
                            onClick={deleteAllConsents}
                            disabled={uploadProgress.total > 0}
                            style={{
                                backgroundColor: uploadProgress.total === 0 ? '#dc3545' : '#ccc',
                                color: 'white',
                                border: 'none',
                                padding: '8px 16px',
                                borderRadius: 4,
                                cursor: uploadProgress.total === 0 ? 'pointer' : 'not-allowed',
                                fontWeight: 'bold'
                            }}
                        >
                            🗑️ Delete All Consents
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
