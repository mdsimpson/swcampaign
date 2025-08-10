import Header from '../../components/Header'
export default function RecordVotes(){
  return (
    <div>
      <Header />
      <div style={{maxWidth:800,margin:'20px auto'}}>
        <h2>Record Votes</h2>
        <p>Lookup owners/properties to record votes; CSV upload for bulk.</p>
      </div>
    </div>
  )
}
