import Header from '../../components/Header'
import {useEffect, useState} from 'react'
import {generateClient} from 'aws-amplify/data'
import type {Schema} from '../../../amplify/data/resource'
import {getCurrentUser} from 'aws-amplify/auth'

export default function SetDataDate() {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [dataDate, setDataDate] = useState('')
    const [configId, setConfigId] = useState<string | null>(null)
    const [currentUserSub, setCurrentUserSub] = useState<string>('')
    const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null)

    const client = generateClient<Schema>()

    useEffect(() => {
        getCurrentUserSub()
        loadDataDate()
    }, [])

    async function getCurrentUserSub() {
        try {
            const user = await getCurrentUser()
            setCurrentUserSub(user.userId)
        } catch (error) {
            console.error('Failed to get current user:', error)
        }
    }

    async function loadDataDate() {
        try {
            setLoading(true)

            // Look for existing config with key "dataAsOfDate"
            const result = await client.models.SystemConfig.list({
                filter: {
                    configKey: {
                        eq: 'dataAsOfDate'
                    }
                }
            })

            if (result.data.length > 0) {
                const config = result.data[0]
                setConfigId(config.id)
                setDataDate(config.configValue || '')
            }

        } catch (error) {
            console.error('Failed to load data date:', error)
        } finally {
            setLoading(false)
        }
    }

    async function handleSave() {
        try {
            setSaving(true)
            setMessage(null)

            if (configId) {
                // Update existing config
                await client.models.SystemConfig.update({
                    id: configId,
                    configValue: dataDate.trim() || null,
                    updatedAt: new Date().toISOString(),
                    updatedBy: currentUserSub
                })
            } else {
                // Create new config
                const result = await client.models.SystemConfig.create({
                    configKey: 'dataAsOfDate',
                    configValue: dataDate.trim() || null,
                    updatedAt: new Date().toISOString(),
                    updatedBy: currentUserSub
                })

                if (result.data) {
                    setConfigId(result.data.id)
                }
            }

            setMessage({ type: 'success', text: 'Data date updated successfully!' })
        } catch (error) {
            console.error('Failed to save data date:', error)
            setMessage({ type: 'error', text: 'Failed to save data date. Please try again.' })
        } finally {
            setSaving(false)
        }
    }

    return (
        <div>
            <Header/>
            <div style={{maxWidth: 800, margin: '20px auto', padding: 12}}>
                <h2>Set Data Date</h2>
                <p>Set the "Data as of" date that will be displayed in the header for all users.</p>

                {loading ? (
                    <div style={{textAlign: 'center', padding: 40, color: '#666'}}>
                        Loading...
                    </div>
                ) : (
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
                            <label style={{display: 'block', marginBottom: 8, fontWeight: 'bold'}}>
                                Data Date:
                            </label>
                            <input
                                type="date"
                                value={dataDate}
                                onChange={(e) => setDataDate(e.target.value)}
                                style={{
                                    padding: 8,
                                    borderRadius: 4,
                                    border: '1px solid #ddd',
                                    width: 200,
                                    fontSize: '1rem'
                                }}
                            />
                        </div>

                        <div style={{marginBottom: 16, color: '#666', fontSize: '0.9em'}}>
                            <strong>Preview:</strong> Data as of {dataDate ? (() => {
                                const [year, month, day] = dataDate.split('-').map(Number)
                                const shortYear = year % 100
                                return `${month}/${day}/${shortYear}`
                            })() : '(no date set)'}
                        </div>

                        <div style={{display: 'flex', gap: 12}}>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                style={{
                                    backgroundColor: '#28a745',
                                    color: 'white',
                                    border: 'none',
                                    padding: '10px 20px',
                                    borderRadius: 4,
                                    cursor: saving ? 'not-allowed' : 'pointer',
                                    fontSize: '1rem',
                                    opacity: saving ? 0.6 : 1
                                }}
                            >
                                {saving ? 'Saving...' : 'Save Date'}
                            </button>

                            {dataDate && (
                                <button
                                    onClick={() => setDataDate('')}
                                    disabled={saving}
                                    style={{
                                        backgroundColor: '#6c757d',
                                        color: 'white',
                                        border: 'none',
                                        padding: '10px 20px',
                                        borderRadius: 4,
                                        cursor: saving ? 'not-allowed' : 'pointer',
                                        fontSize: '1rem',
                                        opacity: saving ? 0.6 : 1
                                    }}
                                >
                                    Clear Date
                                </button>
                            )}
                        </div>

                        <div style={{marginTop: 16, padding: 12, backgroundColor: '#fff3cd', borderRadius: 4, border: '1px solid #ffeaa7'}}>
                            <strong>Note:</strong> If you leave the date blank and save, the "Data as of" text will not be displayed in the header.
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
