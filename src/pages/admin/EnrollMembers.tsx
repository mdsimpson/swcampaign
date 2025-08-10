import Header from '../../components/Header'
export default function EnrollMembers(){
  return (
    <div>
      <Header />
      <div style={{maxWidth:1000,margin:'20px auto'}}>
        <h2>Enroll Members</h2>
        <p>Table of Registration rows; Accept/Reject buttons. Accept can trigger Cognito user creation via admin script or Lambda.</p>
      </div>
    </div>
  )
}
