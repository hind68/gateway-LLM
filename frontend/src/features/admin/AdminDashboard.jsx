import { useEffect, useState, useMemo, useContext } from 'react'
import { AuthContext } from '../../AuthProvider'
import {
  fetchGlobalBannedWords,
  addGlobalBannedWord,
  removeGlobalBannedWord,
  fetchUserRestrictions,
  addLlmRestriction,
  removeLlmRestriction,
  fetchUserBannedWords,
  addUserBannedWord,
  removeUserBannedWord,
  fetchUsers,
  fetchKeycloakUsers,
  setKeycloakUserEnabled,
  fetchKeycloakRoles,
  fetchKeycloakUserRoles,
  setKeycloakUserRoles,
  fetchPatterns,
  addPattern,
  updatePattern,
  removePattern,
  fetchRoleRestrictions,
  addRoleLlmRestriction,
  removeRoleLlmRestriction,
  fetchRoleBannedWords,
  addRoleBannedWord,
  removeRoleBannedWord,
  fetchAuditLogs,
  fetchFilteredMessages,
  fetchAdminModels,
  fetchAdminProviders,
  createAdminProvider,
  createAdminModel,
  setAdminModelStatus,
  testAdminModel,
  fetchSecurityMetrics
} from '../../api/adminApi'
import { fetchModelDetails } from '../../api/modelsApi'

