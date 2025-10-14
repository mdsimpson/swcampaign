import Header from '../../components/Header'
import {useState} from 'react'
import {generateClient} from 'aws-amplify/data'
import type {Schema} from '../../../amplify/data/resource'

export default function ExportSigned() {
    const [exporting, setExporting] = useState(false)
    const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null)

    const client = generateClient<Schema>()

    async function handleExport() {
        try {
            setExporting(true)
            setMessage(null)

            // Fetch all consents with pagination
            const allConsents: any[] = []
            let nextToken: string | null | undefined = null

            do {
                const consentsResult = await client.models.Consent.list({
                    limit: 1000,
                    nextToken: nextToken as string | undefined
                })

                if (consentsResult.data) {
                    allConsents.push(...consentsResult.data)
                }

                nextToken = consentsResult.nextToken
            } while (nextToken)

            if (allConsents.length === 0) {
                setMessage({ type: 'error', text: 'No consents found to export.' })
                return
            }

            // Fetch all residents with pagination
            const allResidents: any[] = []
            nextToken = null

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

            const residentMap = new Map(
                allResidents.map(r => [r.id, r])
            )

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

            // Build export data
            const exportData = allConsents
                .map(consent => {
                    const resident = residentMap.get(consent.residentId)
                    if (!resident) return null

                    const address = addressMap.get(consent.addressId)
                    if (!address) return null

                    return {
                        firstName: resident.firstName || '',
                        lastName: resident.lastName || '',
                        street: address.street || '',
                        city: address.city || '',
                        state: address.state || '',
                        zip: address.zip || '',
                        personId: resident.personId || resident.externalId || '',
                        addressId: address.externalId || '',
                        deed: address.deed || '',
                        submissionId: consent.submissionId || ''
                    }
                })
                .filter(record => record !== null)
                .sort((a, b) => {
                    // Sort by personId ascending
                    const aId = a!.personId
                    const bId = b!.personId
                    if (aId < bId) return -1
                    if (aId > bId) return 1
                    return 0
                })

            // Generate CSV content
            const headers = 'First Name,Last Name,Street,City,State,Zip,person_id,address_id,Deed,submission_id'
            const rows = exportData.map(r =>
                `"${r!.firstName}","${r!.lastName}","${r!.street}","${r!.city}","${r!.state}","${r!.zip}",${r!.personId},${r!.addressId},"${r!.deed}",${r!.submissionId}`
            )
            const csvContent = [headers, ...rows].join('\n')

            // Create and download file
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
            const link = document.createElement('a')
            const url = URL.createObjectURL(blob)
            link.setAttribute('href', url)
            link.setAttribute('download', 'signed_consents.csv')
            link.style.visibility = 'hidden'
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)

            setMessage({
                type: 'success',
                text: `Successfully exported ${exportData.length} signed consents to signed_consents.csv`
            })

        } catch (error) {
            console.error('Failed to export signed consents:', error)
            setMessage({ type: 'error', text: 'Failed to export signed consents. Please try again.' })
        } finally {
            setExporting(false)
        }
    }

    return (
        <div>
            <Header/>
            <div style={{maxWidth: 800, margin: '20px auto', padding: 12}}>
                <h2>Export Signed Consents</h2>
                <p>Download a CSV file containing all residents who have signed consent forms.</p>

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
                            <li>Filename: <code>signed_consents.csv</code></li>
                            <li>Columns: First Name, Last Name, Street, City, State, Zip, person_id, address_id, Deed, submission_id</li>
                            <li>Sorted by: person_id (ascending)</li>
                            <li>Includes: All residents with consent records</li>
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
                        {exporting ? 'Exporting...' : 'Download Signed Consents CSV'}
                    </button>
                </div>
            </div>
        </div>
    )
}
