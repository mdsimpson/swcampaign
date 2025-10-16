import Header from '../../components/Header'
import {useState} from 'react'
import {generateClient} from 'aws-amplify/data'
import type {Schema} from '../../../amplify/data/resource'

export default function ExportResidents() {
    const [exporting, setExporting] = useState(false)
    const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null)

    const client = generateClient<Schema>()

    async function handleExport() {
        try {
            setExporting(true)
            setMessage(null)

            // Fetch all residents with pagination
            const allResidents: any[] = []
            let nextToken: string | null | undefined = null

            do {
                const residentsResult = await client.models.Resident.list({
                    limit: 1000,
                    nextToken: nextToken as string | undefined
                })

                if (residentsResult.data) {
                    allResidents.push(...residentsResult.data)
                }

                nextToken = residentsResult.nextToken
            } while (nextToken)

            if (allResidents.length === 0) {
                setMessage({ type: 'error', text: 'No residents found to export.' })
                return
            }

            // Fetch all addresses with pagination
            const allAddresses: any[] = []
            nextToken = null

            do {
                const addressesResult = await client.models.Address.list({
                    limit: 1000,
                    nextToken: nextToken as string | undefined
                })

                if (addressesResult.data) {
                    allAddresses.push(...addressesResult.data)
                }

                nextToken = addressesResult.nextToken
            } while (nextToken)

            const addressMap = new Map(
                allAddresses.map(addr => [addr.id, addr])
            )

            // Combine resident and address data
            const residents = allResidents
                .map(resident => {
                    const address = addressMap.get(resident.addressId)
                    // Use personId if available, otherwise fall back to externalId (deprecated field)
                    const personIdValue = resident.personId || resident.externalId || ''
                    return {
                        personId: personIdValue,
                        firstName: resident.firstName || '',
                        lastName: resident.lastName || '',
                        street: address?.street || '',
                        city: address?.city || '',
                        state: address?.state || '',
                        zip: address?.zip || '',
                        addressId: address?.externalId || '', // Use externalId (numeric) not UUID
                        contactEmail: resident.contactEmail || ''
                    }
                })
                .sort((a, b) => {
                    // Sort by personId as number (ascending)
                    const aNum = parseInt(a.personId) || 0
                    const bNum = parseInt(b.personId) || 0
                    return aNum - bNum
                })

            // Generate CSV content
            const headers = 'person_id,Occupant First Name,Occupant Last Name,Street,City,State,Zip,address_id,Contact Email'
            const rows = residents.map(r =>
                `${r.personId},"${r.firstName}","${r.lastName}","${r.street}","${r.city}","${r.state}","${r.zip}",${r.addressId},"${r.contactEmail}"`
            )
            const csvContent = [headers, ...rows].join('\n')

            // Create and download file
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
            const link = document.createElement('a')
            const url = URL.createObjectURL(blob)
            link.setAttribute('href', url)
            link.setAttribute('download', 'residents_updated.csv')
            link.style.visibility = 'hidden'
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)

            setMessage({
                type: 'success',
                text: `Successfully exported ${residents.length} residents to residents_updated.csv`
            })

        } catch (error) {
            console.error('Failed to export residents:', error)
            setMessage({ type: 'error', text: 'Failed to export residents. Please try again.' })
        } finally {
            setExporting(false)
        }
    }

    return (
        <div>
            <Header/>
            <div style={{maxWidth: 800, margin: '20px auto', padding: 12}}>
                <h2>Export Residents</h2>
                <p>Download a CSV file containing all residents with their address information.</p>

                <div style={{
                    backgroundColor: '#f8f9fa',
                    padding: 24,
                    borderRadius: 8,
                    border: '1px solid #ddd'
                }}>
                    {/* Message Display */}
                    {message && (
                        <div style={{
                            backgroundColor: message.type === 'success' ? '#d4edda' : '#f8d7da',
                            color: message.type === 'success' ? '#155724' : '#721c24',
                            padding: '12px 16px',
                            borderRadius: 4,
                            border: `1px solid ${message.type === 'success' ? '#c3e6cb' : '#f5c6cb'}`,
                            marginBottom: 16
                        }}>
                            {message.text}
                        </div>
                    )}

                    <div style={{marginBottom: 16}}>
                        <strong>File Details:</strong>
                        <ul style={{marginTop: 8, marginLeft: 20}}>
                            <li>Filename: <code>residents_updated.csv</code></li>
                            <li>Columns: person_id, Occupant First Name, Occupant Last Name, Street, City, State, Zip, address_id, Contact Email</li>
                            <li>Sorted by: person_id (ascending)</li>
                        </ul>
                    </div>

                    <button
                        onClick={handleExport}
                        disabled={exporting}
                        style={{
                            backgroundColor: '#007bff',
                            color: 'white',
                            border: 'none',
                            padding: '12px 24px',
                            borderRadius: 4,
                            cursor: exporting ? 'not-allowed' : 'pointer',
                            fontSize: '1rem',
                            fontWeight: 'bold',
                            opacity: exporting ? 0.6 : 1
                        }}
                    >
                        {exporting ? 'Exporting...' : 'Download Residents CSV'}
                    </button>
                </div>
            </div>
        </div>
    )
}
