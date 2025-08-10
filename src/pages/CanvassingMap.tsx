import Header from '../components/Header'
export default function CanvassingMap(){
  return (
    <div>
      <Header />
      <div style={{maxWidth:1100,margin:'10px auto',padding:12}}>
        <h2>Canvassing</h2>
        <p>Google Map with assigned homes and "Show All/Mine" toggle (hook up to Data + Maps API).</p>
      </div>
    </div>
  )
}
