import Header from '../components/Header'

export default function InteractionHistory() {
    return (
        <div>
            <Header/>
            <div style={{maxWidth: 900, margin: '20px auto'}}>
                <h2>Canvassing History</h2>
                <p>Chronological list; filter by property via URL param.</p>
            </div>
        </div>
    )
}
