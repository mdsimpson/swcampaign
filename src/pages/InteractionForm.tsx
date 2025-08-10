import Header from '../components/Header'

export default function InteractionForm() {
    return (
        <div>
            <Header/>
            <div style={{maxWidth: 700, margin: '20px auto'}}>
                <h2>Record Canvassing Interaction</h2>
                <p>Checkboxes for owners/other, left flyer, notes; capture lat/lng if available.</p>
            </div>
        </div>
    )
}
