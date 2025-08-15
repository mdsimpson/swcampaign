import {Authenticator} from '@aws-amplify/ui-react'
import {Route, Routes, Navigate} from 'react-router-dom'
import Landing from './pages/Landing'
import InternalHome from './pages/InternalHome'
import SignUp from './pages/SignUp'
import VerifyEmail from './pages/VerifyEmail'
import ResetPassword from './pages/ResetPassword'
import EnrollMembers from './pages/admin/EnrollMembers'
import UserProfile from './pages/UserProfile'
import Reports from './pages/Reports'
import CanvassingMap from './pages/CanvassingMap'
import InteractionForm from './pages/InteractionForm'
import InteractionHistory from './pages/InteractionHistory'
import AbsenteeInteractions from './pages/AbsenteeInteractions'
import RecordConsents from './pages/admin/RecordVotes'
import Organize from './pages/organizer/Organize'
import RoleProtectedRoute from './components/RoleProtectedRoute'

export default function App() {
    return (
        <Routes>
            <Route path='/landing' element={<Landing/>}/>
            <Route path='/signup' element={<SignUp/>}/>
            <Route path='/verify' element={<VerifyEmail/>}/>
            <Route path='/reset' element={<ResetPassword/>}/>
            <Route path='/' element={<Authenticator><InternalHome/></Authenticator>}/>
            <Route path='/profile' element={
                <Authenticator>
                    <RoleProtectedRoute requiredRoles={['Member', 'Canvasser', 'Organizer', 'Administrator']}>
                        <UserProfile/>
                    </RoleProtectedRoute>
                </Authenticator>
            }/>
            <Route path='/reports' element={<Authenticator><Reports/></Authenticator>}/>
            <Route path='/canvass' element={<Authenticator><CanvassingMap/></Authenticator>}/>
            <Route path='/interact' element={<Authenticator><InteractionForm/></Authenticator>}/>
            <Route path='/history' element={<Authenticator><InteractionHistory/></Authenticator>}/>
            <Route path='/absentee' element={<Authenticator><AbsenteeInteractions/></Authenticator>}/>
            <Route path='/admin/enroll' element={<Authenticator><EnrollMembers/></Authenticator>}/>
            <Route path='/admin/consents' element={<Authenticator><RecordConsents/></Authenticator>}/>
            <Route path='/organize' element={<Authenticator><Organize/></Authenticator>}/>
            <Route path='*' element={<Navigate to='/landing' replace/>}/>
        </Routes>
    )
}
