import Header from '../../components/Header'
import { useState } from 'react'
import { generateClient } from 'aws-amplify/data'
import type { Schema } from '../../../amplify/data/resource'
import Papa from 'papaparse'

// Address abbreviation mapping
const ABBREVIATION_MAP: Record<string, string[]> = {
    'avenue': ['ave', 'av'],
    'boulevard': ['blvd', 'boul'],
    'circle': ['cir'],
    'court': ['ct'],
    'drive': ['dr'],
    'lane': ['ln'],
    'place': ['pl'],
    'road': ['rd'],
    'square': ['sq'],
    'street': ['st'],
    'terrace': ['ter'],
    'trail': ['trl'],
}

// Create reverse mapping (abbreviation -> full word)
const REVERSE_MAP: Record<string, string> = {}
Object.entries(ABBREVIATION_MAP).forEach(([full, abbrs]) => {
    abbrs.forEach(abbr => {
        REVERSE_MAP[abbr] = full
    })
    REVERSE_MAP[full] = full
})

function normalizeAddress(address: string): string {
    // Convert to lowercase and trim
    let normalized = address.toLowerCase().trim()

    // Split into parts
    const parts = normalized.split(/\s+/)

    // Normalize the last word (typically the street type)
    if (parts.length > 0) {
        const lastPart = parts[parts.length - 1]
        if (REVERSE_MAP[lastPart]) {
            parts[parts.length - 1] = REVERSE_MAP[lastPart]
        }
    }

    return parts.join(' ')
}

