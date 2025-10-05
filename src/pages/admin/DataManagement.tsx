import Header from '../../components/Header'
import { useState } from 'react'
import { generateClient } from 'aws-amplify/data'
import type { Schema } from '../../../amplify/data/resource'
import { parse } from 'csv-parse/sync'
import fs from 'node:fs'

export default function DataManagement() {
    const [status, setStatus] = useState('')
    const [progress, setProgress] = useState({ current: 0, total: 0 })
    const [stats, setStats] = useState({ residents: 0, addresses: 0, consents: 0 })
    const client = generateClient<Schema>()

    async function getStats() {
        setStatus('Loading statistics...')
        try {
            const [residents, addresses, consents] = await Promise.all([
                client.models.Resident.list({ limit: 1000 }),
                client.models.Address.list({ limit: 1000 }),
                client.models.Consent.list({ limit: 1000 })
            ])
            setStats({
                residents: residents.data.length,
                addresses: addresses.data.length,
                consents: consents.data.length
            })
            setStatus('Statistics loaded')
        } catch (error) {
            console.error('Error loading stats:', error)
            setStatus('Error loading statistics')
        }
    }

    async function deleteAllData() {
        if (!confirm('⚠️ WARNING: This will DELETE ALL residents, addresses, and consents from production! Are you sure?')) {
            return
        }

        try {
            setStatus('Deleting all data...')

            // Delete consents first
            setStatus('Deleting consents...')
            let consentsNextToken = null
            let deletedConsents = 0
            do {
                const consents = await client.models.Consent.list({ limit: 100, nextToken: consentsNextToken })
                for (const consent of consents.data) {
                    await client.models.Consent.delete({ id: consent.id })
                    deletedConsents++
                }
                consentsNextToken = consents.nextToken
                setProgress({ current: deletedConsents, total: deletedConsents })
            } while (consentsNextToken)

            // Delete assignments
            setStatus('Deleting assignments...')
            let assignmentsNextToken = null
            let deletedAssignments = 0
            do {
                const assignments = await client.models.Assignment.list({ limit: 100, nextToken: assignmentsNextToken })
                for (const assignment of assignments.data) {
                    await client.models.Assignment.delete({ id: assignment.id })
                    deletedAssignments++
                }
                assignmentsNextToken = assignments.nextToken
            } while (assignmentsNextToken)

            // Delete residents
            setStatus('Deleting residents...')
            let residentsNextToken = null
            let deletedResidents = 0
            do {
                const residents = await client.models.Resident.list({ limit: 100, nextToken: residentsNextToken })
                for (const resident of residents.data) {
                    await client.models.Resident.delete({ id: resident.id })
                    deletedResidents++
                    if (deletedResidents % 50 === 0) {
                        setProgress({ current: deletedResidents, total: deletedResidents })
                    }
                }
                residentsNextToken = residents.nextToken
            } while (residentsNextToken)

            // Delete addresses
            setStatus('Deleting addresses...')
            let addressesNextToken = null
            let deletedAddresses = 0
            do {
                const addresses = await client.models.Address.list({ limit: 100, nextToken: addressesNextToken })
                for (const address of addresses.data) {
                    await client.models.Address.delete({ id: address.id })
                    deletedAddresses++
                    if (deletedAddresses % 50 === 0) {
                        setProgress({ current: deletedAddresses, total: deletedAddresses })
                    }
                }
                addressesNextToken = addresses.nextToken
            } while (addressesNextToken)

            setStatus(`✅ Deleted all data! (${deletedConsents} consents, ${deletedAssignments} assignments, ${deletedResidents} residents, ${deletedAddresses} addresses)`)
            setProgress({ current: 0, total: 0 })
            await getStats()
        } catch (error) {
            console.error('Error deleting data:', error)
            setStatus(`❌ Error: ${error}`)
        }
    }

    async function importFromResidents2() {
        if (!confirm('Import addresses and residents from residents2.csv?')) {
            return
        }

        try {
            setStatus('NOTE: File upload from browser not supported. Use the script: npm run import:current')
            alert('To import residents2.csv, run this command in your terminal:\n\nnpm run import:current\n\nThis page can only delete data.')
        } catch (error) {
            console.error('Error:', error)
            setStatus(`❌ Error: ${error}`)
        }
    }

    return (
        <div>
            <Header />
            <div style={{ maxWidth: 800, margin: '20px auto', padding: 16 }}>
                <h2>Data Management (Admin Only)</h2>
                <p style={{ color: '#dc3545', fontWeight: 'bold' }}>
                    ⚠️ WARNING: These operations affect production data!
                </p>

                <div style={{
                    backgroundColor: '#f8f9fa',
                    padding: 16,
                    borderRadius: 8,
                    marginBottom: 24
                }}>
                    <h3>Current Statistics</h3>
                    <button
                        onClick={getStats}
                        style={{
                            backgroundColor: '#007bff',
                            color: 'white',
                            border: 'none',
                            padding: '8px 16px',
                            borderRadius: 4,
                            cursor: 'pointer',
                            marginBottom: 16
                        }}
                    >
                        Refresh Stats
                    </button>
                    <div style={{ fontSize: '1.1em' }}>
                        <div>📍 Addresses: <strong>{stats.addresses}</strong></div>
                        <div>👥 Residents: <strong>{stats.residents}</strong></div>
                        <div>✍️ Consents: <strong>{stats.consents}</strong></div>
                    </div>
                </div>

                <div style={{
                    backgroundColor: '#fff3cd',
                    padding: 16,
                    borderRadius: 8,
                    marginBottom: 24
                }}>
                    <h3>Delete All Data</h3>
                    <p>This will delete ALL residents, addresses, consents, and assignments from production.</p>
                    <button
                        onClick={deleteAllData}
                        style={{
                            backgroundColor: '#dc3545',
                            color: 'white',
                            border: 'none',
                            padding: '12px 24px',
                            borderRadius: 4,
                            cursor: 'pointer',
                            fontSize: '1.1em',
                            fontWeight: 'bold'
                        }}
                    >
                        🗑️ Delete All Data
                    </button>
                </div>

                <div style={{
                    backgroundColor: '#d1ecf1',
                    padding: 16,
                    borderRadius: 8,
                    marginBottom: 24
                }}>
                    <h3>Import from residents2.csv</h3>
                    <p>After deleting, import fresh data from residents2.csv using the terminal:</p>
                    <code style={{
                        display: 'block',
                        backgroundColor: '#000',
                        color: '#0f0',
                        padding: 12,
                        borderRadius: 4,
                        marginTop: 8
                    }}>
                        npm run import:current
                    </code>
                </div>

                {status && (
                    <div style={{
                        backgroundColor: '#e9ecef',
                        padding: 16,
                        borderRadius: 8,
                        marginTop: 16
                    }}>
                        <strong>Status:</strong> {status}
                        {progress.total > 0 && (
                            <div style={{ marginTop: 8 }}>
                                Progress: {progress.current} items processed
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
