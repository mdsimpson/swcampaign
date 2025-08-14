import React from 'react'
import ReactDOM from 'react-dom/client'
import {BrowserRouter} from 'react-router-dom'
import {Amplify} from 'aws-amplify'
import outputs from '../amplify_outputs.json'
import App from './App'
import '@aws-amplify/ui-react/styles.css'

console.log('Amplify outputs:', outputs)
try {
    Amplify.configure(outputs)
    console.log('Amplify configured successfully')
} catch (error) {
    console.error('Failed to configure Amplify:', error)
}
ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <BrowserRouter>
            <App/>
        </BrowserRouter>
    </React.StrictMode>
)
