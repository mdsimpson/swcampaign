import Header from '../../components/Header'
import { useState } from 'react'
import { generateClient } from 'aws-amplify/data'
import type { Schema } from '../../../amplify/data/resource'
import Papa from 'papaparse'

export default function MoveFormerOwners() {
    const [status, setStatus] = useState('')
    const [progress, setProgress] = useState({ current: 0, total: 0 })
    const [results, setResults] = useState<any>(null)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const client = generateClient<Schema>()

    async function handleMoveFormerOwners() {
        if (!selectedFile) {
            alert('Please select the former_owners.csv file first')
            return
        }

        if (!confirm('⚠️ WARNING: This will MOVE former owners from Residents table to FormerResidents table. They will be hidden from the application. Continue?')) {
            return
        }

        try {
            setStatus('Reading CSV file...')
            const text = await selectedFile.text()

            const parsed = Papa.parse(text, {
                header: true,
                skipEmptyLines: true
            })

            const formerOwners = parsed.data as any[]
            setProgress({ current: 0, total: formerOwners.length })
            setStatus(`Found ${formerOwners.length} former owners in CSV`)

            // Load all residents
            setStatus('Loading all residents from database...')
            let allResidents: any[] = []
            let nextToken = null
            do {
                const result = await client.models.Resident.list({
                    limit: 1000,
                    nextToken: nextToken
                })
                allResidents.push(...result.data)
                nextToken = result.nextToken
            } while (nextToken)

            setStatus(`Loaded ${allResidents.length} residents. Processing moves...`)

            let processed = 0
            let moved = 0
            let notFound = 0
            let errors = 0
            const movedList: any[] = []
            const notFoundList: any[] = []
            const errorList: any[] = []

            for (const owner of formerOwners) {
                const personId = owner.person_id?.trim()
                const firstName = owner['Occupant First Name']?.trim()
                const lastName = owner['Occupant Last Name']?.trim()

                if (!personId || !firstName || !lastName) {
                    processed++
                    continue
                }

                try {
                    // Find resident by externalId
                    const resident = allResidents.find(r => r.externalId === personId)

                    if (resident) {
                        // Create record in FormerResident table
                        await client.models.FormerResident.create({
                            personId: resident.personId,
                            externalId: resident.externalId,
                            addressId: resident.addressId,
                            firstName: resident.firstName,
                            lastName: resident.lastName,
                            occupantType: resident.occupantType,
                            contactEmail: resident.contactEmail,
                            additionalEmail: resident.additionalEmail,
                            cellPhone: resident.cellPhone,
                            cellPhoneAlert: resident.cellPhoneAlert,
                            unitPhone: resident.unitPhone,
                            workPhone: resident.workPhone,
                            isAbsentee: resident.isAbsentee,
                            hasSigned: resident.hasSigned,
                            signedAt: resident.signedAt,
                            movedAt: new Date().toISOString(),
                            movedReason: 'former_owner'
                        })

                        // Delete from Resident table
                        await client.models.Resident.delete({ id: resident.id })

                        moved++
                        movedList.push({ personId, name: `${firstName} ${lastName}` })
                        console.log(`✅ Moved: ${firstName} ${lastName} (ID: ${personId})`)
                    } else {
                        notFound++
                        notFoundList.push({ personId, name: `${firstName} ${lastName}` })
                        console.log(`⚠️  Not found: ${firstName} ${lastName} (ID: ${personId})`)
                    }
                } catch (err) {
                    errors++
                    errorList.push({ personId, name: `${firstName} ${lastName}`, error: String(err) })
                    console.error(`❌ Error moving ${firstName} ${lastName}:`, err)
                }

                processed++
                setProgress({ current: processed, total: formerOwners.length })
                setStatus(`Processing... ${processed}/${formerOwners.length}`)
            }

            setResults({
                total: formerOwners.length,
                moved,
                notFound,
                errors,
                movedList,
                notFoundList,
                errorList
            })

            setStatus(`✅ Complete! Moved ${moved}, Not found ${notFound}, Errors ${errors}`)
            setProgress({ current: 0, total: 0 })

        } catch (error) {
            console.error('Error:', error)
            setStatus(`❌ Error: ${error}`)
            setProgress({ current: 0, total: 0 })
        }
    }

    return (
        <div>
            <Header />
            <div style={{ maxWidth: 1200, margin: '20px auto', padding: 16 }}>
                <h2>Move Former Owners</h2>
                <p style={{ color: '#666', marginBottom: 24 }}>
                    Upload the former_owners.csv file to move these residents from the active Residents table
                    to the FormerResidents table. They will be hidden from the application but data is preserved.
                </p>

                <div style={{
                    backgroundColor: '#fff3cd',
                    border: '1px solid #ffc107',
                    borderRadius: 8,
                    padding: 16,
                    marginBottom: 24
                }}>
                    <h3 style={{ color: '#856404', marginTop: 0 }}>⚠️ Warning</h3>
                    <p style={{ color: '#856404', marginBottom: 0 }}>
                        This operation will MOVE residents to a separate table. They will no longer appear
                        in the main application, reports, or canvassing pages. The data is preserved and can
                        be restored if needed.
                    </p>
                </div>

                <div style={{
                    backgroundColor: '#f8f9fa',
                    padding: 16,
                    borderRadius: 8,
                    marginBottom: 24
                }}>
                    <h3>Upload Former Owners CSV</h3>
                    <p style={{ fontSize: '14px', color: '#666' }}>
                        CSV should have columns: person_id, Occupant First Name, Occupant Last Name
                    </p>

                    <input
                        type="file"
                        accept=".csv"
                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                        style={{ marginBottom: 16, display: 'block' }}
                    />

                    {selectedFile && (
                        <div style={{ color: '#28a745', marginBottom: 16 }}>
                            ✓ Selected: {selectedFile.name}
                        </div>
                    )}

                    <button
                        onClick={handleMoveFormerOwners}
                        disabled={!selectedFile || progress.total > 0}
                        style={{
                            backgroundColor: selectedFile && progress.total === 0 ? '#dc3545' : '#6c757d',
                            color: 'white',
                            border: 'none',
                            padding: '12px 24px',
                            borderRadius: 4,
                            cursor: selectedFile && progress.total === 0 ? 'pointer' : 'not-allowed',
                            fontSize: '16px',
                            fontWeight: 'bold'
                        }}
                    >
                        Move Former Owners
                    </button>
                </div>

                {progress.total > 0 && (
                    <div style={{
                        backgroundColor: '#e9ecef',
                        padding: 16,
                        borderRadius: 8,
                        marginBottom: 16
                    }}>
                        <div style={{
                            width: '100%',
                            height: 24,
                            backgroundColor: '#ddd',
                            borderRadius: 4,
                            overflow: 'hidden',
                            marginBottom: 8
                        }}>
                            <div style={{
                                width: `${(progress.current / progress.total) * 100}%`,
                                height: '100%',
                                backgroundColor: '#007bff',
                                transition: 'width 0.3s ease'
                            }}/>
                        </div>
                        <div style={{ fontSize: '14px' }}>
                            Progress: {progress.current} / {progress.total} ({Math.round((progress.current / progress.total) * 100)}%)
                        </div>
                    </div>
                )}

                {status && (
                    <div style={{
                        backgroundColor: '#e9ecef',
                        padding: 12,
                        borderRadius: 4,
                        marginBottom: 16,
                        fontSize: '14px'
                    }}>
                        {status}
                    </div>
                )}

                {results && (
                    <div>
                        <div style={{
                            backgroundColor: '#d4edda',
                            border: '1px solid #28a745',
                            borderRadius: 8,
                            padding: 16,
                            marginBottom: 24
                        }}>
                            <h3 style={{ color: '#155724', marginTop: 0 }}>Summary</h3>
                            <div style={{ fontSize: '16px', lineHeight: '1.8' }}>
                                <div><strong>Total in CSV:</strong> {results.total}</div>
                                <div style={{ color: '#28a745', fontWeight: 'bold' }}>✅ Moved: {results.moved}</div>
                                <div style={{ color: '#ffc107', fontWeight: 'bold' }}>⚠️ Not found: {results.notFound}</div>
                                <div style={{ color: '#dc3545', fontWeight: 'bold' }}>❌ Errors: {results.errors}</div>
                            </div>
                        </div>

                        {results.movedList.length > 0 && (
                            <div style={{ marginBottom: 24 }}>
                                <h3 style={{ color: '#28a745' }}>✅ Moved to FormerResidents ({results.movedList.length})</h3>
                                <div style={{ border: '1px solid #ddd', borderRadius: 4, padding: 16, maxHeight: 300, overflowY: 'auto' }}>
                                    {results.movedList.map((person: any, index: number) => (
                                        <div key={index} style={{ padding: '4px 0' }}>
                                            • {person.name} (ID: {person.personId})
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {results.notFoundList.length > 0 && (
                            <div style={{ marginBottom: 24 }}>
                                <h3 style={{ color: '#ffc107' }}>⚠️ Not Found in Database ({results.notFoundList.length})</h3>
                                <div style={{ border: '1px solid #ddd', borderRadius: 4, padding: 16, maxHeight: 300, overflowY: 'auto' }}>
                                    {results.notFoundList.map((person: any, index: number) => (
                                        <div key={index} style={{ padding: '4px 0' }}>
                                            • {person.name} (ID: {person.personId})
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {results.errorList.length > 0 && (
                            <div style={{ marginBottom: 24 }}>
                                <h3 style={{ color: '#dc3545' }}>❌ Errors ({results.errorList.length})</h3>
                                <div style={{ border: '1px solid #ddd', borderRadius: 4, padding: 16, maxHeight: 300, overflowY: 'auto' }}>
                                    {results.errorList.map((person: any, index: number) => (
                                        <div key={index} style={{ padding: '4px 0' }}>
                                            • {person.name} (ID: {person.personId}): {person.error}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
