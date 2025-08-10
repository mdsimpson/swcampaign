import Header from '../components/Header'

export default function InternalHome() {
    return (
        <div>
            <Header/>
            <div style={{maxWidth: 900, margin: '20px auto', padding: 16}}>
                <h2>Campaign Progress</h2>
                <p>(Progress bars + inbox per spec; wired to Data in the next commit.)</p>
            </div>
        </div>
    )
}
