import Header from '../components/Header'
export default function AbsenteeInteractions(){
    return (
        <div>
            <Header />
            <div style={{maxWidth:1000,margin:'20px auto'}}>
                <h2>Absentee Owners</h2>
                <p>List derived where mailing != property address; allow recording contact (email/phone/text/mail) + notes.</p>
            </div>
        </div>
    )
}
