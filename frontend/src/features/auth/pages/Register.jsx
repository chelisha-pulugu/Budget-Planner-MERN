import React,{useState} from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authRequest } from '../api'
import "../auth.form.scss"
import "../../../styles/button.scss"

const Register = () => {
    const [username, setUsername] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const navigate = useNavigate()
    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)
        try { await authRequest('register', { username, email, password }); navigate('/dashboard') }
        catch (requestError) { setError(requestError.message) }
        finally { setLoading(false) }
    }    

    

    return (
        <main className="auth-screen">
            <div className="form-container">
                <h1>Create account</h1>
                <p>Start tracking your finances with your own secure workspace.</p>

                <form onSubmit={handleSubmit}>

                    <div className="input-group">
                        <label htmlFor="username">Username</label>
                        <input
                            onChange={(e) => { setUsername(e.target.value) }}
                            type="text" id="username" name='username' autoComplete="name" maxLength={80} required value={username} placeholder='Enter your name' />
                    </div>
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
                            type="password" id="password" name='password' autoComplete="new-password" minLength={8} required value={password} placeholder='At least 8 characters' />
                    </div>

                    {error && <p className="auth-error" role="alert">{error}</p>}
                    <button className='button primary-button' disabled={loading}>{loading ? 'Creating account…' : 'Register'}</button>

                </form>

                <p>Already have an account? <Link to={"/login"} >Login</Link> </p>
            </div>
        </main>
    )
}

export default Register
