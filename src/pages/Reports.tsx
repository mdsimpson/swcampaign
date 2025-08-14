import Header from '../components/Header'
import {useEffect, useState} from 'react'
import {generateClient} from 'aws-amplify/data'
import type {Schema} from '../../amplify/data/resource'

interface ReportData {
    totalHomes: number
    totalPeople: number
    absenteeHomes: number
    homesWithAllConsents: number
    totalConsents: number
    activeAssignments: number
    completedAssignments: number
    totalInteractions: number
    volunteerStats: any[]
    consentsByDate: any[]
    interactionsByType: any[]
}

export default function Reports() {
    const [reportData, setReportData] = useState<ReportData | null>(null)
    const [loading, setLoading] = useState(true)
    const [selectedReport, setSelectedReport] = useState('overview')

    const client = generateClient<Schema>()

    useEffect(() => {
        loadReportData()
    }, [])

    async function loadReportData() {
        try {
            const [homesResult, peopleResult, consentsResult, assignmentsResult, interactionsResult, volunteersResult] = await Promise.all([
                client.models.Home.list(),
                client.models.Person.list(),
                client.models.Consent.list(),
                client.models.Assignment.list(),
                client.models.InteractionRecord.list(),
                client.models.Volunteer.list()
            ])

            const homes = homesResult.data
            const people = peopleResult.data
            const consents = consentsResult.data
            const assignments = assignmentsResult.data
            const interactions = interactionsResult.data
            const volunteers = volunteersResult.data

            // Calculate key metrics
            const absenteeHomes = homes.filter(h => h.absenteeOwner).length
            
            // Calculate homes with all consents
            const homeIds = [...new Set(homes.map(h => h.id))]
            let homesWithAllConsents = 0
            
            for (const homeId of homeIds) {
                const homeOwners = people.filter(p => p.homeId === homeId)
                const homeConsents = consents.filter(c => c.homeId === homeId)
                if (homeOwners.length > 0 && homeConsents.length >= homeOwners.length) {
                    homesWithAllConsents++
                }
            }

            // Volunteer statistics
            const volunteerStats = volunteers.map(volunteer => {
                const volunteerAssignments = assignments.filter(a => a.volunteerId === volunteer.id)
                const completedAssignments = volunteerAssignments.filter(a => a.status === 'DONE')
                const volunteerInteractions = interactions.filter(i => i.createdBy === volunteer.userSub)
                
                return {
                    name: volunteer.displayName || volunteer.email,
                    totalAssignments: volunteerAssignments.length,
                    completedAssignments: completedAssignments.length,
                    interactions: volunteerInteractions.length
                }
            })

            // Consents by date (last 30 days)
            const thirtyDaysAgo = new Date()
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
            
            const recentConsents = consents.filter(c => 
                new Date(c.recordedAt) >= thirtyDaysAgo
            )
            
            const consentsByDate = recentConsents.reduce((acc: any, consent) => {
                const date = new Date(consent.recordedAt).toDateString()
                acc[date] = (acc[date] || 0) + 1
                return acc
            }, {})

            // Interactions by type
            const interactionsByType = [
                { type: 'Spoke to Homeowner', count: interactions.filter(i => i.spokeToHomeowner).length },
                { type: 'Spoke to Other', count: interactions.filter(i => i.spokeToOther).length },
                { type: 'Left Flyer', count: interactions.filter(i => i.leftFlyer).length },
                { type: 'No Contact', count: interactions.filter(i => !i.spokeToHomeowner && !i.spokeToOther && !i.leftFlyer).length }
            ]

            setReportData({
                totalHomes: homes.length,
                totalPeople: people.length,
                absenteeHomes,
                homesWithAllConsents,
                totalConsents: consents.length,
                activeAssignments: assignments.filter(a => a.status !== 'DONE').length,
                completedAssignments: assignments.filter(a => a.status === 'DONE').length,
                totalInteractions: interactions.length,
                volunteerStats: volunteerStats.filter(v => v.totalAssignments > 0),
                consentsByDate: Object.entries(consentsByDate).map(([date, count]) => ({ date, count })),
                interactionsByType
            })
        } catch (error) {
            console.error('Failed to load report data:', error)
        } finally {
            setLoading(false)
        }
    }

    function exportToCSV(data: any[], filename: string) {
        if (data.length === 0) return
        
        const headers = Object.keys(data[0])
        const csvContent = [
            headers.join(','),
            ...data.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
        ].join('\n')
        
        const blob = new Blob([csvContent], { type: 'text/csv' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
        window.URL.revokeObjectURL(url)
    }

    if (loading) {
        return (
            <div>
                <Header/>
                <div style={{maxWidth: 1200, margin: '20px auto'}}>
                    <h2>Reports</h2>
                    <p>Loading report data...</p>
                </div>
            </div>
        )
    }

    if (!reportData) {
        return (
            <div>
                <Header/>
                <div style={{maxWidth: 1200, margin: '20px auto'}}>
                    <h2>Reports</h2>
                    <p>Failed to load report data.</p>
                </div>
            </div>
        )
    }

    return (
        <div>
            <Header/>
            <div style={{maxWidth: 1200, margin: '20px auto', padding: 12}}>
                <h2>Campaign Reports</h2>
                
                {/* Report Navigation */}
                <div style={{
                    display: 'flex',
                    gap: 8,
                    marginBottom: 24,
                    borderBottom: '1px solid #ddd',
                    paddingBottom: 8
                }}>
                    {[
                        { id: 'overview', label: 'Overview' },
                        { id: 'consent', label: 'Consent Progress' },
                        { id: 'volunteers', label: 'Volunteer Performance' },
                        { id: 'interactions', label: 'Canvassing Activity' },
                        { id: 'absentee', label: 'Absentee Owners' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setSelectedReport(tab.id)}
                            style={{
                                padding: '8px 16px',
                                border: 'none',
                                backgroundColor: selectedReport === tab.id ? '#007bff' : '#f8f9fa',
                                color: selectedReport === tab.id ? 'white' : '#333',
                                borderRadius: 4,
                                cursor: 'pointer'
                            }}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Overview Report */}
                {selectedReport === 'overview' && (
                    <div>
                        <h3>Campaign Overview</h3>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                            gap: 16,
                            marginBottom: 24
                        }}>
                            <div style={{backgroundColor: '#f8f9fa', padding: 16, borderRadius: 8, textAlign: 'center'}}>
                                <h4 style={{margin: '0 0 8px 0', color: '#666'}}>Total Homes</h4>
                                <div style={{fontSize: '2em', fontWeight: 'bold', color: '#007bff'}}>{reportData.totalHomes}</div>
                            </div>
                            <div style={{backgroundColor: '#f8f9fa', padding: 16, borderRadius: 8, textAlign: 'center'}}>
                                <h4 style={{margin: '0 0 8px 0', color: '#666'}}>Total Residents</h4>
                                <div style={{fontSize: '2em', fontWeight: 'bold', color: '#28a745'}}>{reportData.totalPeople}</div>
                            </div>
                            <div style={{backgroundColor: '#f8f9fa', padding: 16, borderRadius: 8, textAlign: 'center'}}>
                                <h4 style={{margin: '0 0 8px 0', color: '#666'}}>Homes Complete</h4>
                                <div style={{fontSize: '2em', fontWeight: 'bold', color: '#ffc107'}}>{reportData.homesWithAllConsents}</div>
                                <div style={{fontSize: '0.9em', color: '#666'}}>
                                    {Math.round((reportData.homesWithAllConsents / (reportData.totalHomes - reportData.absenteeHomes)) * 100)}% of eligible
                                </div>
                            </div>
                            <div style={{backgroundColor: '#f8f9fa', padding: 16, borderRadius: 8, textAlign: 'center'}}>
                                <h4 style={{margin: '0 0 8px 0', color: '#666'}}>Total Consents</h4>
                                <div style={{fontSize: '2em', fontWeight: 'bold', color: '#17a2b8'}}>{reportData.totalConsents}</div>
                            </div>
                        </div>

                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                            gap: 16
                        }}>
                            <div style={{backgroundColor: '#f8f9fa', padding: 16, borderRadius: 8, textAlign: 'center'}}>
                                <h4 style={{margin: '0 0 8px 0', color: '#666'}}>Absentee Homes</h4>
                                <div style={{fontSize: '2em', fontWeight: 'bold', color: '#6c757d'}}>{reportData.absenteeHomes}</div>
                            </div>
                            <div style={{backgroundColor: '#f8f9fa', padding: 16, borderRadius: 8, textAlign: 'center'}}>
                                <h4 style={{margin: '0 0 8px 0', color: '#666'}}>Active Assignments</h4>
                                <div style={{fontSize: '2em', fontWeight: 'bold', color: '#fd7e14'}}>{reportData.activeAssignments}</div>
                            </div>
                            <div style={{backgroundColor: '#f8f9fa', padding: 16, borderRadius: 8, textAlign: 'center'}}>
                                <h4 style={{margin: '0 0 8px 0', color: '#666'}}>Total Interactions</h4>
                                <div style={{fontSize: '2em', fontWeight: 'bold', color: '#e83e8c'}}>{reportData.totalInteractions}</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Consent Progress Report */}
                {selectedReport === 'consent' && (
                    <div>
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16}}>
                            <h3>Consent Form Progress</h3>
                            <button
                                onClick={() => exportToCSV(reportData.consentsByDate, 'consent-progress.csv')}
                                style={{
                                    backgroundColor: '#28a745',
                                    color: 'white',
                                    border: 'none',
                                    padding: '8px 16px',
                                    borderRadius: 4,
                                    cursor: 'pointer'
                                }}
                            >
                                Export CSV
                            </button>
                        </div>

                        <div style={{marginBottom: 24}}>
                            <h4>Daily Consent Activity (Last 30 Days)</h4>
                            {reportData.consentsByDate.length > 0 ? (
                                <div style={{overflowX: 'auto'}}>
                                    <table style={{width: '100%', borderCollapse: 'collapse'}}>
                                        <thead>
                                            <tr style={{backgroundColor: '#f8f9fa'}}>
                                                <th style={{border: '1px solid #ddd', padding: 8, textAlign: 'left'}}>Date</th>
                                                <th style={{border: '1px solid #ddd', padding: 8, textAlign: 'left'}}>Consents Recorded</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {reportData.consentsByDate
                                                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                                .map(item => (
                                                <tr key={item.date}>
                                                    <td style={{border: '1px solid #ddd', padding: 8}}>{item.date}</td>
                                                    <td style={{border: '1px solid #ddd', padding: 8}}>{item.count}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <p>No consent activity in the last 30 days.</p>
                            )}
                        </div>

                        <div>
                            <h4>Progress Summary</h4>
                            <div style={{backgroundColor: '#f8f9fa', padding: 16, borderRadius: 8}}>
                                <p><strong>Target:</strong> 80% of eligible homes (non-absentee)</p>
                                <p><strong>Eligible Homes:</strong> {reportData.totalHomes - reportData.absenteeHomes}</p>
                                <p><strong>Homes Complete:</strong> {reportData.homesWithAllConsents} ({Math.round((reportData.homesWithAllConsents / (reportData.totalHomes - reportData.absenteeHomes)) * 100)}%)</p>
                                <p><strong>Homes Needed for 80%:</strong> {Math.max(0, Math.ceil((reportData.totalHomes - reportData.absenteeHomes) * 0.8) - reportData.homesWithAllConsents)}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Volunteer Performance Report */}
                {selectedReport === 'volunteers' && (
                    <div>
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16}}>
                            <h3>Volunteer Performance</h3>
                            <button
                                onClick={() => exportToCSV(reportData.volunteerStats, 'volunteer-performance.csv')}
                                style={{
                                    backgroundColor: '#28a745',
                                    color: 'white',
                                    border: 'none',
                                    padding: '8px 16px',
                                    borderRadius: 4,
                                    cursor: 'pointer'
                                }}
                            >
                                Export CSV
                            </button>
                        </div>

                        {reportData.volunteerStats.length > 0 ? (
                            <div style={{overflowX: 'auto'}}>
                                <table style={{width: '100%', borderCollapse: 'collapse'}}>
                                    <thead>
                                        <tr style={{backgroundColor: '#f8f9fa'}}>
                                            <th style={{border: '1px solid #ddd', padding: 8, textAlign: 'left'}}>Volunteer</th>
                                            <th style={{border: '1px solid #ddd', padding: 8, textAlign: 'left'}}>Total Assignments</th>
                                            <th style={{border: '1px solid #ddd', padding: 8, textAlign: 'left'}}>Completed</th>
                                            <th style={{border: '1px solid #ddd', padding: 8, textAlign: 'left'}}>Completion Rate</th>
                                            <th style={{border: '1px solid #ddd', padding: 8, textAlign: 'left'}}>Interactions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {reportData.volunteerStats
                                            .sort((a, b) => b.completedAssignments - a.completedAssignments)
                                            .map(volunteer => (
                                            <tr key={volunteer.name}>
                                                <td style={{border: '1px solid #ddd', padding: 8}}>{volunteer.name}</td>
                                                <td style={{border: '1px solid #ddd', padding: 8}}>{volunteer.totalAssignments}</td>
                                                <td style={{border: '1px solid #ddd', padding: 8}}>{volunteer.completedAssignments}</td>
                                                <td style={{border: '1px solid #ddd', padding: 8}}>
                                                    {volunteer.totalAssignments > 0 
                                                        ? Math.round((volunteer.completedAssignments / volunteer.totalAssignments) * 100) + '%'
                                                        : '0%'}
                                                </td>
                                                <td style={{border: '1px solid #ddd', padding: 8}}>{volunteer.interactions}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p>No volunteer activity to report.</p>
                        )}
                    </div>
                )}

                {/* Canvassing Activity Report */}
                {selectedReport === 'interactions' && (
                    <div>
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16}}>
                            <h3>Canvassing Activity</h3>
                            <button
                                onClick={() => exportToCSV(reportData.interactionsByType, 'canvassing-activity.csv')}
                                style={{
                                    backgroundColor: '#28a745',
                                    color: 'white',
                                    border: 'none',
                                    padding: '8px 16px',
                                    borderRadius: 4,
                                    cursor: 'pointer'
                                }}
                            >
                                Export CSV
                            </button>
                        </div>

                        <div style={{marginBottom: 24}}>
                            <h4>Interaction Types</h4>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                gap: 16
                            }}>
                                {reportData.interactionsByType.map(item => (
                                    <div key={item.type} style={{backgroundColor: '#f8f9fa', padding: 16, borderRadius: 8, textAlign: 'center'}}>
                                        <h4 style={{margin: '0 0 8px 0', color: '#666'}}>{item.type}</h4>
                                        <div style={{fontSize: '1.5em', fontWeight: 'bold', color: '#007bff'}}>{item.count}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h4>Activity Summary</h4>
                            <div style={{backgroundColor: '#f8f9fa', padding: 16, borderRadius: 8}}>
                                <p><strong>Total Interactions:</strong> {reportData.totalInteractions}</p>
                                <p><strong>Contact Rate:</strong> {
                                    reportData.totalInteractions > 0 
                                        ? Math.round(((reportData.interactionsByType.find(i => i.type === 'Spoke to Homeowner')?.count || 0) + 
                                                     (reportData.interactionsByType.find(i => i.type === 'Spoke to Other')?.count || 0)) / 
                                                     reportData.totalInteractions * 100) + '%'
                                        : '0%'
                                }</p>
                                <p><strong>Homes Contacted:</strong> {reportData.totalInteractions} of {reportData.totalHomes - reportData.absenteeHomes} eligible homes</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Absentee Owners Report */}
                {selectedReport === 'absentee' && (
                    <div>
                        <h3>Absentee Owners Summary</h3>
                        <div style={{backgroundColor: '#f8f9fa', padding: 16, borderRadius: 8}}>
                            <p><strong>Total Absentee Homes:</strong> {reportData.absenteeHomes}</p>
                            <p><strong>Percentage of Total:</strong> {Math.round((reportData.absenteeHomes / reportData.totalHomes) * 100)}%</p>
                            <p><strong>Note:</strong> Absentee owners require special outreach via mail, email, or phone rather than door-to-door canvassing.</p>
                        </div>
                        
                        <div style={{marginTop: 16}}>
                            <button
                                onClick={() => window.open('/absentee', '_blank')}
                                style={{
                                    backgroundColor: '#007bff',
                                    color: 'white',
                                    border: 'none',
                                    padding: '8px 16px',
                                    borderRadius: 4,
                                    cursor: 'pointer'
                                }}
                            >
                                View Absentee Owners Page
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
