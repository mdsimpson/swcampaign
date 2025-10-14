import Header from '../../components/Header'
import {useState} from 'react'
import {generateClient} from 'aws-amplify/data'
import type {Schema} from '../../../amplify/data/resource'

export default function SyncPersonIds() {
    const [syncing, setSyncing] = useState(false)
    const [progress, setProgress] = useState<string>('')
    const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null)
    const [logs, setLogs] = useState<string[]>([])

    const client = generateClient<Schema>()

    function addLog(log: string) {
        setLogs(prev => [...prev, log])
        console.log(log)
    }

    async function handleSync() {
        try {
            setSyncing(true)
            setMessage(null)
            setLogs([])
            setProgress('Fetching all residents...')
            addLog('Starting sync process...')

            // Fetch all residents with pagination
            const allResidents: any[] = []
            let nextToken: string | null | undefined = null

            do {
                const result = await client.models.Resident.list({
                    limit: 1000,
                    nextToken: nextToken as string | undefined
                })

                if (result.data) {
                    allResidents.push(...result.data)
                }

                nextToken = result.nextToken
            } while (nextToken)

            addLog(`Found ${allResidents.length} total residents`)

            // Find residents that need updating
            const needsUpdate = allResidents.filter(r => {
                const hasPersonId = r.personId && r.personId.trim() !== ''
                const hasExternalId = r.externalId && r.externalId.trim() !== ''

                // Need update if one is missing but the other exists
                return (hasPersonId && !hasExternalId) || (!hasPersonId && hasExternalId)
            })

            addLog(`Found ${needsUpdate.length} residents that need syncing`)

            if (needsUpdate.length === 0) {
                setMessage({ type: 'success', text: 'All residents are already in sync!' })
                setProgress('')
                return
            }

            // Update residents
            let updated = 0
            let errors = 0

            for (const resident of needsUpdate) {
                try {
                    const hasPersonId = resident.personId && resident.personId.trim() !== ''
                    const hasExternalId = resident.externalId && resident.externalId.trim() !== ''

                    const updateData: any = { id: resident.id }

                    if (hasPersonId && !hasExternalId) {
                        // Copy personId to externalId
                        updateData.externalId = resident.personId
                        addLog(`Updating resident ${resident.id}: copying personId "${resident.personId}" to externalId`)
                    } else if (!hasPersonId && hasExternalId) {
                        // Copy externalId to personId
                        updateData.personId = resident.externalId
                        addLog(`Updating resident ${resident.id}: copying externalId "${resident.externalId}" to personId`)
                    }

                    await client.models.Resident.update(updateData)
                    updated++

                    // Update progress
                    if (updated % 10 === 0 || updated === needsUpdate.length) {
                        setProgress(`Progress: ${updated}/${needsUpdate.length}`)
                    }

                } catch (error) {
                    console.error(`Error updating resident ${resident.id}:`, error)
                    addLog(`ERROR updating resident ${resident.id}: ${error}`)
                    errors++
                }
            }

            addLog(`\nSync complete!`)
            addLog(`Successfully updated: ${updated}`)
            addLog(`Errors: ${errors}`)

            setMessage({
                type: errors > 0 ? 'error' : 'success',
                text: `Sync complete! Updated: ${updated}, Errors: ${errors}`
            })
            setProgress('')

        } catch (error) {
            console.error('Failed to sync person IDs:', error)
            addLog(`FATAL ERROR: ${error}`)
            setMessage({ type: 'error', text: 'Failed to sync person IDs. Please try again.' })
            setProgress('')
        } finally {
            setSyncing(false)
        }
    }

    return (
        <div>
            <Header/>
            <div style={{maxWidth: 1000, margin: '20px auto', padding: 12}}>
                <h2>Sync Person IDs</h2>
                <p>This tool synchronizes the <code>personId</code> and <code>externalId</code> fields for all residents.</p>

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

                    {progress && (
                        <div style={{
                            padding: '12px 16px',
                            backgroundColor: '#e7f3ff',
                            borderRadius: 4,
                            marginBottom: 16,
                            fontWeight: 'bold'
                        }}>
                            {progress}
                        </div>
                    )}

                    <div style={{marginBottom: 16}}>
                        <strong>What this does:</strong>
                        <ul style={{marginTop: 8, marginLeft: 20}}>
                            <li>If a resident has <code>personId</code> but not <code>externalId</code>, copies <code>personId</code> → <code>externalId</code></li>
                            <li>If a resident has <code>externalId</code> but not <code>personId</code>, copies <code>externalId</code> → <code>personId</code></li>
                            <li>Ensures both fields have the same value for all residents</li>
                        </ul>
                    </div>

                    <button
                        onClick={handleSync}
                        disabled={syncing}
                        style={{
                            backgroundColor: '#007bff',
                            color: 'white',
                            border: 'none',
                            padding: '12px 24px',
                            borderRadius: 4,
                            cursor: syncing ? 'not-allowed' : 'pointer',
                            fontSize: '1rem',
                            fontWeight: 'bold',
                            opacity: syncing ? 0.6 : 1
                        }}
                    >
                        {syncing ? 'Syncing...' : 'Start Sync'}
                    </button>

                    {/* Logs */}
                    {logs.length > 0 && (
                        <div style={{marginTop: 24}}>
                            <strong>Operation Log:</strong>
                            <div style={{
                                marginTop: 8,
                                padding: 12,
                                backgroundColor: '#000',
                                color: '#0f0',
                                fontFamily: 'monospace',
                                fontSize: '0.85em',
                                borderRadius: 4,
                                maxHeight: 400,
                                overflowY: 'auto'
                            }}>
                                {logs.map((log, index) => (
                                    <div key={index}>{log}</div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
