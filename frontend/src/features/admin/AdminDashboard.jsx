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
import ModelLogo from '../models/components/ModelLogo'
import { modelCardMeta, modelProviderName } from '../../utils/modelMetadata'
import ConfirmDialog from '../../components/common/ConfirmDialog'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const isUuid = (value) => UUID_PATTERN.test(String(value || ''))

export default function AdminDashboard({ onError, onNotice, onClose }) {
  const keycloak = useContext(AuthContext)
  const token = keycloak?.token

  const [activeTab, setActiveTab] = useState('overview')
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
  const [overviewMessages, setOverviewMessages] = useState([])
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
  const [expandedAuditIds, setExpandedAuditIds] = useState(new Set())
  const [confirmation, setConfirmation] = useState(null)
  const [modelTestResults, setModelTestResults] = useState({})
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditError, setAuditError] = useState('')
  const [roleLoading, setRoleLoading] = useState(false)
  const [userDetailLoading, setUserDetailLoading] = useState(false)
  const [userDetailError, setUserDetailError] = useState('')
  const [requestState, setRequestState] = useState({})
  const [modelConfigOpen, setModelConfigOpen] = useState(false)

  // The loaders are stable component-local commands; this effect intentionally runs once per token.
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!token) return

    loadGlobalWords()
    loadModels()
    loadUsers()
    loadPatterns()
    loadAdminModels()
    loadAdminProviders()
    loadSecurityMetrics()
    loadKeycloakRoles()
    loadOverviewMessages()
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
  /* eslint-enable react-hooks/exhaustive-deps */

  async function loadOverviewMessages() {
    setRequestStatus('overview', 'loading')
    try {
      const data = await fetchFilteredMessages(token, {
        page: 0,
        size: 100,
        search: '',
        action: '',
        userId: ''
      })
      setOverviewMessages(data?.content || [])
      setRequestStatus('overview', 'success')
    } catch (err) {
      setOverviewMessages([])
      setRequestStatus('overview', 'error', err.message || 'Impossible de charger les données de sécurité.')
    }
  }

  async function loadFilteredMessages() {
    setRequestStatus('audit', 'loading')
    setAuditLoading(true)
    setAuditError('')
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
      setRequestStatus('audit', 'success')
    } catch (err) {
      setAuditError(err.message || 'Impossible de charger les messages filtrés.')
      setRequestStatus('audit', 'error', err.message || 'Impossible de charger les messages filtrés.')
      onError(err.message)
    } finally {
      setAuditLoading(false)
    }
  }
  function toggleReveal(id) {
    setRevealedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function requestConfirmation({ title, message, onConfirm }) {
    setConfirmation({ title, message, onConfirm })
  }

  function setRequestStatus(key, status, error = '') {
    setRequestState((current) => ({ ...current, [key]: { status, error } }))
  }

  const isLoading = (key) => requestState[key]?.status === 'loading'
  const requestError = (key) => requestState[key]?.error || ''
  async function loadAuditLogs() {
    setRequestStatus('audit', 'loading')
    setAuditLoading(true)
    setAuditError('')
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
      setRequestStatus('audit', 'success')
    } catch (err) {
      setAuditError(err.message || 'Impossible de charger le journal.')
      setRequestStatus('audit', 'error', err.message || 'Impossible de charger le journal.')
      onError(err.message)
    } finally {
      setAuditLoading(false)
    }
  }

  async function loadPatterns() {
    setRequestStatus('patterns', 'loading')
    try {
      const data = await fetchPatterns(token)
      setPatterns(data || [])
      setRequestStatus('patterns', 'success')
    } catch (err) {
      setRequestStatus('patterns', 'error', err.message || 'Impossible de charger les patterns.')
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
    setRequestStatus('models', 'loading')
    try {
      const data = await fetchAdminModels(token)
      setAdminModels(data || [])
      setRequestStatus('models', 'success')
    } catch (err) {
      setRequestStatus('models', 'error', err.message || 'Impossible de charger les modèles.')
      onError(err.message)
    }
  }

  function configureExistingModel(model) {
    const providerName = modelProviderName(model.alias)
    const matchingProvider = adminProviders.find((provider) => {
      const name = String(provider.nom || provider.name || '').toLowerCase()
      const code = String(provider.code || '').toLowerCase()
      const wanted = String(providerName || '').toLowerCase()
      return Boolean(wanted) && (name.includes(wanted) || wanted.includes(name) || code === wanted)
    })

    setNewAdminModel((current) => ({
      ...current,
      providerId: matchingProvider ? String(matchingProvider.id) : current.providerId,
      alias: model.alias,
      providerModel: '',
      displayName: model.displayName,
    }))

    setActiveTab('models')
    setModelConfigOpen(true)
    window.requestAnimationFrame(() => {
      document.querySelector('.admin-model-create-card--model')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
    onNotice(`${model.displayName} est disponible dans Synapse. Complétez la configuration du modèle.`)
  }

  async function loadAdminProviders() {
    setRequestStatus('providers', 'loading')
    try {
      const data = await fetchAdminProviders(token)
      setAdminProviders(data || [])
      if (!newAdminModel.providerId && data?.length) setNewAdminModel(value => ({ ...value, providerId: String(data[0].id) }))
      setRequestStatus('providers', 'success')
    } catch (err) {
      setRequestStatus('providers', 'error', err.message || 'Impossible de charger les fournisseurs.')
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
    setRequestStatus('security', 'loading')
    try {
      setSecurityMetrics(await fetchSecurityMetrics(token))
      setRequestStatus('security', 'success')
    } catch (err) {
      setRequestStatus('security', 'error', err.message || 'Impossible de charger les indicateurs de sécurité.')
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
      setModelTestResults((current) => ({ ...current, [model.id]: { ...result, testedAt: new Date().toISOString() } }))
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
    setRequestStatus('catalog', 'loading')
    try {
      const data = await fetchModelDetails(token)
      setAvailableModels(data || [])
      if (data && data.length > 0) {
        setModelAlias(data[0].alias)
        setRoleModelAlias(data[0].alias)
      }
      setRequestStatus('catalog', 'success')
    } catch (err) {
      setRequestStatus('catalog', 'error', err.message || 'Impossible de charger le catalogue des modèles.')
      onError(err.message)
    }
  }

  async function loadGlobalWords() {
    setRequestStatus('globalWords', 'loading')
    try {
      const data = await fetchGlobalBannedWords(token)
      setGlobalWords(data || [])
      setRequestStatus('globalWords', 'success')
    } catch (err) {
      setRequestStatus('globalWords', 'error', err.message || 'Impossible de charger les mots bannis.')
      onError(err.message)
    }
  }

  async function loadUsers() {
    setRequestStatus('users', 'loading')
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
      setRequestStatus('users', 'success')
    } catch (err) {
      setRequestStatus('users', 'error', err.message || 'Impossible de charger les utilisateurs.')
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
    setUserDetailLoading(true)
    setUserDetailError('')
    try {
      const modelsData = await fetchUserRestrictions(targetUuid, token)
      setUserRestrictions(modelsData || [])

      const wordsData = await fetchUserBannedWords(targetUuid, token)
      setUserBannedWords(wordsData || [])
    } catch (err) {
      setUserDetailError(err.message || 'Impossible de charger les permissions utilisateur.')
      onError(err.message)
    } finally {
      setUserDetailLoading(false)
    }
  }

  async function loadRoleData(role) {
    setRoleLoading(true)
    setRequestStatus('roles', 'loading')
    try {
      const modelsData = await fetchRoleRestrictions(role, token)
      setRoleRestrictions(modelsData || [])

      const wordsData = await fetchRoleBannedWords(role, token)
      setRoleBannedWords(wordsData || [])
      setRequestStatus('roles', 'success')
    } catch (err) {
      setRequestStatus('roles', 'error', err.message || 'Impossible de charger les règles du rôle.')
      onError(err.message)
    } finally {
      setRoleLoading(false)
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

  const overviewChartData = useMemo(() => {
    const now = new Date()
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(now)
      date.setHours(0, 0, 0, 0)
      date.setDate(date.getDate() - (6 - index))
      return date
    })

    const daily = days.map((day) => ({
      date: day,
      label: day.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', ''),
      count: 0
    }))

    const categories = new Map()

    overviewMessages.forEach((message) => {
      if (!message?.timestamp) return
      const timestamp = new Date(message.timestamp)
      if (Number.isNaN(timestamp.getTime())) return

      const dayIndex = daily.findIndex((day) => (
        timestamp.getFullYear() === day.date.getFullYear() &&
        timestamp.getMonth() === day.date.getMonth() &&
        timestamp.getDate() === day.date.getDate()
      ))

      if (dayIndex >= 0) {
        daily[dayIndex].count += 1
      }

      const rawTypes = String(message.detectedTypes || '').split(/[|,;]+/)
      rawTypes
        .map((item) => item.trim())
        .filter(Boolean)
        .forEach((type) => {
          categories.set(type, (categories.get(type) || 0) + 1)
        })
    })

    const categoryRows = Array.from(categories.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count]) => ({ name, count }))

    return {
      daily,
      maxDaily: Math.max(1, ...daily.map((item) => item.count)),
      categories: categoryRows,
      maxCategory: Math.max(1, ...categoryRows.map((item) => item.count))
    }
  }, [overviewMessages])

  function chartScaleClass(value, max, prefix) {
    const scale = Math.max(1, Math.min(10, Math.ceil((value / Math.max(1, max)) * 10)))
    return `${prefix}--${scale}`
  }

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
    if (isUuid(user.externalId)) {
      await loadUserDataForUuid(user.externalId)
    } else {
      setUserRestrictions([])
      setUserBannedWords([])
    }
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
    if (!selectedUser || !isUuid(selectedUser.externalId) || !modelAlias.trim()) return
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
    if (!selectedUser || !isUuid(selectedUser.externalId) || !newUserWord.trim()) return
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
    <div className="admin-view">
      <div className="admin-content">
        <div className="admin-page-heading">
          <div>
            <span className="admin-eyebrow">CENTRE DE CONTRÔLE</span>
            <h1>Administration</h1>
            <p>Gérez les utilisateurs, les modèles et la sécurité de Synapse.</p>
          </div>
          {onClose && <button type="button" className="admin-back-button admin-page-back-button" onClick={onClose}>Retour au chat</button>}
        </div>

        <nav className="admin-navigation">
          <button
            type="button"
            className={`admin-nav-item ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <span className="admin-nav-icon admin-nav-icon-overview" aria-hidden="true" />
            Vue d'ensemble
          </button>

          <button
            type="button"
            className={`admin-nav-item ${activeTab === 'general' ? 'active' : ''}`}
            onClick={() => setActiveTab('general')}
          >
            <span className="admin-nav-icon admin-nav-icon-security" aria-hidden="true" />
            Sécurité
          </button>

          <button
            type="button"
            className={`admin-nav-item ${activeTab === 'models' ? 'active' : ''}`}
            onClick={() => setActiveTab('models')}
          >
            <span className="admin-nav-icon admin-nav-icon-models" aria-hidden="true" />
            Modèles
          </button>

          <button
            type="button"
            className={`admin-nav-item ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            <span className="admin-nav-icon admin-nav-icon-users" aria-hidden="true" />
            Utilisateurs
          </button>

          <button
            type="button"
            className={`admin-nav-item ${activeTab === 'roles' ? 'active' : ''}`}
            onClick={() => setActiveTab('roles')}
          >
            <span className="admin-nav-icon admin-nav-icon-roles" aria-hidden="true" />
            Rôles
          </button>

          <button
            type="button"
            className={`admin-nav-item ${activeTab === 'audit' ? 'active' : ''}`}
            onClick={() => setActiveTab('audit')}
          >
            <span className="admin-nav-icon admin-nav-icon-audit" aria-hidden="true" />
            Journal d'audit
          </button>
        </nav>

        {activeTab === 'overview' && (
          <>
            <div className="admin-stat-grid">
              <div className="admin-stat-card">
                <span>Utilisateurs</span>
                <strong><MetricValue loading={isLoading('users')} error={requestError('users')} value={users.length} /></strong>
                <small>Comptes connus</small>
              </div>
              <div className="admin-stat-card">
                <span>Modèles actifs</span>
                <strong><MetricValue loading={isLoading('models')} error={requestError('models')} value={adminModels.filter(model => model.statut === 'ACTIF').length} /></strong>
                <small>Sur {adminModels.length} configurés</small>
              </div>
              <div className="admin-stat-card">
                <span>Patterns DLP</span>
                <strong><MetricValue loading={isLoading('patterns')} error={requestError('patterns')} value={patterns.length} /></strong>
                <small>{patterns.filter(item => item.enabled !== false).length} actifs</small>
              </div>
              <div className="admin-stat-card">
                <span>Mots bannis</span>
                <strong><MetricValue loading={isLoading('globalWords')} error={requestError('globalWords')} value={globalWords.length} /></strong>
                <small>Règles globales</small>
              </div>
            </div>

            <div className="admin-card admin-security-summary">
              <div>
                <span className="admin-card-kicker">SÉCURITÉ AUJOURD'HUI</span>
                <h2 className="admin-section-title">Protection DLP</h2>
                <p className="admin-overview-description">Surveillez les incidents détectés et les actions appliquées par le gateway.</p>
              </div>
              <div className="admin-security-metrics">
                <div>
                  <strong><MetricValue loading={isLoading('security')} error={requestError('security')} value={securityMetrics?.today?.analysedIncidents ?? 0} /></strong>
                  <span>Incidents</span>
                </div>
                <div>
                  <strong><MetricValue loading={isLoading('security')} error={requestError('security')} value={securityMetrics?.today?.blocked ?? 0} /></strong>
                  <span>Bloqués</span>
                </div>
                <div>
                  <strong><MetricValue loading={isLoading('security')} error={requestError('security')} value={securityMetrics?.today?.redacted ?? 0} /></strong>
                  <span>Masqués</span>
                </div>
                <div>
                  <strong><MetricValue loading={isLoading('security')} error={requestError('security')} value={(securityMetrics?.highSeverityIncidents ?? 0) + (securityMetrics?.criticalIncidents ?? 0)} /></strong>
                  <span>Élevés / critiques</span>
                </div>
              </div>
            </div>

            <div className="admin-chart-grid">
              <div className="admin-card admin-chart-card">
                <div className="admin-card-heading-row">
                  <div>
                    <span className="admin-card-kicker">TENDANCE</span>
                    <h2 className="admin-section-title">Incidents DLP · 7 derniers jours</h2>
                  </div>
                  <span className="admin-chart-note">{overviewMessages.length} incidents récents</span>
                </div>

                {isLoading('overview') ? <div className="admin-loading-state">Chargement des incidents…</div> : requestError('overview') ? <div className="admin-error-state">{requestError('overview')}</div> : <div className="admin-bar-chart" aria-label="Incidents DLP sur les 7 derniers jours">
                  {overviewChartData.daily.map((item) => (
                    <div className="admin-bar-column" key={item.date.toISOString()}>
                      <div className="admin-bar-value">{item.count}</div>
                      <div className="admin-bar-track">
                        <div
                          className={`admin-bar-fill ${chartScaleClass(item.count, overviewChartData.maxDaily, 'admin-bar-height')}`}
                          title={`${item.count} incident${item.count > 1 ? 's' : ''}`}
                        />
                      </div>
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>}
              </div>

              <div className="admin-card admin-chart-card">
                <div className="admin-card-heading-row">
                  <div>
                    <span className="admin-card-kicker">DÉTECTION</span>
                    <h2 className="admin-section-title">Catégories détectées</h2>
                  </div>
                </div>

                {overviewChartData.categories.length === 0 ? (
                  <div className="admin-chart-empty">
                    Pas assez de données récentes pour afficher la répartition.
                  </div>
                ) : (
                  <div className="admin-category-chart">
                    {overviewChartData.categories.map((item) => (
                      <div className="admin-category-row" key={item.name}>
                        <div className="admin-category-label">
                          <span>{item.name}</span>
                          <strong>{item.count}</strong>
                        </div>
                        <div className="admin-category-track">
                          <div
                            className={`admin-category-fill ${chartScaleClass(item.count, overviewChartData.maxCategory, 'admin-category-width')}`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="admin-card">
              <div className="admin-card-heading-row">
                <div>
                  <span className="admin-card-kicker">ACTIONS RAPIDES</span>
                  <h2 className="admin-section-title">Accès direct</h2>
                </div>
              </div>
              <div className="admin-quick-actions">
                <button type="button" onClick={() => setActiveTab('users')}>
                  <strong>Utilisateurs</strong>
                  <span>Gérer les comptes et rôles Keycloak</span>
                </button>
                <button type="button" onClick={() => setActiveTab('models')}>
                  <strong>Modèles</strong>
                  <span>Ajouter, tester ou désactiver un modèle</span>
                </button>
                <button type="button" onClick={() => setActiveTab('general')}>
                  <strong>Sécurité</strong>
                  <span>Configurer mots bannis et patterns DLP</span>
                </button>
                <button type="button" onClick={() => setActiveTab('audit')}>
                  <strong>Journal d'audit</strong>
                  <span>Consulter les changements et incidents</span>
                </button>
              </div>
            </div>
          </>
        )}

        {activeTab === 'general' && (
          <>
            <div className="admin-card admin-security-summary">
              <div>
                <span className="admin-card-kicker">SÉCURITÉ AUJOURD'HUI</span>
                <h2 className="admin-section-title">Protection DLP</h2>
              </div>
              <div className="admin-security-metrics">
                <div><strong><MetricValue loading={isLoading('security')} error={requestError('security')} value={securityMetrics?.today?.analysedIncidents ?? 0} /></strong><span>Incidents</span></div>
                <div><strong><MetricValue loading={isLoading('security')} error={requestError('security')} value={securityMetrics?.today?.blocked ?? 0} /></strong><span>Bloqués</span></div>
                <div><strong><MetricValue loading={isLoading('security')} error={requestError('security')} value={securityMetrics?.today?.redacted ?? 0} /></strong><span>Masqués</span></div>
                <div><strong><MetricValue loading={isLoading('security')} error={requestError('security')} value={(securityMetrics?.highSeverityIncidents ?? 0) + (securityMetrics?.criticalIncidents ?? 0)} /></strong><span>Élevés / critiques</span></div>
              </div>
            </div>

            <div className="admin-card">
              <div className="admin-card-heading-row">
                <div>
                  <span className="admin-card-kicker">RÈGLES GLOBALES</span>
                  <h2 className="admin-section-title">Mots bannis</h2>
                </div>
              </div>
              <form onSubmit={handleAddGlobalWord} className="admin-form">
                <input type="text" value={newWord} onChange={(e) => setNewWord(e.target.value)} placeholder="Ajouter un mot ou une expression..." className="admin-input" />
                <button type="submit" className="admin-submit-btn">Ajouter</button>
              </form>
              <ul className="admin-list">
                {isLoading('globalWords') ? <li className="admin-loading-state">Chargement des mots bannis…</li> : requestError('globalWords') ? <li className="admin-error-state">{requestError('globalWords')}</li> : globalWords.length === 0 ? (
                  <li className="admin-empty-state">Aucun mot banni configuré.</li>
                ) : globalWords.map((word, index) => (
                  <li key={index} className="admin-list-item">
                    <span>{word.word || word}</span>
                    {word.id && (
                        <button type="button" onClick={() => requestConfirmation({ title: 'Supprimer ce mot ?', message: 'Cette action supprime définitivement ce mot banni.', onConfirm: () => handleDeleteGlobalWord(word.id) })} className="admin-delete-btn">Supprimer</button>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div className="admin-card">
              <div className="admin-card-heading-row">
                <div>
                  <span className="admin-card-kicker">DÉTECTION</span>
                  <h2 className="admin-section-title">Patterns DLP</h2>
                </div>
                <span className="admin-count-badge">{patterns.length} règles</span>
              </div>
              <form onSubmit={handleAddPattern} className="admin-form admin-pattern-form">
                <input type="text" value={newPatternData.name} onChange={(e) => setNewPatternData({...newPatternData, name: e.target.value})} placeholder="Nom" className="admin-input" required />
                <input type="text" value={newPatternData.type} onChange={(e) => setNewPatternData({...newPatternData, type: e.target.value})} placeholder="Type" className="admin-input" required />
                <input type="text" value={newPatternData.pattern} onChange={(e) => setNewPatternData({...newPatternData, pattern: e.target.value})} placeholder="Expression régulière" className="admin-input admin-pattern-input" required />
                <select value={newPatternData.severity} onChange={(e) => setNewPatternData({...newPatternData, severity: e.target.value})} className="admin-input">
                  <option value="low">Faible</option>
                  <option value="medium">Moyenne</option>
                  <option value="high">Élevée</option>
                </select>
                <select value={newPatternData.action} onChange={(e) => setNewPatternData({...newPatternData, action: e.target.value})} className="admin-input">
                  <option value="ALLOW">Autoriser</option>
                  <option value="MASK">Masquer</option>
                  <option value="BLOCK">Bloquer</option>
                </select>
                <button type="submit" className="admin-submit-btn">Ajouter un pattern</button>
              </form>

              <ul className="admin-list">
                {isLoading('patterns') ? <li className="admin-loading-state">Chargement des patterns…</li> : requestError('patterns') ? <li className="admin-error-state">{requestError('patterns')}</li> : patterns.length === 0 ? (
                  <li className="admin-empty-state">Aucun pattern configuré.</li>
                ) : patterns.map((item, index) => (
                  <li key={item.name || index} className="admin-list-item admin-pattern-item">
                    <div className="admin-pattern-info">
                      <div className="admin-pattern-title-row">
                        <strong>{item.name}</strong>
                        <span className={`admin-status-badge ${item.enabled === false ? 'inactive' : 'active'}`}>
                          {item.enabled === false ? 'Désactivé' : 'Actif'}
                        </span>
                      </div>
                      <code>{item.pattern}</code>
                      <span className="admin-meta-line">{item.type} · {item.severity} · {item.action || 'legacy'}</span>
                    </div>
                    {item.name && (
                      <div className="admin-row-actions">
                        <button type="button" onClick={() => handleTogglePattern(item)} className="admin-delete-btn">
                          {item.enabled === false ? 'Activer' : 'Désactiver'}
                        </button>
                        <button type="button" onClick={() => requestConfirmation({ title: 'Supprimer ce pattern ?', message: 'Cette règle DLP sera supprimée définitivement.', onConfirm: () => handleDeletePattern(item.name) })} className="admin-delete-btn">Supprimer</button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        {activeTab === 'models' && (
          <div className="admin-models-page">
            <div className="admin-card">
              <div className="admin-card-heading-row">
                <div>
                  <span className="admin-card-kicker">LLM GATEWAY</span>
                  <h2 className="admin-section-title">Modèles</h2>
                  <p className="admin-overview-description">
                    Les modèles déjà exposés par Synapse apparaissent automatiquement. Les modèles configurés ici bénéficient ensuite des contrôles d’administration.
                  </p>
                </div>
                <span className="admin-count-badge">
                  {availableModels.length} disponible{availableModels.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="admin-model-create-grid">
                <div className="admin-model-create-card">
                  <div className="admin-card-kicker">FOURNISSEUR</div>
                  <h3 className="admin-subsection-title">Ajouter un fournisseur</h3>
                  <p className="admin-overview-description">
                    Déclarez un nouveau fournisseur avant d&apos;y associer ses modèles.
                  </p>

                  <form onSubmit={handleCreateProvider} className="admin-form admin-model-form">
                    <input
                      className="admin-input"
                      placeholder="Code fournisseur"
                      value={newProvider.code}
                      onChange={e => setNewProvider({ ...newProvider, code: e.target.value })}
                      required
                    />
                    <input
                      className="admin-input"
                      placeholder="Nom du fournisseur"
                      value={newProvider.name}
                      onChange={e => setNewProvider({ ...newProvider, name: e.target.value })}
                      required
                    />
                    <button className="admin-submit-btn" type="submit">
                      Ajouter le fournisseur
                    </button>
                  </form>
                </div>

                <div className="admin-model-create-card admin-model-create-card--model">
                  <div className="admin-card-kicker">CONFIGURATION</div>
                  <h3 className="admin-subsection-title">Configurer un modèle</h3>
                  <p className="admin-overview-description">
                    Utilisez un modèle déjà disponible dans Synapse ou créez une nouvelle entrée administrable.
                  </p>

                  <button type="button" className="admin-secondary-btn admin-config-toggle" aria-expanded={modelConfigOpen} onClick={() => setModelConfigOpen((current) => !current)}>
                    {modelConfigOpen ? 'Masquer le formulaire' : 'Ouvrir la configuration'}
                  </button>
                  {modelConfigOpen && <form onSubmit={handleCreateAdminModel} className="admin-form admin-model-form">
                    <select
                      className="admin-input"
                      value={newAdminModel.providerId}
                      onChange={e => setNewAdminModel({ ...newAdminModel, providerId: e.target.value })}
                      required
                    >
                      <option value="">Fournisseur</option>
                      {adminProviders.map(provider => (
                        <option key={provider.id} value={provider.id}>{provider.nom || provider.name || provider.code}</option>
                      ))}
                    </select>
                    <input
                      className="admin-input"
                      placeholder="Alias interne (ex. secure-groq)"
                      value={newAdminModel.alias}
                      onChange={e => setNewAdminModel({ ...newAdminModel, alias: e.target.value })}
                      required
                    />
                    <input
                      className="admin-input"
                      placeholder="LiteLLM model ID"
                      value={newAdminModel.providerModel}
                      onChange={e => setNewAdminModel({ ...newAdminModel, providerModel: e.target.value })}
                      required
                    />
                    <input
                      className="admin-input"
                      placeholder="Nom affiché"
                      value={newAdminModel.displayName}
                      onChange={e => setNewAdminModel({ ...newAdminModel, displayName: e.target.value })}
                      required
                    />
                    <button className="admin-submit-btn" type="submit">
                      Enregistrer le modèle
                    </button>
                  </form>}
                </div>
              </div>
            </div>

            <div className="admin-card">
              <div className="admin-card-heading-row">
                <div>
                  <span className="admin-card-kicker">CATALOGUE SYNAPSE</span>
                  <h2 className="admin-section-title">Modèles disponibles</h2>
                  <p className="admin-overview-description">
                    Un modèle peut être disponible dans le chatbot sans être encore configuré dans l’administration.
                  </p>
                </div>
                <span className="admin-count-badge">
                  {adminModels.length} configuré{adminModels.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="admin-model-grid">
                {isLoading('catalog') || isLoading('models') ? (
                  <div className="admin-loading-state">Chargement des modèles…</div>
                ) : requestError('catalog') || requestError('models') ? (
                  <div className="admin-error-state">{requestError('catalog') || requestError('models')}</div>
                ) : availableModels.length === 0 ? (
                  <div className="admin-empty-state">
                    Aucun modèle n&apos;a été retourné par le catalogue Synapse.
                  </div>
                ) : availableModels.map(model => {
                  const meta = modelCardMeta(model.alias)
                  const adminModel = adminModels.find((item) => item.aliasInterne === model.alias || item.alias === model.alias)
                  const provider = modelProviderName(model.alias)

                  return (
                    <article key={model.alias} className="admin-model-card">
                      <div className={`admin-model-card-visual ${meta.tone || ''}`}>
                        <ModelLogo
                          alias={model.alias}
                          className="admin-model-card-logo"
                          fallback={meta.initials}
                        />
                      </div>

                      <div className="admin-model-card-body">
                        <div className="admin-model-card-heading">
                          <div className="admin-model-card-title-wrap">
                            <h3>{model.displayName}</h3>
                            <span className="admin-meta-line">{provider}</span>
                          </div>

                          <span className={`admin-status-badge ${adminModel ? (adminModel.statut === 'ACTIF' ? 'active' : 'inactive') : 'available'}`}>
                            {adminModel ? (adminModel.statut === 'ACTIF' ? 'Actif' : 'Inactif') : 'Disponible'}
                          </span>
                        </div>

                        <p className="admin-model-description">
                          {meta.description || 'Modèle LLM disponible dans Synapse.'}
                        </p>

                        <div className="admin-model-identifiers">
                          <span>{model.alias}</span>
                          <span>{adminModel?.nomModeleProvider || 'Pas encore configuré'}</span>
                        </div>

                        {adminModel && modelTestResults[adminModel.id] && (
                          <div className="admin-model-test-result" role="status">
                            <span className={`admin-status-badge ${modelTestResults[adminModel.id].status === 'OK' ? 'active' : 'inactive'}`}>
                              Test : {modelTestResults[adminModel.id].status}
                            </span>
                            {modelTestResults[adminModel.id].latencyMs != null && <span>{modelTestResults[adminModel.id].latencyMs} ms</span>}
                            <span>{new Date(modelTestResults[adminModel.id].testedAt).toLocaleString('fr-FR')}</span>
                          </div>
                        )}

                        <div className="admin-model-actions">
                          {adminModel ? (
                            <>
                              <button
                                type="button"
                                className="admin-secondary-btn"
                                onClick={() => handleTestAdminModel(adminModel)}
                              >
                                Tester
                              </button>
                              <button
                                type="button"
                                className="admin-submit-btn"
                                onClick={() => adminModel.statut === 'ACTIF' ? requestConfirmation({ title: 'Désactiver ce modèle ?', message: 'Le modèle ne sera plus disponible dans Synapse.', onConfirm: () => handleToggleAdminModel(adminModel) }) : handleToggleAdminModel(adminModel)}
                              >
                                {adminModel.statut === 'ACTIF' ? 'Désactiver' : 'Activer'}
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="admin-submit-btn"
                              onClick={() => configureExistingModel(model)}
                            >
                              Configurer
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            </div>

            {adminModels.some((adminModel) => !availableModels.some((model) => model.alias === adminModel.aliasInterne)) && (
              <div className="admin-card">
                <div className="admin-card-heading-row">
                  <div>
                    <span className="admin-card-kicker">ADMINISTRATION</span>
                    <h2 className="admin-section-title">Modèles administrés non exposés</h2>
                    <p className="admin-overview-description">
                      Ces entrées sont présentes dans la configuration d&apos;administration mais ne figurent pas dans le catalogue actuel de Synapse.
                    </p>
                  </div>
                </div>

                <div className="admin-model-grid">
                  {adminModels
                    .filter((adminModel) => !availableModels.some((model) => model.alias === adminModel.aliasInterne))
                    .map((model) => {
                      const meta = modelCardMeta(model.aliasInterne)
                      return (
                        <article key={`admin-only-${model.id}`} className="admin-model-card">
                          <div className={`admin-model-card-visual ${meta.tone || ''}`}>
                            <ModelLogo
                              alias={model.aliasInterne}
                              className="admin-model-card-logo"
                              fallback={meta.initials}
                            />
                          </div>
                          <div className="admin-model-card-body">
                            <div className="admin-model-card-heading">
                              <div className="admin-model-card-title-wrap">
                                <h3>{model.nomAffichage || model.aliasInterne}</h3>
                                <span className="admin-meta-line">{model.nomModeleProvider || model.aliasInterne}</span>
                              </div>
                              <span className={`admin-status-badge ${model.statut === 'ACTIF' ? 'active' : 'inactive'}`}>
                                {model.statut === 'ACTIF' ? 'Actif' : 'Inactif'}
                              </span>
                            </div>
                            <div className="admin-model-identifiers">
                              <span>{model.aliasInterne}</span>
                              <span>Non exposé actuellement</span>
                            </div>
                            {modelTestResults[model.id] && (
                              <div className="admin-model-test-result" role="status">
                                <span className={`admin-status-badge ${modelTestResults[model.id].status === 'OK' ? 'active' : 'inactive'}`}>
                                  Test : {modelTestResults[model.id].status}
                                </span>
                                {modelTestResults[model.id].latencyMs != null && <span>{modelTestResults[model.id].latencyMs} ms</span>}
                                <span>{new Date(modelTestResults[model.id].testedAt).toLocaleString('fr-FR')}</span>
                              </div>
                            )}
                            <div className="admin-model-actions">
                              <button type="button" className="admin-secondary-btn" onClick={() => handleTestAdminModel(model)}>Tester</button>
                              <button type="button" className="admin-submit-btn" onClick={() => model.statut === 'ACTIF' ? requestConfirmation({ title: 'Désactiver ce modèle ?', message: 'Le modèle ne sera plus disponible dans Synapse.', onConfirm: () => handleToggleAdminModel(model) }) : handleToggleAdminModel(model)}>
                                {model.statut === 'ACTIF' ? 'Désactiver' : 'Activer'}
                              </button>
                            </div>
                          </div>
                        </article>
                      )
                    })}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'users' && (
          <div className="admin-users-layout">
            <section className="admin-card admin-users-list-card">
              <div className="admin-card-heading-row">
                <div>
                  <span className="admin-card-kicker">GESTION DES COMPTES</span>
                  <h2 className="admin-section-title">Utilisateurs</h2>
                  <p className="admin-overview-description">Recherchez un compte puis sélectionnez-le pour gérer son accès à Synapse.</p>
                </div>
                <span className="admin-count-badge">{filteredUsers.length} résultat{filteredUsers.length !== 1 ? 's' : ''}</span>
              </div>

              <div className="admin-user-search">
                <span className="admin-search-icon" aria-hidden="true" />
                <input
                  type="text"
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  placeholder="Rechercher par nom, identifiant ou UUID..."
                  className="admin-input"
                />
                {userSearchQuery && (
                  <button
                    type="button"
                    className="admin-search-clear"
                    onClick={() => setUserSearchQuery('')}
                    aria-label="Effacer la recherche"
                  >
                    ×
                  </button>
                )}
              </div>

              <div className="admin-user-list" role="listbox" aria-label="Utilisateurs">
                {isLoading('users') ? (
                  <div className="admin-loading-state">Chargement des utilisateurs…</div>
                ) : requestError('users') ? (
                  <div className="admin-error-state">{requestError('users')}</div>
                ) : filteredUsers.length === 0 ? (
                  <div className="admin-empty-state admin-user-empty">
                    <strong>Aucun utilisateur trouvé</strong>
                    <span>Essayez un autre nom ou identifiant.</span>
                  </div>
                ) : (
                  filteredUsers.map((user) => {
                    const isSelected = selectedUser?.id === user.id
                    const displayName = user.nomAffichage || user.externalId || user.id
                    const initial = String(displayName || '?').trim().charAt(0).toUpperCase() || '?'

                    return (
                      <button
                        key={user.id}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        className={`admin-user-row ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleSelectUser(user)}
                      >
                        <span className="admin-user-avatar" aria-hidden="true">{initial}</span>

                        <span className="admin-user-row-main">
                          <strong>{displayName}</strong>
                          <small>{user.externalId || user.id}</small>
                        </span>

                        <span className={`admin-status-badge ${user.enabled !== false ? 'active' : 'inactive'}`}>
                          {user.enabled !== false ? 'Actif' : 'Désactivé'}
                        </span>
                      </button>
                    )
                  })
                )}
              </div>
            </section>

            <section className="admin-card admin-user-details-card">
              {!selectedUser ? (
                <div className="admin-user-details-empty">
                  <div className="admin-user-details-empty-icon">◉</div>
                  <h2 className="admin-section-title">Sélectionnez un utilisateur</h2>
                  <p>Choisissez un compte dans la liste pour afficher ses accès, ses restrictions et ses règles personnalisées.</p>
                </div>
              ) : (
                <>
                  <div className="admin-user-profile">
                    <div className="admin-user-profile-main">
                      <div className="admin-user-avatar admin-user-avatar-large" aria-hidden="true">
                        {(selectedUser.nomAffichage || selectedUser.externalId || selectedUser.id || '?').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <span className="admin-card-kicker">COMPTE</span>
                        <h2>{selectedUser.nomAffichage || selectedUser.externalId || selectedUser.id}</h2>
                        <p>{selectedUser.externalId || selectedUser.id}</p>
                      </div>
                    </div>

                    <div className="admin-user-profile-actions">
                      <span className={`admin-status-badge ${selectedUser.enabled !== false ? 'active' : 'inactive'}`}>
                        {selectedUser.enabled !== false ? 'Actif' : 'Désactivé'}
                      </span>
                      {selectedUser.keycloakManaged && (
                        <button
                          type="button"
                          className="admin-action-button secondary"
                          onClick={() => selectedUser.enabled ? requestConfirmation({ title: 'Désactiver cet utilisateur ?', message: 'Cet utilisateur ne pourra plus accéder à Synapse.', onConfirm: () => handleToggleKeycloakUser(selectedUser) }) : handleToggleKeycloakUser(selectedUser)}
                        >
                          {selectedUser.enabled ? 'Désactiver' : 'Activer'}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="admin-user-summary-grid">
                    <div>
                      <span>Rôles</span>
                      <strong>{selectedKeycloakRoles.length || 0}</strong>
                    </div>
                    <div>
                      <span>Restrictions</span>
                      <strong>{userRestrictions.length}</strong>
                    </div>
                    <div>
                      <span>Mots bannis</span>
                      <strong>{userBannedWords.length}</strong>
                    </div>
                  </div>

                  {selectedUser.keycloakManaged && keycloakRoles.length > 0 && (
                    <div className="admin-user-section">
                      <div className="admin-card-heading-row">
                        <div>
                          <span className="admin-card-kicker">ACCÈS</span>
                          <h3 className="admin-subsection-title">Rôles Keycloak</h3>
                        </div>
                      </div>

                      <div className="admin-role-grid">
                        {keycloakRoles.map((role) => {
                          const roleName = role.name
                          const checked = selectedKeycloakRoles.includes(roleName)
                          return (
                            <label key={role.id || roleName} className={`admin-role-option ${checked ? 'selected' : ''}`}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  setSelectedKeycloakRoles((current) => (
                                    checked
                                      ? current.filter((name) => name !== roleName)
                                      : [...current, roleName]
                                  ))
                                }}
                              />
                              <span>{roleName}</span>
                            </label>
                          )
                        })}
                      </div>

                      <button type="button" className="admin-submit-btn" onClick={handleAssignKeycloakRoles}>
                        Enregistrer les rôles
                      </button>
                    </div>
                  )}

                  <div className="admin-user-section">
                    <div className="admin-card-heading-row">
                      <div>
                        <span className="admin-card-kicker">AUTORISATIONS</span>
                        <h3 className="admin-subsection-title">Restrictions de modèles</h3>
                      </div>
                      <span className="admin-count-badge">{userRestrictions.length}</span>
                    </div>

                    <form onSubmit={handleAddRestriction} className="admin-user-inline-form">
                      <select
                        value={modelAlias}
                        onChange={(e) => setModelAlias(e.target.value)}
                        className="admin-input"
                      >
                        {availableModels.map((model) => (
                          <option key={model.alias} value={model.alias}>
                            {model.displayName}
                          </option>
                        ))}
                      </select>
                      <button type="submit" className="admin-submit-btn" disabled={!isUuid(selectedUser.externalId)} title={!isUuid(selectedUser.externalId) ? 'Un UUID Keycloak est requis pour gérer les restrictions.' : undefined}>
                        Restreindre
                      </button>
                    </form>

                    {!isUuid(selectedUser.externalId) && <p className="admin-muted-state">Les restrictions personnalisées nécessitent l’UUID Keycloak du compte.</p>}
                    <div className="admin-user-chip-list">
                      {userDetailLoading ? <span className="admin-muted-state">Chargement…</span> : userDetailError ? <span className="admin-error-state">{userDetailError}</span> : userRestrictions.length === 0 ? (
                        <span className="admin-muted-state">Aucune restriction personnalisée.</span>
                      ) : userRestrictions.map((restriction) => (
                        <span key={restriction.id} className="admin-user-chip">
                          {restriction.llmModelAlias}
                          <button type="button" onClick={() => requestConfirmation({ title: 'Supprimer cette restriction ?', message: `Supprimer la restriction « ${restriction.llmModelAlias} » ?`, onConfirm: () => handleDeleteRestriction(restriction.id) })} aria-label={`Supprimer ${restriction.llmModelAlias}`}>
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="admin-user-section">
                    <div className="admin-card-heading-row">
                      <div>
                        <span className="admin-card-kicker">DLP</span>
                        <h3 className="admin-subsection-title">Mots bannis spécifiques</h3>
                      </div>
                      <span className="admin-count-badge">{userBannedWords.length}</span>
                    </div>

                    <form onSubmit={handleAddUserWord} className="admin-user-inline-form">
                      <input
                        type="text"
                        value={newUserWord}
                        onChange={(e) => setNewUserWord(e.target.value)}
                        placeholder="Ajouter un mot ou une expression..."
                        className="admin-input"
                      />
                      <button type="submit" className="admin-submit-btn" disabled={!isUuid(selectedUser.externalId)} title={!isUuid(selectedUser.externalId) ? 'Un UUID Keycloak est requis pour gérer les mots bannis.' : undefined}>
                        Ajouter
                      </button>
                    </form>

                    {!isUuid(selectedUser.externalId) && <p className="admin-muted-state">Les mots bannis personnalisés nécessitent l’UUID Keycloak du compte.</p>}
                    <div className="admin-user-chip-list">
                      {userDetailLoading ? <span className="admin-muted-state">Chargement…</span> : userDetailError ? <span className="admin-error-state">{userDetailError}</span> : userBannedWords.length === 0 ? (
                        <span className="admin-muted-state">Aucun mot banni spécifique.</span>
                      ) : userBannedWords.map((word) => (
                        <span key={word.id} className="admin-user-chip">
                          {word.word}
                            <button type="button" onClick={() => requestConfirmation({ title: 'Supprimer ce mot ?', message: `Supprimer « ${word.word} » ?`, onConfirm: () => handleDeleteUserWord(word.id) })} aria-label={`Supprimer ${word.word}`}>
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </section>
          </div>
        )}

        {activeTab === 'roles' && (
          <div className="admin-card">
            <h2 className="admin-section-title">Administration par Rôle</h2>
            
            <div className="admin-group admin-role-selector-group">
              <div className="admin-role-selector" role="tablist" aria-label="Sélection du rôle">
                {['INTERN', 'EXTERN'].map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setSelectedRole(role)}
                    className={`admin-role-selector-button ${selectedRole === role ? 'active' : ''}`}
                    role="tab"
                    aria-selected={selectedRole === role}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>

            <div className="admin-role-context">
              <strong>Rôle actif :</strong> {selectedRole}
            </div>

            <div className="admin-group admin-role-section">
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
              
              {roleLoading ? <div className="admin-loading-state">Chargement des restrictions…</div> : requestError('roles') ? <div className="admin-error-state">{requestError('roles')}</div> : <ul className="admin-list">
                {roleRestrictions.length === 0 ? <li className="admin-empty-state">Aucune restriction pour ce rôle.</li> : roleRestrictions.map((req) => (
                  <li key={req.id} className="admin-list-item">
                    <span>{req.llmModelAlias}</span>
                    <button 
                      type="button" 
                      onClick={() => requestConfirmation({ title: 'Supprimer la restriction ?', message: 'Cette restriction de modèle sera supprimée.', onConfirm: () => handleDeleteRoleRestriction(req.id) })}
                      className="admin-delete-btn"
                    >
                      Supprimer
                    </button>
                  </li>
                ))}
              </ul>}
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
              
              {roleLoading ? <div className="admin-loading-state">Chargement des mots bannis…</div> : requestError('roles') ? <div className="admin-error-state">{requestError('roles')}</div> : <ul className="admin-list">
                {roleBannedWords.length === 0 ? <li className="admin-empty-state">Aucun mot banni pour ce rôle.</li> : roleBannedWords.map((wordObj) => (
                  <li key={wordObj.id} className="admin-list-item">
                    <span>{wordObj.word}</span>
                    <button 
                      type="button" 
                      onClick={() => requestConfirmation({ title: 'Supprimer ce mot banni ?', message: 'Ce mot sera supprimé pour le rôle sélectionné.', onConfirm: () => handleDeleteRoleWord(wordObj.id) })}
                      className="admin-delete-btn"
                    >
                      Supprimer
                    </button>
                  </li>
                ))}
              </ul>}
            </div>
          </div>
        )}

        {/* <-- Added Audit Log UI --> */}
        {activeTab === 'audit' && (
          <>
            <div className="audit-subtabs">
              <button className={auditView === 'permissions' ? 'active' : ''} onClick={() => setAuditView('permissions')}>
                Changements d'autorisations
              </button>
              <button className={auditView === 'filtered' ? 'active' : ''} onClick={() => setAuditView('filtered')}>
                Messages bloqués / masqués
              </button>
            </div>

            {auditView === 'permissions' ? (
              <>
                <div className="audit-filters">
                  <input className="admin-input" value={auditSearch} placeholder="Rechercher dans le journal" onChange={e => { setAuditSearch(e.target.value); setAuditPage(0) }} />
                  <input className="admin-input" value={auditAction} placeholder="Action (CREATE, DELETE...)" onChange={e => { setAuditAction(e.target.value); setAuditPage(0) }} />
                  <input className="admin-input" value={auditEntity} placeholder="Entité (rôle, pattern...)" onChange={e => { setAuditEntity(e.target.value); setAuditPage(0) }} />
                </div>
                <ul className="audit-list">
                {auditLoading && <li className="admin-loading-state">Chargement du journal…</li>}
                {!auditLoading && auditError && <li className="admin-error-state">{auditError}</li>}
                {!auditLoading && !auditError && auditLogs.length === 0 && <li className="admin-empty-state">Aucun changement d'autorisation trouvé.</li>}
                {!auditLoading && !auditError && auditLogs.map(log => (
                  <li key={log.id} className="audit-row">
                    <button type="button" className="audit-row-toggle" onClick={() => setExpandedAuditIds((current) => { const next = new Set(current); next.has(log.id) ? next.delete(log.id) : next.add(log.id); return next })} aria-expanded={expandedAuditIds.has(log.id)}>
                      <span><AuditBadge value={log.action} /> {log.entityName}</span>
                      <span className="audit-meta">{new Date(log.timestamp).toLocaleString('fr-FR')}</span>
                    </button>
                    {expandedAuditIds.has(log.id) && <div className="audit-row-details"><span>Identifiant : {log.entityId || '—'}</span><span>Effectué par : {log.performedBy || '—'}</span></div>}
                  </li>
                ))}
                </ul>
                <Pagination page={auditPage} totalPages={auditTotalPages} onChange={setAuditPage} />
              </>
            ) : (
              <>
                <div className="audit-filters">
                  <input className="admin-input" value={filteredSearch} placeholder="Rechercher une raison ou un message" onChange={e => { setFilteredSearch(e.target.value); setFilteredPage(0) }} />
                  <input className="admin-input" value={filteredAction} placeholder="Action (BLOCKED, REDACTED...)" onChange={e => { setFilteredAction(e.target.value); setFilteredPage(0) }} />
                  <input className="admin-input" value={filteredUserId} placeholder="UUID utilisateur" onChange={e => { setFilteredUserId(e.target.value); setFilteredPage(0) }} />
                </div>
                <ul className="audit-list">
                {auditLoading && <li className="admin-loading-state">Chargement des messages filtrés…</li>}
                {!auditLoading && auditError && <li className="admin-error-state">{auditError}</li>}
                {!auditLoading && !auditError && filteredMessages.length === 0 && <li className="admin-empty-state">Aucun message bloqué ou masqué trouvé.</li>}
                {!auditLoading && !auditError && filteredMessages.map(msg => {
                  const isRevealed = revealedIds.has(msg.id)
                  return (
                    <li key={msg.id} className="audit-row">
                      <button type="button" className="audit-row-toggle" onClick={() => setExpandedAuditIds((current) => { const next = new Set(current); next.has(msg.id) ? next.delete(msg.id) : next.add(msg.id); return next })} aria-expanded={expandedAuditIds.has(msg.id)}>
                        <span><AuditBadge value={msg.action} /> {msg.reason}</span>
                        <span className="audit-meta">{new Date(msg.timestamp).toLocaleString('fr-FR')}</span>
                      </button>
                      {expandedAuditIds.has(msg.id) && <div className="audit-content">
                        <span className="audit-meta">Utilisateur : {msg.userKeycloakId} · Gravité : {msg.highestSeverity || 'inconnue'} · Détections : {msg.detectionCount ?? 0} · Statut : {msg.requestStatus || msg.action}</span>
                        {msg.detectedTypes && <span className="audit-meta">Catégories : {msg.detectedTypes}</span>}
                        {isRevealed ? (
                          <>
                            <p className="audit-original"><em>Original :</em> {msg.originalContent}</p>
                            {msg.redactedContent && (
                              <p className="audit-redacted"><em>Masqué :</em> {msg.redactedContent}</p>
                            )}
                            <button type="button" onClick={() => toggleReveal(msg.id)}>Masquer le contenu</button>
                          </>
                        ) : (
                          <button type="button" onClick={() => toggleReveal(msg.id)}>Afficher le contenu</button>
                        )}
                      </div>}
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
      {confirmation && (
        <ConfirmDialog
          title={confirmation.title}
          message={confirmation.message}
          cancelLabel="Annuler"
          confirmLabel="Supprimer"
          onCancel={() => setConfirmation(null)}
          onConfirm={async () => {
            setConfirmation(null)
            await confirmation.onConfirm()
          }}
        />
      )}
    </div>
  )
}

function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null
  return (
    <div className="audit-pagination">
      <button type="button" disabled={page === 0} onClick={() => onChange(page - 1)}>Précédente</button>
      <span>Page {page + 1} sur {totalPages}</span>
      <button type="button" disabled={page + 1 >= totalPages} onClick={() => onChange(page + 1)}>Suivante</button>
    </div>
  )
}

function MetricValue({ loading, error, value }) {
  if (loading) return <span className="admin-metric-placeholder" aria-label="Chargement">—</span>
  if (error) return <span className="admin-metric-placeholder" aria-label="Erreur">!</span>
  return value
}

function AuditBadge({ value }) {
  const normalized = String(value || '').toUpperCase()
  const tone = normalized.includes('BLOCK') || normalized.includes('DELETE') ? 'danger' : normalized.includes('REDACT') || normalized.includes('UPDATE') ? 'warning' : 'neutral'
  return <span className={`audit-badge ${tone}`}>{value || 'ÉVÉNEMENT'}</span>
}
