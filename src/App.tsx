import {Authenticator} from '@aws-amplify/ui-react'
import {Route, Routes, Navigate} from 'react-router-dom'
import {useEffect, useState} from 'react'
import {getCurrentUser} from 'aws-amplify/auth'
import Landing from './pages/Landing'
import InternalHome from './pages/InternalHome'
import SignUp from './pages/SignUp'
import VerifyEmail from './pages/VerifyEmail'
import ResetPassword from './pages/ResetPassword'
import EnrollMembers from './pages/admin/EnrollMembers'
import ResidentsPage from './pages/admin/ResidentsPage'
import EditAddresses from './pages/admin/EditAddresses'
import Members from './pages/Members'
import UserProfile from './pages/UserProfile'
import Reports from './pages/Reports'
import CanvassingMap from './pages/CanvassingMap'
import InteractionForm from './pages/InteractionForm'
import InteractionHistory from './pages/InteractionHistory'
import AbsenteeInteractions from './pages/AbsenteeInteractions'
import RecordConsents from './pages/admin/RecordVotes'
import DataManagement from './pages/admin/DataManagement'
import MoveFormerOwners from './pages/admin/MoveFormerOwners'
import AddResidents from './pages/admin/AddResidents'
import ExportUnsigned from './pages/admin/ExportUnsigned'
import ExportResidents from './pages/admin/ExportResidents'
import SyncPersonIds from './pages/admin/SyncPersonIds'
import UploadDeedData from './pages/admin/UploadDeedData'
import SetDataDate from './pages/admin/SetDataDate'
import Organize from './pages/organizer/Organize'
import RoleProtectedRoute from './components/RoleProtectedRoute'

function ProtectedHome() {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)

    useEffect(() => {
        async function checkAuth() {
            try {
                await getCurrentUser()
                setIsAuthenticated(true)
            } catch {
                setIsAuthenticated(false)
            }
        }
        checkAuth()
    }, [])

    if (isAuthenticated === null) {
        return <div>Loading...</div>
    }

    if (isAuthenticated) {
        return <Authenticator><InternalHome/></Authenticator>
    } else {
        return <Landing/>
    }
}

export default function App() {
    return (
        <Routes>
            <Route path='/landing' element={<Landing/>}/>
            <Route path='/signup' element={<SignUp/>}/>
            <Route path='/verify' element={<VerifyEmail/>}/>
            <Route path='/reset' element={<ResetPassword/>}/>
            <Route path='/' element={<ProtectedHome/>}/>
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
            <Route path='/members' element={
                <Authenticator>
                    <RoleProtectedRoute requiredRoles={['Organizer', 'Administrator']}>
                        <Members/>
                    </RoleProtectedRoute>
                </Authenticator>
            }/>
            <Route path='/admin/enroll' element={<Authenticator><EnrollMembers/></Authenticator>}/>
            <Route path='/admin/consents' element={<Authenticator><RecordConsents/></Authenticator>}/>
            <Route path='/admin/residents' element={
                <Authenticator>
                    <RoleProtectedRoute requiredRoles={['Administrator']}>
                        <ResidentsPage/>
                    </RoleProtectedRoute>
                </Authenticator>
            }/>
            <Route path='/admin/addresses' element={
                <Authenticator>
                    <RoleProtectedRoute requiredRoles={['Administrator']}>
                        <EditAddresses/>
                    </RoleProtectedRoute>
                </Authenticator>
            }/>
            <Route path='/admin/data' element={
                <Authenticator>
                    <RoleProtectedRoute requiredRoles={['Administrator']}>
                        <DataManagement/>
                    </RoleProtectedRoute>
                </Authenticator>
            }/>
            <Route path='/admin/move-former-owners' element={
                <Authenticator>
                    <RoleProtectedRoute requiredRoles={['Administrator']}>
                        <MoveFormerOwners/>
                    </RoleProtectedRoute>
                </Authenticator>
            }/>
            <Route path='/admin/add-residents' element={
                <Authenticator>
                    <RoleProtectedRoute requiredRoles={['Administrator']}>
                        <AddResidents/>
                    </RoleProtectedRoute>
                </Authenticator>
            }/>
            <Route path='/admin/export-unsigned' element={
                <Authenticator>
                    <RoleProtectedRoute requiredRoles={['Administrator']}>
                        <ExportUnsigned/>
                    </RoleProtectedRoute>
                </Authenticator>
            }/>
            <Route path='/admin/export-residents' element={
                <Authenticator>
                    <RoleProtectedRoute requiredRoles={['Administrator']}>
                        <ExportResidents/>
                    </RoleProtectedRoute>
                </Authenticator>
            }/>
            <Route path='/admin/sync-person-ids' element={
                <Authenticator>
                    <RoleProtectedRoute requiredRoles={['Administrator']}>
                        <SyncPersonIds/>
                    </RoleProtectedRoute>
                </Authenticator>
            }/>
            <Route path='/admin/upload-deed-data' element={
                <Authenticator>
                    <RoleProtectedRoute requiredRoles={['Administrator']}>
                        <UploadDeedData/>
                    </RoleProtectedRoute>
                </Authenticator>
            }/>
            <Route path='/admin/set-data-date' element={
                <Authenticator>
                    <RoleProtectedRoute requiredRoles={['Administrator']}>
                        <SetDataDate/>
                    </RoleProtectedRoute>
                </Authenticator>
            }/>
            <Route path='/organize' element={<Authenticator><Organize/></Authenticator>}/>
            <Route path='*' element={<Navigate to='/' replace/>}/>
        </Routes>
    )
}