export default function UploadDeedData() {
    const [status, setStatus] = useState('')
    const [progress, setProgress] = useState({ current: 0, total: 0 })
    const [results, setResults] = useState<any>(null)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const client = generateClient<Schema>()

    async function handleUploadDeedData() {
        if (!selectedFile) {
            alert('Please select a CSV file first')
            return
        }

        if (!confirm('This will update the deed field for addresses in the database. Continue?')) {
            return
        }

        try {
            setStatus('Reading CSV file...')
            const text = await selectedFile.text()

            const parsed = Papa.parse(text, {
                header: true,
                skipEmptyLines: true
            })

            const rows = parsed.data as any[]
            setProgress({ current: 0, total: rows.length })
            setStatus(`Found ${rows.length} records in CSV`)

            // Load all addresses
            setStatus('Loading all addresses from database...')
            let allAddresses: any[] = []
            let nextToken = null
            do {
                const result = await client.models.Address.list({
                    limit: 1000,
                    nextToken: nextToken
                })
                allAddresses.push(...result.data)
                nextToken = result.nextToken
            } while (nextToken)

            setStatus(`Loaded ${allAddresses.length} addresses. Processing deed data...`)

            // Create a map of normalized street -> address for faster lookup
            const addressByNormalizedStreet = new Map<string, any>()
            allAddresses.forEach(addr => {
                if (addr.street) {
                    const normalized = normalizeAddress(addr.street)
                    addressByNormalizedStreet.set(normalized, addr)
                }
            })

            let processed = 0
            let updated = 0
            let addressNotFound = 0
            let skipped = 0
            const updatedList: any[] = []
            const notFoundList: any[] = []
            const skippedList: any[] = []

            for (const row of rows) {
                const mailingAddress = row['Mailing Address']?.trim()
                const deedName = row['Name']?.trim()

                if (!mailingAddress || !deedName) {
                    skipped++
                    skippedList.push({
                        mailingAddress: mailingAddress || 'N/A',
                        deedName: deedName || 'N/A',
                        reason: 'Missing Mailing Address or Name field'
                    })
                    processed++
                    continue
                }

                try {
                    // Find address by normalized street
                    const normalizedMailingAddress = normalizeAddress(mailingAddress)
                    const address = addressByNormalizedStreet.get(normalizedMailingAddress)

                    if (address) {
                        // Update the address with deed data
                        await client.models.Address.update({
                            id: address.id,
                            deed: deedName
                        })

                        updated++
                        updatedList.push({
                            street: address.street,
                            deedName: deedName
                        })
                        console.log(`✅ Updated: ${address.street} -> ${deedName}`)
                    } else {
                        addressNotFound++
                        notFoundList.push({
                            mailingAddress: mailingAddress,
                            normalizedAddress: normalizedMailingAddress,
                            deedName: deedName
                        })
                        console.log(`⚠️  Address not found: ${mailingAddress} (normalized: ${normalizedMailingAddress})`)
                    }
                } catch (err) {
                    skipped++
                    skippedList.push({
                        mailingAddress: mailingAddress,
                        deedName: deedName,
                        reason: String(err)
                    })
                    console.error(`❌ Error updating ${mailingAddress}:`, err)
                }

                processed++
                setProgress({ current: processed, total: rows.length })
                setStatus(`Processing... ${processed}/${rows.length}`)
            }

            setResults({
                total: rows.length,
                updated,
                addressNotFound,
                skipped,
                updatedList,
                notFoundList,
                skippedList
            })

            setStatus(`✅ Complete! Updated ${updated}, Address not found ${addressNotFound}, Skipped ${skipped}`)
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
                <h2>Upload Deed Data</h2>
                <p style={{ color: '#666', marginBottom: 24 }}>
                    Upload the parcel_data.csv file to update deed holder information for addresses in the database.
                    The file should have columns: Mailing Address, Name
                </p>

                <div style={{
                    backgroundColor: '#d1ecf1',
                    border: '1px solid #bee5eb',
                    borderRadius: 8,
                    padding: 16,
                    marginBottom: 24
                }}>
                    <h3 style={{ color: '#0c5460', marginTop: 0 }}>ℹ️ How it works</h3>
                    <ul style={{ color: '#0c5460', marginBottom: 0 }}>
                        <li>The Mailing Address column is matched to existing addresses in the database</li>
                        <li>Matching is case-insensitive and handles common abbreviations (Pl/Place, Dr/Drive, Ct/Court, etc.)</li>
                        <li>The Name column will be stored in the deed field for each matching address</li>
                        <li>There should be exactly one match in the database for each entry in the CSV</li>
                    </ul>
                </div>

                <div style={{
                    backgroundColor: '#f8f9fa',
                    padding: 16,
                    borderRadius: 8,
                    marginBottom: 24
                }}>
                    <h3>Upload Parcel Data CSV</h3>
                    <p style={{ fontSize: '14px', color: '#666' }}>
                        CSV should have columns: Mailing Address, Name
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
                        onClick={handleUploadDeedData}
                        disabled={!selectedFile || progress.total > 0}
                        style={{
                            backgroundColor: selectedFile && progress.total === 0 ? '#007bff' : '#6c757d',
                            color: 'white',
                            border: 'none',
                            padding: '12px 24px',
                            borderRadius: 4,
                            cursor: selectedFile && progress.total === 0 ? 'pointer' : 'not-allowed',
                            fontSize: '16px',
                            fontWeight: 'bold'
                        }}
                    >
                        Upload Deed Data
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
                                <div style={{ color: '#28a745', fontWeight: 'bold' }}>✅ Updated: {results.updated}</div>
                                <div style={{ color: '#ffc107', fontWeight: 'bold' }}>⚠️ Address not found: {results.addressNotFound}</div>
                                <div style={{ color: '#dc3545', fontWeight: 'bold' }}>❌ Skipped: {results.skipped}</div>
                            </div>
                        </div>

                        {results.updatedList.length > 0 && (
                            <div style={{ marginBottom: 24 }}>
                                <h3 style={{ color: '#28a745' }}>✅ Updated ({results.updatedList.length})</h3>
                                <div style={{ border: '1px solid #ddd', borderRadius: 4, padding: 16, maxHeight: 300, overflowY: 'auto' }}>
                                    {results.updatedList.map((item: any, index: number) => (
                                        <div key={index} style={{ padding: '4px 0' }}>
                                            • {item.street} → {item.deedName}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {results.notFoundList.length > 0 && (
                            <div style={{ marginBottom: 24 }}>
                                <h3 style={{ color: '#ffc107' }}>⚠️ Address Not Found ({results.notFoundList.length})</h3>
                                <div style={{ border: '1px solid #ddd', borderRadius: 4, padding: 16, maxHeight: 300, overflowY: 'auto' }}>
                                    {results.notFoundList.map((item: any, index: number) => (
                                        <div key={index} style={{ padding: '4px 0' }}>
                                            • CSV Address: {item.mailingAddress} (Normalized: {item.normalizedAddress})
                                            <br />
                                            &nbsp;&nbsp;Deed Name: {item.deedName}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {results.skippedList.length > 0 && (
                            <div style={{ marginBottom: 24 }}>
                                <h3 style={{ color: '#dc3545' }}>❌ Skipped ({results.skippedList.length})</h3>
                                <div style={{ border: '1px solid #ddd', borderRadius: 4, padding: 16, maxHeight: 300, overflowY: 'auto' }}>
                                    {results.skippedList.map((item: any, index: number) => (
                                        <div key={index} style={{ padding: '4px 0' }}>
                                            • {item.mailingAddress} - {item.reason}
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
