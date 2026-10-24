import React,{useState} from 'react'
import { useNavigate, Link } from 'react-router-dom'
import "../auth.form.scss"
import "../../../styles/button.scss"
import { authRequest } from '../api'

const Login = () => {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const navigate = useNavigate()

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)
        try { await authRequest('login', { email, password }); navigate('/dashboard') }
        catch (requestError) { setError(requestError.message) }
        finally { setLoading(false) }
    }

    


    return (
        <main className="auth-screen">
            <div className="form-container">
                <h1>Welcome back</h1>
                <p>Sign in to see your financial overview.</p>
                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label htmlFor="email">Email</label>
                        <input
                            onChange={(e) => { setEmail(e.target.value) }}
                            type="email" id="email" name='email' autoComplete="email" required value={email} placeholder='Enter email address' />
                    </div>
                    <div className="input-group">
                        <label htmlFor="password">Password</label>
                        <input
                            onChange={(e) => { setPassword(e.target.value) }}
                            type="password" id="password" name='password' autoComplete="current-password" required value={password} placeholder='Enter password' />
                    </div>
                    {error && <p className="auth-error" role="alert">{error}</p>}
                    <button className='button primary-button' disabled={loading}>{loading ? 'Logging in…' : 'Login'}</button>
                </form>
                <p>Don't have an account? <Link to={"/register"} >Register</Link> </p>
            </div>
        </main>
    )
}

export default Login
