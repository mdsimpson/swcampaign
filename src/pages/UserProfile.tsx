import Header from '../components/Header'
export default function UserProfile(){
    return (
        <div>
            <Header />
            <div style={{maxWidth:700,margin:'20px auto'}}>
                <h2>User Profile</h2>
                <p>Role and contact info; password change via Cognito UI.</p>
            </div>
        </div>
    )
}
