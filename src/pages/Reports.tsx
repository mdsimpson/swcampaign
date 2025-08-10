import Header from '../components/Header'
export default function Reports(){
    return (
        <div>
            <Header />
            <div style={{maxWidth:900,margin:'20px auto'}}>
                <h2>Reports</h2>
                <ul>
                    <li>Canvassing Report</li>
                    <li>Canvasser reports</li>
                    <li>Interaction reports</li>
                    <li>Absentee owners report</li>
                </ul>
                <p>(Report components can be added here.)</p>
            </div>
        </div>
    )
}
