import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import API, { useGet, usePost } from '../api'

export default function Admin(){
  const [serial, setSerial] = useState('')
  const [name, setName] = useState('')
  const [course, setCourse] = useState('')
  const [position, setPosition] = useState('')
  const [issueDate, setIssueDate] = useState('')
  const { data: list = [], loading: listLoading, refetch: refetchList } = useGet('/admin/certificates', { enabled: false }, [])
  const { mutate: createCert, loading: creating } = usePost('/admin/certificate')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const navigate = useNavigate()

  useEffect(()=>{
    // Redirect to login if no token
    const token = localStorage.getItem('token')
    if (!token) {
      navigate('/login')
      return
    }
    // Optional: validate token
    API.get('/auth/me').then(()=>refetchList()).catch(()=>{
      localStorage.removeItem('token');
      navigate('/login')
    })
  }, [])


  async function handleCreate(e){
    e.preventDefault();
    setLoading(true); setError(''); setSuccess('')
    try{
      await createCert({ serialNumber: serial, studentName: name, course, position, issueDate })
      setSuccess('Certificate created and QR generated.')
      setSerial(''); setName(''); setCourse(''); setPosition(''); setIssueDate('')
      refetchList()
    }catch(err){ setError(err.response?.data?.message || 'Error creating certificate') }
    finally { setLoading(false) }
  }

  async function handleGenerateSerial(){
    try{
      const res = await API.get('/admin/next-serial')
      if (res.data?.serial) setSerial(res.data.serial)
    }catch(err){
      setError(err.response?.data?.message || 'Unable to generate serial')
    }
  }

  function handleLogout(){
    localStorage.removeItem('token')
    navigate('/login')
  }

  return (
    <main className="container">
      <section className="card">
        <h2 style={{ marginTop: 0 }}>Admin Panel</h2>
        <p className="helper">Authenticated with JWT. Use the Login page to obtain a session token.</p>
        <div style={{ marginBottom: 12 }}>
          <button className="btn" onClick={handleLogout}>Logout</button>
        </div>

        <form className="form" onSubmit={handleCreate}>
          <div className="row">
            <input className="input" value={serial} onChange={e=>setSerial(e.target.value)} placeholder="Serial Number (unique)" required />
            <div style={{ display: 'flex', gap: 10 }}>
              <input className="input" value={name} onChange={e=>setName(e.target.value)} placeholder="Student Name" required />
              <button type="button" className="btn" onClick={handleGenerateSerial}>Generate Serial</button>
            </div>
          </div>
          <div className="row">
            <input className="input" value={course} onChange={e=>setCourse(e.target.value)} placeholder="Course" />
            <input className="input" value={position} onChange={e=>setPosition(e.target.value)} placeholder="Position" />
          </div>
          <div className="row">
            <input className="input" value={issueDate} onChange={e=>setIssueDate(e.target.value)} type="date" />
            <button className="btn success" type="submit" disabled={loading || creating}>
              {loading || creating ? 'Creating…' : 'Create & Generate QR'}
            </button>
          </div>
        </form>

        {error && <div className="alert error" style={{ marginTop: 12 }}>{error}</div>}
        {success && <div className="alert info" style={{ marginTop: 12 }}>{success}</div>}
      </section>

      <section className="section">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Existing Certificates</h3>
          {listLoading && <p className="helper">Loading…</p>}
          {!listLoading && list.length === 0 && <p className="helper">No certificates yet.</p>}
          <ul className="list">
            {list.map(c => (
              <li className="list-item" key={c.serialNumber}>
                <div>
                  <div><b>{c.studentName}</b> — <span className="mono">{c.serialNumber}</span></div>
                  <div className="helper">{c.course || '-'} • {c.position || '-'} • {c.issueDate ? new Date(c.issueDate).toDateString() : '-'}</div>
                </div>
                {(() => {
                  const qrLink = c.qrUrl || (c.qrPath ? `${API.defaults.baseURL.replace('/api', '')}${c.qrPath}` : null);
                  return qrLink ? (
                    <a className="btn" href={qrLink} target="_blank" rel="noreferrer">Open QR</a>
                  ) : null;
                })()}
                <button className="btn" onClick={async ()=>{
                  if (!confirm(`Delete certificate ${c.serialNumber}?`)) return;
                  try{
                    await API.delete(`/admin/certificate/${encodeURIComponent(c.serialNumber)}`)
                    refetchList()
                  }catch(err){ setError(err.response?.data?.message || 'Delete failed') }
                }}>Delete</button>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  )
}
