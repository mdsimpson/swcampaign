import Header from '../../components/Header'
import { useState } from 'react'
import { generateClient } from 'aws-amplify/data'
import type { Schema } from '../../../amplify/data/resource'

export default function ExportUnsigned() {
    const [status, setStatus] = useState('')
    const [loading, setLoading] = useState(false)
    const [stats, setStats] = useState<any>(null)
    const client = generateClient<Schema>()

    async function handleExport() {
        try {
            setLoading(true)
            setStatus('Loading residents from database...')

            // Load all residents
            let allResidents: any[] = []
            let residentsToken = null
            do {
                const result = await client.models.Resident.list({
                    limit: 1000,
                    nextToken: residentsToken
                })
                allResidents.push(...result.data)
                residentsToken = result.nextToken
            } while (residentsToken)

            setStatus(`Loaded ${allResidents.length} residents. Loading consents...`)

            // Load all consents
            let allConsents: any[] = []
            let consentsToken = null
            do {
                const result = await client.models.Consent.list({
                    limit: 1000,
                    nextToken: consentsToken
                })
                allConsents.push(...result.data)
                consentsToken = result.nextToken
            } while (consentsToken)

            setStatus(`Loaded ${allConsents.length} consents. Loading addresses...`)

            // Load all addresses
            let allAddresses: any[] = []
            let addressesToken = null
            do {
                const result = await client.models.Address.list({
                    limit: 1000,
                    nextToken: addressesToken
                })
                allAddresses.push(...result.data)
                addressesToken = result.nextToken
            } while (addressesToken)

            setStatus(`Loaded ${allAddresses.length} addresses. Processing...`)

            // Create a Set of resident IDs who have signed
            const signedResidentIds = new Set(allConsents.map(c => c.residentId))

            // Filter residents who have NOT signed
            const unsignedResidents = allResidents.filter(r => !signedResidentIds.has(r.id))

            // Create a map of addressId -> address for quick lookup
            const addressMap = new Map()
            allAddresses.forEach(addr => {
                addressMap.set(addr.id, addr)
            })

            // Build CSV data
            const headers = ['first_name', 'last_name', 'street', 'city', 'state', 'zip']
            const rows = [headers]

            unsignedResidents.forEach(resident => {
                const address = addressMap.get(resident.addressId)
                rows.push([
                    resident.firstName || '',
                    resident.lastName || '',
                    address?.street || '',
                    address?.city || '',
                    address?.state || '',
                    address?.zip || ''
                ])
            })

            // Convert to CSV string
            const csvContent = rows.map(row =>
                row.map(cell => {
                    const cellStr = String(cell)
                    // Escape quotes and wrap in quotes if contains comma, quote, or newline
                    if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
                        return `"${cellStr.replace(/"/g, '""')}"`
                    }
                    return cellStr
                }).join(',')
            ).join('\n')

            // Create download
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
            const link = document.createElement('a')
            const url = URL.createObjectURL(blob)
            link.setAttribute('href', url)
            link.setAttribute('download', `unsigned-residents-${new Date().toISOString().split('T')[0]}.csv`)
            link.style.visibility = 'hidden'
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)

            setStats({
                totalResidents: allResidents.length,
                totalSigned: allResidents.length - unsignedResidents.length,
                totalUnsigned: unsignedResidents.length
            })

            setStatus(`✅ Downloaded ${unsignedResidents.length} unsigned residents`)
            setLoading(false)

        } catch (error) {
            console.error('Error:', error)
            setStatus(`❌ Error: ${error}`)
            setLoading(false)
        }
    }

    return (
        <div>
            <Header />
            <div style={{ maxWidth: 1200, margin: '20px auto', padding: 16 }}>
                <h2>Export Unsigned Residents</h2>
                <p style={{ color: '#666', marginBottom: 24 }}>
                    Download a CSV file of all residents who have NOT signed a consent.
                </p>

                <div style={{
                    backgroundColor: '#d1ecf1',
                    border: '1px solid #bee5eb',
                    borderRadius: 8,
                    padding: 16,
                    marginBottom: 24
                }}>
                    <h3 style={{ color: '#0c5460', marginTop: 0 }}>ℹ️ Export Format</h3>
                    <p style={{ color: '#0c5460', marginBottom: 8 }}>
                        The exported CSV will contain the following columns:
                    </p>
                    <ul style={{ color: '#0c5460', marginBottom: 0 }}>
                        <li>first_name</li>
                        <li>last_name</li>
                        <li>street</li>
                        <li>city</li>
                        <li>state</li>
                        <li>zip</li>
                    </ul>
                </div>

                <div style={{
                    backgroundColor: '#f8f9fa',
                    padding: 16,
                    borderRadius: 8,
                    marginBottom: 24
                }}>
                    <button
                        onClick={handleExport}
                        disabled={loading}
                        style={{
                            backgroundColor: !loading ? '#007bff' : '#6c757d',
                            color: 'white',
                            border: 'none',
                            padding: '12px 24px',
                            borderRadius: 4,
                            cursor: !loading ? 'pointer' : 'not-allowed',
                            fontSize: '16px',
                            fontWeight: 'bold'
                        }}
                    >
                        {loading ? 'Exporting...' : 'Download Unsigned Residents CSV'}
                    </button>
                </div>

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

                {stats && (
                    <div style={{
                        backgroundColor: '#d4edda',
                        border: '1px solid #28a745',
                        borderRadius: 8,
                        padding: 16,
                        marginBottom: 24
                    }}>
                        <h3 style={{ color: '#155724', marginTop: 0 }}>Export Summary</h3>
                        <div style={{ fontSize: '16px', lineHeight: '1.8' }}>
                            <div><strong>Total Residents:</strong> {stats.totalResidents}</div>
                            <div style={{ color: '#28a745' }}><strong>✅ Signed:</strong> {stats.totalSigned}</div>
                            <div style={{ color: '#dc3545' }}><strong>❌ Unsigned:</strong> {stats.totalUnsigned}</div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
