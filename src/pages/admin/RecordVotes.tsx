import Header from '../../components/Header'
import {useEffect, useState} from 'react'
import {generateClient} from 'aws-amplify/data'
import type {Schema} from '../../../amplify/data/resource'
import Papa from 'papaparse'

export default function RecordConsents() {
    const [searchTerm, setSearchTerm] = useState('')
    const [addresses, setAddresses] = useState<any[]>([])
    
    const client = generateClient<Schema>()
    const [filteredAddresses, setFilteredAddresses] = useState<any[]>([])
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [uploadStatus, setUploadStatus] = useState('')
    const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 })
    const [notFoundRecords, setNotFoundRecords] = useState<string[]>([])
    const [uploadResults, setUploadResults] = useState<any>(null)

    const [selectedUnconfirmedFile, setSelectedUnconfirmedFile] = useState<File | null>(null)
    const [unconfirmedUploadStatus, setUnconfirmedUploadStatus] = useState('')
    const [unconfirmedUploadProgress, setUnconfirmedUploadProgress] = useState({ current: 0, total: 0 })
    const [unconfirmedNotFoundRecords, setUnconfirmedNotFoundRecords] = useState<string[]>([])
    const [unconfirmedUploadResults, setUnconfirmedUploadResults] = useState<any>(null)

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
                    email: email || null,
                    signatureStatus: 'Signed'
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

        // Simple format: person_id, submission_id, email (extra columns ignored)
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
                            submissionId: submissionId || null,
                            signatureStatus: 'Signed'
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
    }

    async function handleUnconfirmedFileUpload() {
        if (!selectedUnconfirmedFile) {
            setUnconfirmedUploadStatus('❌ No file selected')
            return
        }

        let rows: any[] = []

        try {
            setUnconfirmedUploadStatus('Reading file...')
            const text = await selectedUnconfirmedFile.text()

            // Parse CSV properly with papaparse
            const parsed = Papa.parse(text, {
                header: true,
                skipEmptyLines: true
            })

            rows = parsed.data as any[]

            if (rows.length === 0) {
                setUnconfirmedUploadStatus('❌ CSV file is empty')
                setUnconfirmedUploadProgress({ current: 0, total: 0 })
                return
            }

            setUnconfirmedUploadProgress({ current: 0, total: rows.length })
        } catch (error) {
            console.error('Error reading file:', error)
            setUnconfirmedUploadStatus('❌ Error reading file. Please try selecting the file again.')
            setUnconfirmedUploadProgress({ current: 0, total: 0 })
            setSelectedUnconfirmedFile(null)
            return
        }

        // Simple format: person_id, submission_id, email (extra columns ignored)
        setUnconfirmedUploadStatus('Loading all residents from database...')
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
        setUnconfirmedUploadStatus('Loading existing consents...')
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

        const existingConsentsByResident = new Map(allConsents.map(c => [c.residentId, c]))
        console.log(`=== Found ${existingConsentsByResident.size} residents with existing consents ===`)

        let processed = 0
        let newRecords = 0
        let statusUpdated = 0
        let notFound = 0
        let skippedMissingData = 0
        const errors: string[] = []

        setUnconfirmedUploadStatus('Processing unconfirmed consent records...')

        for (const row of rows) {
            const personId = row.person_id?.trim()
            const email = row.email?.trim()
            const submissionId = row.submission_id?.trim() || row.Number?.trim()

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
                    const existingConsent = existingConsentsByResident.get(foundResident.id)

                    if (existingConsent) {
                        // Update existing consent to Unconfirmed status
                        const updates: any = {
                            id: existingConsent.id,
                            signatureStatus: 'Unconfirmed'
                        }

                        if (email && !existingConsent.email) {
                            updates.email = email
                        }

                        if (submissionId && !existingConsent.submissionId) {
                            updates.submissionId = submissionId
                        }

                        await client.models.Consent.update(updates)
                        statusUpdated++
                    } else {
                        // Create new consent with Unconfirmed status
                        await client.models.Consent.create({
                            residentId: foundResident.id,
                            addressId: foundResident.addressId!,
                            recordedAt: new Date().toISOString(),
                            source: 'csv-upload',
                            email: email || null,
                            submissionId: submissionId || null,
                            signatureStatus: 'Unconfirmed'
                        })
                        await client.models.Resident.update({
                            id: foundResident.id,
                            hasSigned: true,
                            signedAt: new Date().toISOString()
                        })
                        existingConsentsByResident.set(foundResident.id, { residentId: foundResident.id })
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
            setUnconfirmedUploadProgress({ current: processed, total: rows.length })
        }

        await loadAddresses()

        const statusParts = [
            `${rows.length} rows in CSV`,
            `${newRecords} new unconfirmed consents created`,
            `${statusUpdated} existing consents updated to Unconfirmed`,
            `${notFound} not found in DB`,
            `${skippedMissingData} missing person_id`
        ]

        const finalStatus = `✅ ${statusParts.join(' | ')}`
        setUnconfirmedUploadStatus(finalStatus)
        setUnconfirmedUploadProgress({ current: 0, total: 0 })
        setUnconfirmedNotFoundRecords(errors)
        setUnconfirmedUploadResults({
            totalRows: rows.length,
            newRecords,
            statusUpdated,
            notFound,
            skippedMissingData
        })

        console.log('\n' + '='.repeat(80))
        console.log('UNCONFIRMED UPLOAD SUMMARY:')
        console.log('='.repeat(80))
        console.log(`Total rows in CSV: ${rows.length}`)
        console.log(`New unconfirmed consents created: ${newRecords}`)
        console.log(`Existing consents updated to Unconfirmed: ${statusUpdated}`)
        console.log(`Not found in database: ${notFound}`)
        console.log(`Missing person_id (skipped): ${skippedMissingData}`)
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
                        <strong>CSV Format:</strong>
                        <div style={{marginTop: 8, fontSize: '0.95em'}}>
                            Required columns: <code>person_id</code>, <code>submission_id</code>, <code>email</code>
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
                    <h3>Upload Unconfirmed Signatures (CSV)</h3>

                    <div style={{marginBottom: 16, padding: 12, backgroundColor: '#fff3cd', border: '1px solid #ffc107', borderRadius: 4}}>
                        <strong>⚠ Unconfirmed Signatures:</strong>
                        <div style={{marginTop: 8, fontSize: '0.95em'}}>
                            Required columns: <code>person_id</code>, <code>submission_id</code>, <code>email</code>
                        </div>
                        <div style={{marginTop: 8, fontSize: '0.9em', color: '#856404'}}>
                            💡 This will set signatures to "Unconfirmed" status. If a consent already exists, it will be updated to Unconfirmed. If no consent exists, a new one will be created with Unconfirmed status.
                        </div>
                    </div>

                    <input
                        type='file'
                        accept='.csv'
                        onChange={(e) => {
                            setSelectedUnconfirmedFile(e.target.files?.[0] || null)
                            setUnconfirmedNotFoundRecords([])
                            setUnconfirmedUploadResults(null)
                        }}
                        style={{marginBottom: 12}}
                    />
                    <button
                        onClick={handleUnconfirmedFileUpload}
                        disabled={!selectedUnconfirmedFile || unconfirmedUploadProgress.total > 0}
                        style={{
                            backgroundColor: selectedUnconfirmedFile && unconfirmedUploadProgress.total === 0 ? '#ffc107' : '#ccc',
                            color: '#333',
                            border: 'none',
                            padding: '8px 16px',
                            borderRadius: 4,
                            marginLeft: 12,
                            fontWeight: 'bold'
                        }}
                    >
                        Upload Unconfirmed CSV
                    </button>
                    {unconfirmedUploadProgress.total > 0 && (
                        <div style={{marginTop: 12}}>
                            <div style={{
                                width: '100%',
                                height: 24,
                                backgroundColor: '#e0e0e0',
                                borderRadius: 4,
                                overflow: 'hidden'
                            }}>
                                <div style={{
                                    width: `${(unconfirmedUploadProgress.current / unconfirmedUploadProgress.total) * 100}%`,
                                    height: '100%',
                                    backgroundColor: '#ffc107',
                                    transition: 'width 0.3s ease'
                                }}/>
                            </div>
                            <p style={{marginTop: 4, color: '#666', fontSize: 14}}>
                                Processing {unconfirmedUploadProgress.current} of {unconfirmedUploadProgress.total}
                            </p>
                        </div>
                    )}
                    {unconfirmedUploadStatus && unconfirmedUploadProgress.total === 0 && <p style={{marginTop: 8, color: '#666'}}>{unconfirmedUploadStatus}</p>}

                    {/* Display unconfirmed upload results */}
                    {unconfirmedUploadResults && (
                        <div style={{marginTop: 16, padding: 16, backgroundColor: '#fff3cd', border: '1px solid #ffc107', borderRadius: 4}}>
                            <h4>Unconfirmed Upload Summary</h4>
                            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8}}>
                                <div>Total rows in CSV: <strong>{unconfirmedUploadResults.totalRows}</strong></div>
                                <div style={{color: '#856404'}}>New unconfirmed consents: <strong>{unconfirmedUploadResults.newRecords}</strong></div>
                                <div style={{color: '#856404'}}>Status updated to Unconfirmed: <strong>{unconfirmedUploadResults.statusUpdated}</strong></div>
                                <div style={{color: '#dc3545'}}>Not found: <strong>{unconfirmedUploadResults.notFound}</strong></div>
                                <div>Missing data: <strong>{unconfirmedUploadResults.skippedMissingData}</strong></div>
                            </div>
                        </div>
                    )}

                    {/* Display not found records for unconfirmed */}
                    {unconfirmedNotFoundRecords.length > 0 && (
                        <div style={{marginTop: 16, padding: 16, backgroundColor: '#f8d7da', border: '1px solid #dc3545', borderRadius: 4}}>
                            <h4 style={{marginTop: 0, color: '#721c24'}}>⚠️ Records Not Found in Database ({unconfirmedNotFoundRecords.length})</h4>
                            <div style={{
                                maxHeight: 300,
                                overflowY: 'auto',
                                backgroundColor: 'white',
                                padding: 12,
                                borderRadius: 4,
                                border: '1px solid #ddd'
                            }}>
                                {unconfirmedNotFoundRecords.map((record, index) => (
                                    <div key={index} style={{
                                        padding: '4px 0',
                                        borderBottom: index < unconfirmedNotFoundRecords.length - 1 ? '1px solid #eee' : 'none',
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