export default function AdminDashboard({ onError, onNotice, onClose }) {
  const keycloak = useContext(AuthContext)
  const token = keycloak?.token

  const [activeTab, setActiveTab] = useState('general')
  const [globalWords, setGlobalWords] = useState([])
  const [newWord, setNewWord] = useState('')
  
  const [patterns, setPatterns] = useState([])
  const [newPatternData, setNewPatternData] = useState({
    name: '',
    type: '',
    pattern: '',
    severity: 'medium',
    action: 'MASK',
    enabled: true,
    validator: '',
    capture_group: ''
  })

  const [users, setUsers] = useState([])
  const [userSearchQuery, setUserSearchQuery] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)
  const [userRestrictions, setUserRestrictions] = useState([])
  const [modelAlias, setModelAlias] = useState('')
  const [userBannedWords, setUserBannedWords] = useState([])
  const [newUserWord, setNewUserWord] = useState('')
  const [availableModels, setAvailableModels] = useState([])
  const [adminModels, setAdminModels] = useState([])
  const [adminProviders, setAdminProviders] = useState([])
  const [newProvider, setNewProvider] = useState({ code: '', name: '' })
  const [newAdminModel, setNewAdminModel] = useState({ providerId: '', alias: '', providerModel: '', displayName: '' })
  const [securityMetrics, setSecurityMetrics] = useState(null)
  const [keycloakRoles, setKeycloakRoles] = useState([])
  const [selectedKeycloakRoles, setSelectedKeycloakRoles] = useState([])

  const [selectedRole, setSelectedRole] = useState('INTERN')
  const [roleRestrictions, setRoleRestrictions] = useState([])
  const [roleBannedWords, setRoleBannedWords] = useState([])
  const [newRoleWord, setNewRoleWord] = useState('')
  const [roleModelAlias, setRoleModelAlias] = useState('')


  const [auditLogs, setAuditLogs] = useState([])
  const [auditPage, setAuditPage] = useState(0)
  const [auditTotalPages, setAuditTotalPages] = useState(0)
  const [auditSearch, setAuditSearch] = useState('')
  const [auditAction, setAuditAction] = useState('')
  const [auditEntity, setAuditEntity] = useState('')
  const [filteredMessages, setFilteredMessages] = useState([])
  const [filteredPage, setFilteredPage] = useState(0)
  const [filteredTotalPages, setFilteredTotalPages] = useState(0)
  const [filteredSearch, setFilteredSearch] = useState('')
  const [filteredAction, setFilteredAction] = useState('')
  const [filteredUserId, setFilteredUserId] = useState('')
  const [auditView, setAuditView] = useState('permissions')
  const [revealedIds, setRevealedIds] = useState(new Set())

  useEffect(() => {
    if (token) {
      loadGlobalWords()
      loadModels()
      loadUsers()
      loadPatterns()
    }
  }, [token])

  useEffect(() => {
    if (token && activeTab === 'roles') {
      loadRoleData(selectedRole)
    }
  }, [token, activeTab, selectedRole])

  useEffect(() => {
    if (!token || activeTab !== 'audit') return
    if (auditView === 'permissions') loadAuditLogs()
    else loadFilteredMessages()
  }, [token, activeTab, auditView, auditPage, auditSearch, auditAction, auditEntity, filteredPage, filteredSearch, filteredAction, filteredUserId])

  async function loadFilteredMessages() {
    try {
      const data = await fetchFilteredMessages(token, {
        page: filteredPage,
        size: 10,
        search: filteredSearch,
        action: filteredAction,
        userId: filteredUserId
      })
      setFilteredMessages(data?.content || [])
      setFilteredTotalPages(data?.totalPages || 0)
    } catch (err) {
      onError(err.message)
    }
  }
  function toggleReveal(id) {
  setRevealedIds(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })
}
  async function loadAuditLogs() {
    try {
      const data = await fetchAuditLogs(token, {
        page: auditPage,
        size: 10,
        search: auditSearch,
        action: auditAction,
        entityName: auditEntity
      })
      setAuditLogs(data?.content || [])
      setAuditTotalPages(data?.totalPages || 0)
    } catch (err) {
      onError(err.message)
    }
  }

  async function loadPatterns() {
    try {
      const data = await fetchPatterns(token)
      setPatterns(data || [])
    } catch (err) {
      onError(err.message)
    }
  }

  async function handleAddPattern(e) {
    e.preventDefault()
    if (!newPatternData.name.trim() || !newPatternData.pattern.trim()) return

    const payload = {
      name: newPatternData.name.trim(),
      type: newPatternData.type.trim() || 'custom',
      pattern: newPatternData.pattern.trim(),
      severity: newPatternData.severity,
      action: newPatternData.action,
      enabled: newPatternData.enabled,
    }

    if (newPatternData.validator.trim()) {
      payload.validator = newPatternData.validator.trim()
    }
    
    if (newPatternData.capture_group.trim()) {
      payload.capture_group = parseInt(newPatternData.capture_group, 10)
    }

    try {
      await addPattern(payload, token)
      setNewPatternData({ name: '', type: '', pattern: '', severity: 'medium', action: 'MASK', enabled: true, validator: '', capture_group: '' })
      onNotice('Pattern ajouté')
      loadPatterns()
    } catch (err) {
      onError(err.message)
    }
  }

  async function handleDeletePattern(name) {
    if (!name) return
    try {
      await removePattern(name, token)
      onNotice('Pattern supprimé')
      loadPatterns()
    } catch (err) {
      onError(err.message)
    }
  }

  async function loadAdminModels() {
    try {
      const data = await fetchAdminModels(token)
      setAdminModels(data || [])
    } catch (err) {
      onError(err.message)
    }
  }

  async function loadAdminProviders() {
    try {
      const data = await fetchAdminProviders(token)
      setAdminProviders(data || [])
      if (!newAdminModel.providerId && data?.length) setNewAdminModel(value => ({ ...value, providerId: String(data[0].id) }))
    } catch (err) {
      onError(err.message)
    }
  }

  async function handleCreateProvider(event) {
    event.preventDefault()
    try {
      await createAdminProvider(newProvider, token)
      setNewProvider({ code: '', name: '' })
      onNotice('Fournisseur ajouté')
      loadAdminProviders()
    } catch (err) { onError(err.message) }
  }

  async function handleCreateAdminModel(event) {
    event.preventDefault()
    try {
      await createAdminModel(newAdminModel, token)
      setNewAdminModel(value => ({ ...value, alias: '', providerModel: '', displayName: '' }))
      onNotice('Modèle ajouté')
      loadAdminModels()
      loadAdminProviders()
    } catch (err) { onError(err.message) }
  }

  async function loadSecurityMetrics() {
    try {
      setSecurityMetrics(await fetchSecurityMetrics(token))
    } catch (err) {
      onError(err.message)
    }
  }

  async function loadKeycloakRoles() {
    try {
      const data = await fetchKeycloakRoles(token)
      setKeycloakRoles(data || [])
    } catch {
      // Optional until Keycloak service-account credentials are configured.
    }
  }

  async function handleAssignKeycloakRoles() {
    if (!selectedUser?.keycloakManaged) return
    try {
      await setKeycloakUserRoles(selectedUser.externalId, selectedKeycloakRoles, token)
      onNotice('Rôles mis à jour')
    } catch (err) {
      onError(err.message)
    }
  }

  async function handleToggleAdminModel(model) {
    try {
      await setAdminModelStatus(model.id, model.statut === 'ACTIF' ? 'INACTIF' : 'ACTIF', token)
      onNotice(model.statut === 'ACTIF' ? 'Modèle désactivé' : 'Modèle activé')
      loadAdminModels()
      loadSecurityMetrics()
      loadKeycloakRoles()
    } catch (err) {
      onError(err.message)
    }
  }

  async function handleTestAdminModel(model) {
    try {
      const result = await testAdminModel(model.id, token)
      onNotice(`${model.aliasInterne}: ${result.status}${result.latencyMs ? ` (${result.latencyMs} ms)` : ''}`)
    } catch (err) {
      onError(err.message)
    }
  }

  async function handleTogglePattern(item) {
    try {
      await updatePattern(item.name, { ...item, enabled: item.enabled === false }, token)
      onNotice(item.enabled === false ? 'Pattern activé' : 'Pattern désactivé')
      loadPatterns()
      loadAdminModels()
    } catch (err) {
      onError(err.message)
    }
  }

  async function loadModels() {
    try {
      const data = await fetchModelDetails(token)
      setAvailableModels(data || [])
      if (data && data.length > 0) {
        setModelAlias(data[0].alias)
        setRoleModelAlias(data[0].alias)
      }
    } catch (err) {
      onError(err.message)
    }
  }

  async function loadGlobalWords() {
    try {
      const data = await fetchGlobalBannedWords(token)
      setGlobalWords(data || [])
    } catch (err) {
      onError(err.message)
    }
  }

  async function loadUsers() {
    try {
      let data
      try {
        const keycloakUsers = await fetchKeycloakUsers(token)
        data = (keycloakUsers || []).map(user => ({
          id: user.id,
          externalId: user.id,
          nomAffichage: user.username || user.email || user.id,
          enabled: user.enabled !== false,
          keycloakManaged: true
        }))
      } catch {
        data = await fetchUsers(token)
      }
      setUsers(data || [])
      if (data?.length > 0) {
        handleSelectUser(data[0])
      }
    } catch (err) {
      onError(err.message)
    }
  }

  async function handleToggleKeycloakUser(user) {
    if (!user?.keycloakManaged) return
    try {
      await setKeycloakUserEnabled(user.externalId, !user.enabled, token)
      onNotice(user.enabled ? 'Utilisateur désactivé' : 'Utilisateur activé')
      loadUsers()
    } catch (err) {
      onError(err.message)
    }
  }

  async function loadUserDataForUuid(targetUuid) {
    if (!targetUuid) return
    try {
      const modelsData = await fetchUserRestrictions(targetUuid, token)
      setUserRestrictions(modelsData || [])

      const wordsData = await fetchUserBannedWords(targetUuid, token)
      setUserBannedWords(wordsData || [])
    } catch (err) {
      onError(err.message)
    }
  }

  async function loadRoleData(role) {
    try {
      const modelsData = await fetchRoleRestrictions(role, token)
      setRoleRestrictions(modelsData || [])

      const wordsData = await fetchRoleBannedWords(role, token)
      setRoleBannedWords(wordsData || [])
    } catch (err) {
      onError(err.message)
    }
  }

  const filteredUsers = useMemo(() => {
    if (!userSearchQuery.trim()) return users
    const query = userSearchQuery.toLowerCase()
    return users.filter(u => 
      (u.nomAffichage && u.nomAffichage.toLowerCase().includes(query)) ||
      (u.externalId && u.externalId.toLowerCase().includes(query)) ||
      (u.id && String(u.id).toLowerCase().includes(query))
    )
  }, [users, userSearchQuery])

  async function handleSelectUser(user) {
    setSelectedUser(user)
    if (user.keycloakManaged) {
      try {
        const roles = await fetchKeycloakUserRoles(user.externalId, token)
        setSelectedKeycloakRoles((roles || []).map(role => role.name))
      } catch {
        setSelectedKeycloakRoles([])
      }
    } else {
      setSelectedKeycloakRoles([])
    }
    await loadUserDataForUuid(user.externalId)
  }

  async function handleAddGlobalWord(e) {
    e.preventDefault()
    if (!newWord.trim()) return
    try {
      await addGlobalBannedWord(newWord.trim(), token)
      setNewWord('')
      onNotice('Mot ajouté')
      loadGlobalWords()
    } catch (err) {
      onError(err.message)
    }
  }

  async function handleDeleteGlobalWord(id) {
    if (!id) return
    try {
      await removeGlobalBannedWord(id, token)
      loadGlobalWords()
    } catch (err) {
      onError(err.message)
    }
  }

  async function handleAddRestriction(e) {
    e.preventDefault()
    if (!selectedUser || !modelAlias.trim()) return
    try {
      await addLlmRestriction(selectedUser.externalId, modelAlias.trim(), token)
      onNotice('Restriction ajoutée')
      loadUserDataForUuid(selectedUser.externalId)
    } catch (err) {
      onError(err.message)
    }
  }

  async function handleDeleteRestriction(id) {
    try {
      await removeLlmRestriction(id, token)
      loadUserDataForUuid(selectedUser.externalId)
    } catch (err) {
      onError(err.message)
    }
  }

  async function handleAddUserWord(e) {
    e.preventDefault()
    if (!selectedUser || !newUserWord.trim()) return
    try {
      await addUserBannedWord(selectedUser.externalId, newUserWord.trim(), token)
      setNewUserWord('')
      onNotice("Mot banni ajouté")
      loadUserDataForUuid(selectedUser.externalId)
    } catch (err) {
      onError(err.message)
    }
  }

  async function handleDeleteUserWord(id) {
    try {
      await removeUserBannedWord(id, token)
      loadUserDataForUuid(selectedUser.externalId)
    } catch (err) {
      onError(err.message)
    }
  }

  async function handleAddRoleRestriction(e) {
    e.preventDefault()
    if (!roleModelAlias.trim()) return
    try {
      await addRoleLlmRestriction(selectedRole, roleModelAlias.trim(), token)
      onNotice(`Restriction ajoutée`)
      loadRoleData(selectedRole)
    } catch (err) {
      onError(err.message)
    }
  }

  async function handleDeleteRoleRestriction(id) {
    try {
      await removeRoleLlmRestriction(id, token)
      loadRoleData(selectedRole)
    } catch (err) {
      onError(err.message)
    }
  }

  async function handleAddRoleWord(e) {
    e.preventDefault()
    if (!newRoleWord.trim()) return
    try {
      await addRoleBannedWord(selectedRole, newRoleWord.trim(), token)
      setNewRoleWord('')
      onNotice(`Mot banni ajouté`)
      loadRoleData(selectedRole)
    } catch (err) {
      onError(err.message)
    }
  }

  async function handleDeleteRoleWord(id) {
    try {
      await removeRoleBannedWord(id, token)
      loadRoleData(selectedRole)
    } catch (err) {
      onError(err.message)
    }
  }

  return (
    <div className="admin-overlay">
      <div className="admin-container">
        <div className="admin-header">
          <h1 className="admin-title">Administration</h1>
          <button onClick={onClose} className="admin-close-btn">Fermer Admin</button>
        </div>

        <div className="admin-tabs">
          <button 
            onClick={() => setActiveTab('general')} 
            className={`admin-tab-btn ${activeTab === 'general' ? 'active' : ''}`}
          >
            Paramètres Généraux
          </button>
          <button 
            onClick={() => setActiveTab('users')} 
            className={`admin-tab-btn ${activeTab === 'users' ? 'active' : ''}`}
          >
            Paramètres Utilisateurs
          </button>
          <button 
            onClick={() => setActiveTab('roles')} 
            className={`admin-tab-btn ${activeTab === 'roles' ? 'active' : ''}`}
          >
            Paramètres Rôles
          </button>
          {/* <-- Added Audit Tab Button --> */}
          <button 
            onClick={() => setActiveTab('audit')} 
            className={`admin-tab-btn ${activeTab === 'audit' ? 'active' : ''}`}
          >
            Journal d'Audit
          </button>
        </div>

        {activeTab === 'general' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="admin-card">
              <h2 className="admin-section-title">Mots Bannis (Base de données)</h2>
              <form onSubmit={handleAddGlobalWord} className="admin-form">
                <input 
                  type="text" 
                  value={newWord} 
                  onChange={(e) => setNewWord(e.target.value)} 
                  placeholder="Nouveau mot" 
                  className="admin-input" 
                />
                <button type="submit" className="admin-submit-btn">Ajouter</button>
              </form>
              
              <ul className="admin-list">
                {globalWords.map((word, index) => (
                  <li key={index} className="admin-list-item">
                    <span>{word.word || word}</span>
                    {word.id && (
                      <button 
                        type="button" 
                        onClick={() => handleDeleteGlobalWord(word.id)} 
                        className="admin-delete-btn"
                      >
                        Supprimer
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div className="admin-card">
              <h2 className="admin-section-title">Configuration patterns.json</h2>
              <form onSubmit={handleAddPattern} className="admin-form" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
                <input 
                  type="text" 
                  value={newPatternData.name} 
                  onChange={(e) => setNewPatternData({...newPatternData, name: e.target.value})} 
                  placeholder="Nom (ex: custom_email)" 
                  className="admin-input" 
                  required
                />
                <input 
                  type="text" 
                  value={newPatternData.type} 
                  onChange={(e) => setNewPatternData({...newPatternData, type: e.target.value})} 
                  placeholder="Type (ex: email)" 
                  className="admin-input" 
                  required
                />
                <input 
                  type="text" 
                  value={newPatternData.pattern} 
                  onChange={(e) => setNewPatternData({...newPatternData, pattern: e.target.value})} 
                  placeholder="RegEx Pattern" 
                  className="admin-input" 
                  style={{ gridColumn: 'span 2' }}
                  required
                />
                <select 
                  value={newPatternData.severity} 
                  onChange={(e) => setNewPatternData({...newPatternData, severity: e.target.value})} 
                  className="admin-input"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
                <select
                  value={newPatternData.action}
                  onChange={(e) => setNewPatternData({...newPatternData, action: e.target.value})}
                  className="admin-input"
                >
                  <option value="ALLOW">Allow</option>
                  <option value="MASK">Mask</option>
                  <option value="BLOCK">Block</option>
                </select>
                <input 
                  type="text" 
                  value={newPatternData.validator} 
                  onChange={(e) => setNewPatternData({...newPatternData, validator: e.target.value})} 
                  placeholder="Validator" 
                  className="admin-input" 
                />
                <input 
                  type="number" 
                  value={newPatternData.capture_group} 
                  onChange={(e) => setNewPatternData({...newPatternData, capture_group: e.target.value})} 
                  placeholder="Capture Group" 
                  className="admin-input" 
                  style={{ gridColumn: 'span 1' }}
                />
                <button type="submit" className="admin-submit-btn" style={{ gridColumn: 'span 2', marginTop: '10px' }}>Ajouter au fichier</button>
              </form>
              
              <ul className="admin-list">
                {patterns.map((item, index) => (
                  <li key={item.name || index} className="admin-list-item">
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <strong>{item.name}</strong>
                      <span style={{ fontSize: '12px', color: '#475569', wordBreak: 'break-all' }}>{item.pattern}</span>
                      <span style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
                        Type: {item.type} | Severity: {item.severity} | Action: {item.action || 'legacy'} | {item.enabled === false ? 'Disabled' : 'Enabled'}
                        {item.validator ? ` | Validator: ${item.validator}` : ''}
                        {item.capture_group !== null && item.capture_group !== undefined ? ` | Group: ${item.capture_group}` : ''}
                      </span>
                    </div>
                    {item.name && (
                      <div>
                      <button
                        type="button"
                        onClick={() => handleTogglePattern(item)}
                        className="admin-delete-btn"
                      >
                        {item.enabled === false ? 'Activer' : 'Désactiver'}
                      </button>
                      <button 
                        type="button" 
                        onClick={() => handleDeletePattern(item.name)} 
                        className="admin-delete-btn"
                      >
                        Supprimer
                      </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'general' && (
          <div className="admin-card">
            <h2 className="admin-section-title">Sécurité aujourd'hui</h2>
            <div className="audit-meta">
              Incidents: {securityMetrics?.today?.analysedIncidents ?? 0} · Bloqués: {securityMetrics?.today?.blocked ?? 0} · Masqués: {securityMetrics?.today?.redacted ?? 0} · High/Critical: {(securityMetrics?.highSeverityIncidents ?? 0) + (securityMetrics?.criticalIncidents ?? 0)}
            </div>
          </div>
        )}

        {activeTab === 'general' && (
          <div className="admin-card">
            <h2 className="admin-section-title">Modèles LLM</h2>
            <form onSubmit={handleCreateProvider} className="admin-form">
              <input className="admin-input" placeholder="Provider code" value={newProvider.code} onChange={e => setNewProvider({ ...newProvider, code: e.target.value })} required />
              <input className="admin-input" placeholder="Provider name" value={newProvider.name} onChange={e => setNewProvider({ ...newProvider, name: e.target.value })} required />
              <button className="admin-submit-btn" type="submit">Ajouter fournisseur</button>
            </form>
            <form onSubmit={handleCreateAdminModel} className="admin-form">
              <select className="admin-input" value={newAdminModel.providerId} onChange={e => setNewAdminModel({ ...newAdminModel, providerId: e.target.value })} required>
                <option value="">Fournisseur</option>
                {adminProviders.map(provider => <option key={provider.id} value={provider.id}>{provider.nom}</option>)}
              </select>
              <input className="admin-input" placeholder="Internal alias" value={newAdminModel.alias} onChange={e => setNewAdminModel({ ...newAdminModel, alias: e.target.value })} required />
              <input className="admin-input" placeholder="LiteLLM model ID" value={newAdminModel.providerModel} onChange={e => setNewAdminModel({ ...newAdminModel, providerModel: e.target.value })} required />
              <input className="admin-input" placeholder="Display name" value={newAdminModel.displayName} onChange={e => setNewAdminModel({ ...newAdminModel, displayName: e.target.value })} required />
              <button className="admin-submit-btn" type="submit">Ajouter modèle</button>
            </form>
            <ul className="admin-list">
              {adminModels.map(model => (
                <li key={model.id} className="admin-list-item">
                  <div>
                    <strong>{model.nomAffichage || model.aliasInterne}</strong>
                    <span className="audit-meta">{model.aliasInterne} · {model.nomModeleProvider} · {model.statut}</span>
                  </div>
                  <div>
                    <button type="button" className="admin-delete-btn" onClick={() => handleTestAdminModel(model)}>Tester</button>
                    <button type="button" className="admin-delete-btn" onClick={() => handleToggleAdminModel(model)}>
                      {model.statut === 'ACTIF' ? 'Désactiver' : 'Activer'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="admin-card">
            <h2 className="admin-section-title">Rechercher et Sélectionner un Utilisateur</h2>
            
            <div className="admin-group">
              <input 
                type="text" 
                value={userSearchQuery} 
                onChange={(e) => setUserSearchQuery(e.target.value)} 
                placeholder="Filtrer par nom d'affichage ou ID externe..." 
                className="admin-input"
                style={{ width: '100%', marginBottom: '12px', boxSizing: 'border-box' }}
              />

              <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '12px', background: 'white' }}>
                {filteredUsers.length === 0 ? (
                  <div style={{ padding: '12px', color: '#6b7280', fontSize: '14px', textAlign: 'center' }}>Aucun utilisateur trouvé</div>
                ) : (
                  filteredUsers.map((u) => (
                    <div 
                      key={u.id}
                      onClick={() => handleSelectUser(u)}
                      style={{
                        padding: '10px 16px',
                        cursor: 'pointer',
                        borderBottom: '1px solid #f3f4f6',
                        background: selectedUser?.id === u.id ? '#f0f7fa' : 'white',
                        fontWeight: selectedUser?.id === u.id ? '600' : '400',
                        color: '#374151',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <span>{u.nomAffichage || u.id}</span>
                      <span style={{ fontSize: '12px', color: '#9ca3af' }}>{u.externalId}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {selectedUser && (
              <>
                <div style={{ padding: '12px 16px', background: '#f8fafc', borderRadius: '12px', marginBottom: '24px', fontSize: '14px', color: '#475569' }}>
                  <strong>Utilisateur actif :</strong> {selectedUser.nomAffichage || selectedUser.externalId} 
                  {selectedUser.keycloakManaged && (
                    <button type="button" className="admin-delete-btn" onClick={() => handleToggleKeycloakUser(selectedUser)}>
                      {selectedUser.enabled ? 'Désactiver le compte' : 'Activer le compte'}
                    </button>
                  )}
                </div>

                {selectedUser.keycloakManaged && keycloakRoles.length > 0 && (
                  <div className="admin-group">
                    <h3 className="admin-subsection-title">Rôles Keycloak</h3>
                    <select
                      multiple
                      value={selectedKeycloakRoles}
                      onChange={(e) => setSelectedKeycloakRoles(Array.from(e.target.selectedOptions, option => option.value))}
                      className="admin-input"
                      style={{ minHeight: '90px' }}
                    >
                      {keycloakRoles.map(role => <option key={role.id || role.name} value={role.name}>{role.name}</option>)}
                    </select>
                    <button type="button" className="admin-submit-btn blue" onClick={handleAssignKeycloakRoles}>Enregistrer les rôles</button>
                  </div>
                )}

                <div className="admin-group">
                  <h3 className="admin-subsection-title">Restrictions Modèles</h3>
                  <form onSubmit={handleAddRestriction} className="admin-form spacing-bottom">
                    <select 
                      value={modelAlias} 
                      onChange={(e) => setModelAlias(e.target.value)} 
                      className="admin-input"
                    >
                      {availableModels.map((m) => (
                        <option key={m.alias} value={m.alias}>{m.displayName}</option>
                      ))}
                    </select>
                    <button type="submit" className="admin-submit-btn blue">Restreindre</button>
                  </form>
                  
                  <ul className="admin-list">
                    {userRestrictions.map((req) => (
                      <li key={req.id} className="admin-list-item">
                        <span>{req.llmModelAlias}</span>
                        <button 
                          type="button" 
                          onClick={() => handleDeleteRestriction(req.id)} 
                          className="admin-delete-btn"
                        >
                          Supprimer
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="admin-subsection-title">Mots Bannis Spécifiques</h3>
                  <form onSubmit={handleAddUserWord} className="admin-form spacing-bottom">
                    <input 
                      type="text" 
                      value={newUserWord} 
                      onChange={(e) => setNewUserWord(e.target.value)} 
                      placeholder="Mot banni" 
                      className="admin-input" 
                    />
                    <button type="submit" className="admin-submit-btn blue">Bannir Mot</button>
                  </form>
                  
                  <ul className="admin-list">
                    {userBannedWords.map((wordObj) => (
                      <li key={wordObj.id} className="admin-list-item">
                        <span>{wordObj.word}</span>
                        <button 
                          type="button" 
                          onClick={() => handleDeleteUserWord(wordObj.id)} 
                          className="admin-delete-btn"
                        >
                          Supprimer
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'roles' && (
          <div className="admin-card">
            <h2 className="admin-section-title">Administration par Rôle</h2>
            
            <div className="admin-group" style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                {['INTERN', 'EXTERN'].map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setSelectedRole(role)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: '1px solid #d1d5db',
                      background: selectedRole === role ? '#0284c7' : '#ffffff',
                      color: selectedRole === role ? '#ffffff' : '#374151',
                      cursor: 'pointer',
                      fontWeight: '600'
                    }}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ padding: '12px 16px', background: '#f8fafc', borderRadius: '12px', marginBottom: '24px', fontSize: '14px', color: '#475569' }}>
              <strong>Rôle actif :</strong> {selectedRole}
            </div>

            <div className="admin-group" style={{ marginBottom: '24px' }}>
              <h3 className="admin-subsection-title">Restrictions Modèles</h3>
              <form onSubmit={handleAddRoleRestriction} className="admin-form spacing-bottom">
                <select 
                  value={roleModelAlias} 
                  onChange={(e) => setRoleModelAlias(e.target.value)} 
                  className="admin-input"
                >
                  <option value="">Sélectionner un modèle...</option>
                  {availableModels.map((m) => (
                    <option key={m.alias} value={m.alias}>{m.displayName}</option>
                  ))}
                </select>
                <button type="submit" className="admin-submit-btn blue">Restreindre le Rôle</button>
              </form>
              
              <ul className="admin-list">
                {roleRestrictions.map((req) => (
                  <li key={req.id} className="admin-list-item">
                    <span>{req.llmModelAlias}</span>
                    <button 
                      type="button" 
                      onClick={() => handleDeleteRoleRestriction(req.id)} 
                      className="admin-delete-btn"
                    >
                      Supprimer
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="admin-subsection-title">Mots Bannis</h3>
              <form onSubmit={handleAddRoleWord} className="admin-form spacing-bottom">
                <input 
                  type="text" 
                  value={newRoleWord} 
                  onChange={(e) => setNewRoleWord(e.target.value)} 
                  placeholder="Mot banni" 
                  className="admin-input" 
                />
                <button type="submit" className="admin-submit-btn blue">Bannir Mot</button>
              </form>
              
              <ul className="admin-list">
                {roleBannedWords.map((wordObj) => (
                  <li key={wordObj.id} className="admin-list-item">
                    <span>{wordObj.word}</span>
                    <button 
                      type="button" 
                      onClick={() => handleDeleteRoleWord(wordObj.id)} 
                      className="admin-delete-btn"
                    >
                      Supprimer
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* <-- Added Audit Log UI --> */}
        {activeTab === 'audit' && (
          <>
            <div className="audit-subtabs">
              <button className={auditView === 'permissions' ? 'active' : ''} onClick={() => setAuditView('permissions')}>
                Permission Changes
              </button>
              <button className={auditView === 'filtered' ? 'active' : ''} onClick={() => setAuditView('filtered')}>
                Blocked / Redacted Messages
              </button>
            </div>

            {auditView === 'permissions' ? (
              <>
                <div className="audit-filters">
                  <input className="admin-input" value={auditSearch} placeholder="Search audit records" onChange={e => { setAuditSearch(e.target.value); setAuditPage(0) }} />
                  <input className="admin-input" value={auditAction} placeholder="Action (CREATE, DELETE...)" onChange={e => { setAuditAction(e.target.value); setAuditPage(0) }} />
                  <input className="admin-input" value={auditEntity} placeholder="Entity (role, pattern...)" onChange={e => { setAuditEntity(e.target.value); setAuditPage(0) }} />
                </div>
                <ul className="audit-list">
                {auditLogs.map(log => (
                  <li key={log.id}>
                    <strong>{log.action}</strong> {log.entityName} — {log.entityId}
                    <span className="audit-meta">{log.performedBy} · {new Date(log.timestamp).toLocaleString()}</span>
                  </li>
                ))}
                </ul>
                <Pagination page={auditPage} totalPages={auditTotalPages} onChange={setAuditPage} />
              </>
            ) : (
              <>
                <div className="audit-filters">
                  <input className="admin-input" value={filteredSearch} placeholder="Search reason or message content" onChange={e => { setFilteredSearch(e.target.value); setFilteredPage(0) }} />
                  <input className="admin-input" value={filteredAction} placeholder="Action (BLOCKED, REDACTED...)" onChange={e => { setFilteredAction(e.target.value); setFilteredPage(0) }} />
                  <input className="admin-input" value={filteredUserId} placeholder="User UUID" onChange={e => { setFilteredUserId(e.target.value); setFilteredPage(0) }} />
                </div>
                <ul className="audit-list">
                {filteredMessages.map(msg => {
                  const isRevealed = revealedIds.has(msg.id)
                  return (
                    <li key={msg.id}>
                      <strong>{msg.action}</strong> — {msg.reason}
                      <span className="audit-meta">{msg.userKeycloakId} · {new Date(msg.timestamp).toLocaleString()}</span>
                      <div className="audit-content">
                        <span className="audit-meta">Severity: {msg.highestSeverity || 'unknown'} · Detections: {msg.detectionCount ?? 0} · Status: {msg.requestStatus || msg.action}</span>
                        {msg.detectedTypes && <span className="audit-meta">Categories: {msg.detectedTypes}</span>}
                        {isRevealed ? (
                          <>
                            <p className="audit-original"><em>Original:</em> {msg.originalContent}</p>
                            {msg.redactedContent && (
                              <p className="audit-redacted"><em>Redacted:</em> {msg.redactedContent}</p>
                            )}
                            <button onClick={() => toggleReveal(msg.id)}>Hide</button>
                          </>
                        ) : (
                          <button onClick={() => toggleReveal(msg.id)}>Reveal content</button>
                        )}
                      </div>
                    </li>
                  )
                })}
                </ul>
                <Pagination page={filteredPage} totalPages={filteredTotalPages} onChange={setFilteredPage} />
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null
  return (
    <div className="audit-pagination">
      <button disabled={page === 0} onClick={() => onChange(page - 1)}>Previous</button>
      <span>Page {page + 1} of {totalPages}</span>
      <button disabled={page + 1 >= totalPages} onClick={() => onChange(page + 1)}>Next</button>
    </div>
  )
}
