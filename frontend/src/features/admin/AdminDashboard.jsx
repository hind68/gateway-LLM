import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { AuthContext } from '../../AuthProvider'
import {
  addGlobalBannedWord,
  addLlmRestriction,
  addPattern,
  addRoleBannedWord,
  addRoleLlmRestriction,
  addUserBannedWord,
  createAdminModel,
  createAdminProvider,
  deleteAdminModel,
  deleteAdminProvider,
  fetchAdminModels,
  fetchAdminProviders,
  fetchAuditLogs,
  fetchFilteredMessages,
  fetchGlobalBannedWords,
  fetchKeycloakRoles,
  fetchKeycloakUserRoles,
  fetchKeycloakUsers,
  fetchPatterns,
  fetchRoleBannedWords,
  fetchRoleRestrictions,
  fetchSecurityMetrics,
  fetchUserBannedWords,
  fetchUserRestrictions,
  fetchUsers,
  removeGlobalBannedWord,
  removeLlmRestriction,
  removePattern,
  removeRoleBannedWord,
  removeRoleLlmRestriction,
  removeUserBannedWord,
  setAdminModelStatus,
  setKeycloakUserEnabled,
  setKeycloakUserRoles,
  testAdminModel,
  updateAdminModel,
  updateAdminProvider,
  updatePattern,
} from '../../api/adminApi'
import { fetchModelDetails } from '../../api/modelsApi'
import ModelLogo from '../models/components/ModelLogo'
import { modelCardMeta, modelProviderName } from '../../utils/modelMetadata'
import {
  AdminPageHeader,
  AdminShell,
  AdminToolbar,
  ConfirmDialog,
  CopyButton,
  EmptyState,
  ErrorState,
  Icon,
  Modal,
  Pagination,
  Skeleton,
  StatCard,
  StatusBadge,
} from './AdminComponents'
import { formatAction, formatEntity } from './AdminUtils'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const isUuid = (value) => UUID_PATTERN.test(String(value || ''))
const blankPattern = { name: '', type: 'custom', pattern: '', severity: 'medium', action: 'MASK', enabled: true, validator: '', capture_group: '' }
const blankProvider = { code: '', name: '', status: 'ACTIF', apiKeyEnvVar: '' }
const blankModel = { providerId: '', alias: '', providerModel: '', displayName: '', description: '', logoUrl: '', status: 'ACTIF' }
const MODEL_LOGO_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
const MAX_MODEL_LOGO_BYTES = 512 * 1024
const MANAGED_KEYCLOAK_ROLES = ['ADMIN', 'INTERN', 'EXTERN']

function managedKeycloakRoles(roles) {
  const rolesByName = new Map((roles || []).map((role) => [String(role?.name || '').toUpperCase(), role]))
  return MANAGED_KEYCLOAK_ROLES.map((name) => rolesByName.get(name)).filter(Boolean)
}

function managedKeycloakRoleNames(roles) {
  const allowed = new Set(MANAGED_KEYCLOAK_ROLES)
  return (roles || []).map((role) => String(role?.name || '').toUpperCase()).filter((name) => allowed.has(name))
}

export default function AdminDashboard({ onError, onNotice, onModelsChanged, onBackToChat }) {
  const keycloak = useContext(AuthContext)
  const token = keycloak?.token
  const [activeSection, setActiveSection] = useState(() => window.localStorage.getItem('synapse-admin-section') || 'overview')
  const [requestState, setRequestState] = useState({})
  const [confirmation, setConfirmation] = useState(null)
  const [busyAction, setBusyAction] = useState('')

  const [users, setUsers] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [userSearch, setUserSearch] = useState('')
  const [selectedKeycloakRoles, setSelectedKeycloakRoles] = useState([])
  const [keycloakRoles, setKeycloakRoles] = useState([])
  const [userRestrictions, setUserRestrictions] = useState([])
  const [userBannedWords, setUserBannedWords] = useState([])
  const [availableModels, setAvailableModels] = useState([])
  const [userModel, setUserModel] = useState('')
  const [userWord, setUserWord] = useState('')

  const [globalWords, setGlobalWords] = useState([])
  const [patterns, setPatterns] = useState([])
  const [patternSearch, setPatternSearch] = useState('')
  const [wordSearch, setWordSearch] = useState('')
  const [patternModal, setPatternModal] = useState(null)

  const [adminProviders, setAdminProviders] = useState([])
  const [adminModels, setAdminModels] = useState([])
  const [providerSearch, setProviderSearch] = useState('')
  const [modelSearch, setModelSearch] = useState('')
  const [providerModal, setProviderModal] = useState(null)
  const [modelModal, setModelModal] = useState(null)
  const [modelTestResults, setModelTestResults] = useState({})

  const [selectedRole, setSelectedRole] = useState('')
  const [roleRestrictions, setRoleRestrictions] = useState([])
  const [roleBannedWords, setRoleBannedWords] = useState([])
  const [roleModel, setRoleModel] = useState('')
  const [roleWord, setRoleWord] = useState('')

  const [securityMetrics, setSecurityMetrics] = useState(null)
  const [overviewMessages, setOverviewMessages] = useState([])
  const [auditView, setAuditView] = useState('permissions')
  const [auditLogs, setAuditLogs] = useState([])
  const [filteredMessages, setFilteredMessages] = useState([])
  const [auditSearch, setAuditSearch] = useState('')
  const [auditAction, setAuditAction] = useState('')
  const [auditEntity, setAuditEntity] = useState('')
  const [auditDate, setAuditDate] = useState('')
  const [auditPage, setAuditPage] = useState(0)
  const [auditTotalPages, setAuditTotalPages] = useState(0)
  const [filteredSearch, setFilteredSearch] = useState('')
  const [filteredAction, setFilteredAction] = useState('')
  const [filteredUserId, setFilteredUserId] = useState('')
  const [filteredDate, setFilteredDate] = useState('')
  const [filteredPage, setFilteredPage] = useState(0)
  const [filteredTotalPages, setFilteredTotalPages] = useState(0)
  const [expandedAuditId, setExpandedAuditId] = useState(null)

  const setStatus = useCallback((key, status, error = '') => setRequestState((current) => ({ ...current, [key]: { status, error } })), [])
  const loading = (key) => requestState[key]?.status === 'loading'
  const errorFor = (key) => requestState[key]?.error || ''
  const notify = useCallback((message) => { onNotice?.(message) }, [onNotice])
  const fail = useCallback((error) => { const message = error?.message || String(error || 'Une erreur est survenue.'); onError?.(message) }, [onError])

  useEffect(() => {
    window.localStorage.setItem('synapse-admin-section', activeSection)
  }, [activeSection])
  useEffect(() => {
    if (!token) return
    void loadInitialData()
    // Initial admin reads intentionally share one lifecycle per token.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])
  useEffect(() => {
    if (token && activeSection === 'roles' && selectedRole) void loadRoleData(selectedRole)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, activeSection, selectedRole])
  useEffect(() => {
    if (!token || activeSection !== 'audit') return
    if (auditView === 'permissions') void loadAuditLogs()
    else void loadFilteredMessages()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, activeSection, auditView, auditPage, auditSearch, auditAction, auditEntity, auditDate, filteredPage, filteredSearch, filteredAction, filteredUserId, filteredDate])

  async function loadInitialData() {
    await Promise.allSettled([loadUsers(), loadSecurityData(), loadGlobalWords(), loadPatterns(), loadModels(), loadAdminProviders(), loadAdminModels(), loadKeycloakRoles(), loadOverviewMessages()])
  }
  async function loadUsers() {
    setStatus('users', 'loading')
    try {
      let data
      try {
        const keycloakUsers = await fetchKeycloakUsers(token)
        data = (keycloakUsers || []).map((user) => ({ id: user.id, externalId: user.id, nomAffichage: user.username || user.email || 'Utilisateur', email: user.email, enabled: user.enabled !== false, keycloakManaged: true }))
      } catch {
        data = await fetchUsers(token)
      }
      setUsers(data || [])
      setStatus('users', 'success')
      if (data?.length) await selectUser(data[0])
    } catch (error) { setStatus('users', 'error', error.message); fail(error) }
  }
  async function selectUser(user) {
    setSelectedUser(user)
    if (user?.keycloakManaged) {
      try { setSelectedKeycloakRoles(managedKeycloakRoleNames(await fetchKeycloakUserRoles(user.externalId, token))) } catch { setSelectedKeycloakRoles([]) }
    } else setSelectedKeycloakRoles([])
    if (!isUuid(user?.externalId)) { setUserRestrictions([]); setUserBannedWords([]); return }
    setStatus('userDetails', 'loading')
    try {
      const [restrictions, words] = await Promise.all([fetchUserRestrictions(user.externalId, token), fetchUserBannedWords(user.externalId, token)])
      setUserRestrictions(restrictions || [])
      setUserBannedWords(words || [])
      setStatus('userDetails', 'success')
    } catch (error) { setStatus('userDetails', 'error', error.message); fail(error) }
  }
  async function loadSecurityData() {
    setStatus('security', 'loading')
    try { setSecurityMetrics(await fetchSecurityMetrics(token)); setStatus('security', 'success') } catch (error) { setStatus('security', 'error', error.message); fail(error) }
  }
  async function loadOverviewMessages() {
    setStatus('overview', 'loading')
    try { const data = await fetchFilteredMessages(token, { page: 0, size: 100, search: '', action: '', userId: '' }); setOverviewMessages(data?.content || []); setStatus('overview', 'success') } catch (error) { setOverviewMessages([]); setStatus('overview', 'error', error.message) }
  }
  async function loadPatterns() {
    setStatus('patterns', 'loading')
    try { setPatterns(await fetchPatterns(token) || []); setStatus('patterns', 'success') } catch (error) { setStatus('patterns', 'error', error.message); fail(error) }
  }
  async function loadGlobalWords() {
    setStatus('globalWords', 'loading')
    try { setGlobalWords(await fetchGlobalBannedWords(token) || []); setStatus('globalWords', 'success') } catch (error) { setStatus('globalWords', 'error', error.message); fail(error) }
  }
  async function loadModels() {
    setStatus('catalog', 'loading')
    try { setAvailableModels(await fetchModelDetails(token) || []); setStatus('catalog', 'success') } catch (error) { setStatus('catalog', 'error', error.message); fail(error) }
  }
  async function loadAdminProviders() {
    setStatus('providers', 'loading')
    try { setAdminProviders(await fetchAdminProviders(token) || []); setStatus('providers', 'success') } catch (error) { setStatus('providers', 'error', error.message); fail(error) }
  }
  async function loadAdminModels() {
    setStatus('models', 'loading')
    try { setAdminModels(await fetchAdminModels(token) || []); setStatus('models', 'success') } catch (error) { setStatus('models', 'error', error.message); fail(error) }
  }
  async function loadKeycloakRoles() {
    setStatus('keycloakRoles', 'loading')
    try {
      const roles = managedKeycloakRoles(await fetchKeycloakRoles(token))
      setKeycloakRoles(roles)
      setSelectedRole((current) => current && roles.some((role) => role.name === current) ? current : roles[0]?.name || '')
      setStatus('keycloakRoles', 'success')
    } catch (error) {
      setKeycloakRoles([])
      setSelectedRole('')
      setStatus('keycloakRoles', 'error', error.message)
    }
  }
  async function loadRoleData(role) {
    setStatus('roles', 'loading')
    try { const [restrictions, words] = await Promise.all([fetchRoleRestrictions(role, token), fetchRoleBannedWords(role, token)]); setRoleRestrictions(restrictions || []); setRoleBannedWords(words || []); setStatus('roles', 'success') } catch (error) { setStatus('roles', 'error', error.message); fail(error) }
  }
  async function loadAuditLogs() {
    setStatus('audit', 'loading')
    try { const data = await fetchAuditLogs(token, { page: auditPage, size: 10, search: auditSearch, action: auditAction, entityName: auditEntity, ...dateRange(auditDate) }); setAuditLogs(data?.content || []); setAuditTotalPages(data?.totalPages || 0); setStatus('audit', 'success') } catch (error) { setStatus('audit', 'error', error.message); fail(error) }
  }
  async function refreshModelViews() {
    await Promise.allSettled([
      loadAdminModels(),
      loadModels(),
      onModelsChanged?.(),
    ])
  }
  async function loadFilteredMessages() {
    setStatus('audit', 'loading')
    try { const data = await fetchFilteredMessages(token, { page: filteredPage, size: 10, search: filteredSearch, action: filteredAction, userId: filteredUserId, ...dateRange(filteredDate) }); setFilteredMessages(data?.content || []); setFilteredTotalPages(data?.totalPages || 0); setStatus('audit', 'success') } catch (error) { setStatus('audit', 'error', error.message); fail(error) }
  }
  async function mutate(key, operation, successMessage, reload) {
    if (busyAction) return
    setBusyAction(key)
    try { await operation(); notify(successMessage); if (reload) await reload() } catch (error) { fail(error) } finally { setBusyAction('') }
  }
  async function saveProviderFromModal(data) {
    if (busyAction) return
    setBusyAction('provider')
    try { await (data.id ? updateAdminProvider(data.id, data, token) : createAdminProvider(data, token)); notify(data.id ? 'Fournisseur mis à jour' : 'Fournisseur ajouté'); setProviderModal(null); await loadAdminProviders() } catch (error) { fail(error) } finally { setBusyAction('') }
  }
  async function saveModelFromModal(data) {
    if (busyAction) return
    setBusyAction('model')
    try { await (data.id ? updateAdminModel(data.id, data, token) : createAdminModel(data, token)); notify(data.id ? 'Modèle mis à jour' : 'Modèle ajouté'); setModelModal(null); await refreshModelViews() } catch (error) { fail(error) } finally { setBusyAction('') }
  }
  function askConfirmation(config) { setConfirmation(config) }

  const filteredUsers = useMemo(() => {
    const query = userSearch.trim().toLowerCase()
    if (!query) return users
    return users.filter((user) => [user.nomAffichage, user.email, user.externalId, user.id].some((value) => String(value || '').toLowerCase().includes(query)))
  }, [users, userSearch])
  const filteredPatterns = useMemo(() => patterns.filter((item) => `${item.name} ${item.type} ${item.pattern}`.toLowerCase().includes(patternSearch.toLowerCase())), [patterns, patternSearch])
  const filteredWords = useMemo(() => globalWords.filter((item) => String(item.word || item).toLowerCase().includes(wordSearch.toLowerCase())), [globalWords, wordSearch])
  const filteredProviders = useMemo(() => adminProviders.filter((provider) => `${provider.nom || provider.name || ''} ${provider.code || ''}`.toLowerCase().includes(providerSearch.toLowerCase())), [adminProviders, providerSearch])
  const filteredAdminModels = useMemo(() => adminModels.filter((model) => `${model.nomAffichage || ''} ${model.aliasInterne || model.alias || ''} ${model.nomModeleProvider || ''}`.toLowerCase().includes(modelSearch.toLowerCase())), [adminModels, modelSearch])
  const chartData = useMemo(() => buildOverviewData(overviewMessages), [overviewMessages])
  const activeModels = adminModels.filter((model) => model.statut === 'ACTIF').length
  const activePatterns = patterns.filter((pattern) => pattern.enabled !== false).length

  return (
    <AdminShell activeSection={activeSection} onSectionChange={setActiveSection} onBackToChat={onBackToChat} keycloak={keycloak}>
      <div className="admin-content">
        <AdminPageHeader eyebrow="CENTRE DE CONTRÔLE" title={sectionTitle(activeSection)} description={sectionDescription(activeSection)} actions={<span className="admin-live-status"><span />Connecté</span>} />
        {activeSection === 'overview' && <OverviewSection loading={loading} errors={errorFor} users={users} activeModels={activeModels} adminModels={adminModels} patterns={patterns} activePatterns={activePatterns} globalWords={globalWords} securityMetrics={securityMetrics} chartData={chartData} overviewMessages={overviewMessages} onSectionChange={setActiveSection} />}
        {activeSection === 'security' && <SecuritySection loading={loading} errorFor={errorFor} globalWords={filteredWords} wordSearch={wordSearch} setWordSearch={setWordSearch} onAddWord={(value) => mutate('global-word', () => addGlobalBannedWord(value, token), 'Mot banni ajouté', loadGlobalWords)} onDeleteWord={(id, word) => askConfirmation({ title: 'Supprimer ce mot banni ?', message: `« ${word} » sera supprimé des règles globales.`, onConfirm: () => mutate('delete-word', () => removeGlobalBannedWord(id, token), 'Mot banni supprimé', loadGlobalWords) })} patterns={filteredPatterns} patternSearch={patternSearch} setPatternSearch={setPatternSearch} onCreatePattern={() => setPatternModal({ ...blankPattern, mode: 'create' })} onEditPattern={(pattern) => setPatternModal({ ...blankPattern, ...pattern, mode: 'edit' })} onTogglePattern={(pattern) => mutate(`pattern-${pattern.name}`, () => updatePattern(pattern.name, { ...pattern, enabled: pattern.enabled === false }, token), pattern.enabled === false ? 'Pattern activé' : 'Pattern désactivé', loadPatterns)} onDeletePattern={(name) => askConfirmation({ title: 'Supprimer ce pattern ?', message: 'Cette règle DLP sera supprimée définitivement.', onConfirm: () => mutate('delete-pattern', () => removePattern(name, token), 'Pattern supprimé', loadPatterns) })} onCopyExpression={() => notify('Expression copiée')} onCopyError={fail} />}
        {activeSection === 'models' && <ModelsSection loading={loading} errorFor={errorFor} providers={filteredProviders} allProviders={adminProviders} models={filteredAdminModels} availableModels={availableModels} providerSearch={providerSearch} setProviderSearch={setProviderSearch} modelSearch={modelSearch} setModelSearch={setModelSearch} onCreateProvider={() => setProviderModal({ ...blankProvider, mode: 'create' })} onEditProvider={(provider) => setProviderModal({ code: provider.code || '', name: provider.nom || provider.name || '', status: provider.statut || 'ACTIF', apiKeyEnvVar: provider.apiKeyEnvVar || '', id: provider.id, mode: 'edit' })} onToggleProvider={(provider) => mutate(`provider-status-${provider.id}`, () => updateAdminProvider(provider.id, { status: provider.statut === 'ACTIF' ? 'INACTIF' : 'ACTIF' }, token), provider.statut === 'ACTIF' ? 'Fournisseur désactivé' : 'Fournisseur activé', async () => { await loadAdminProviders(); await refreshModelViews() })} onDeleteProvider={(provider) => askConfirmation({ title: 'Supprimer ce fournisseur ?', message: 'La suppression est refusée si des modèles y sont encore associés.', onConfirm: () => mutate('delete-provider', () => deleteAdminProvider(provider.id, token), 'Fournisseur supprimé', loadAdminProviders) })} onCreateModel={() => setModelModal({ ...blankModel, mode: 'create' })} onEditModel={(model) => setModelModal({ providerId: String(model.providerId || ''), alias: model.aliasInterne || model.alias || '', providerModel: model.nomModeleProvider || '', displayName: model.nomAffichage || '', description: model.description || '', logoUrl: model.logoUrl || '', status: model.statut || 'ACTIF', id: model.id, mode: 'edit' })} onToggleModel={(model) => mutate(`model-status-${model.id}`, () => setAdminModelStatus(model.id, model.statut === 'ACTIF' ? 'INACTIF' : 'ACTIF', token), model.statut === 'ACTIF' ? 'Modèle désactivé' : 'Modèle activé', async () => { await refreshModelViews(); await loadSecurityData() })} onDeleteModel={(model) => askConfirmation({ title: 'Supprimer ce modèle ?', message: 'La suppression est refusée si des conversations ou restrictions le référencent.', onConfirm: () => mutate('delete-model', () => deleteAdminModel(model.id, token), 'Modèle supprimé', refreshModelViews) })} onTestModel={(model) => mutate(`test-model-${model.id}`, async () => { const result = await testAdminModel(model.id, token); setModelTestResults((current) => ({ ...current, [model.id]: { ...result, testedAt: new Date().toISOString() } })) }, 'Test du modèle terminé')} modelTestResults={modelTestResults} />}
        {activeSection === 'users' && <UsersSection loading={loading} errorFor={errorFor} users={filteredUsers} allUsers={users} search={userSearch} setSearch={setUserSearch} selectedUser={selectedUser} onSelectUser={selectUser} keycloakRoles={keycloakRoles} keycloakRolesError={errorFor('keycloakRoles')} onRetryKeycloakRoles={loadKeycloakRoles} selectedRoles={selectedKeycloakRoles} setSelectedRoles={setSelectedKeycloakRoles} onSaveRoles={() => mutate('user-roles', () => setKeycloakUserRoles(selectedUser.externalId, selectedKeycloakRoles, token), 'Rôles mis à jour')} restrictions={userRestrictions} bannedWords={userBannedWords} models={availableModels} selectedModel={userModel} setSelectedModel={setUserModel} userWord={userWord} setUserWord={setUserWord} onAddRestriction={() => mutate('user-restriction', () => addLlmRestriction(selectedUser.externalId, userModel, token), 'Restriction ajoutée', () => selectUser(selectedUser))} onRemoveRestriction={(item) => askConfirmation({ title: 'Supprimer cette restriction ?', message: `La restriction « ${item.llmModelAlias} » sera supprimée.`, onConfirm: () => mutate('delete-user-restriction', () => removeLlmRestriction(item.id, token), 'Restriction supprimée', () => selectUser(selectedUser)) })} onAddWord={() => mutate('user-word', () => addUserBannedWord(selectedUser.externalId, userWord, token), 'Mot banni ajouté', () => { setUserWord(''); return selectUser(selectedUser) })} onRemoveWord={(item) => askConfirmation({ title: 'Supprimer ce mot ?', message: `« ${item.word} » sera supprimé pour cet utilisateur.`, onConfirm: () => mutate('delete-user-word', () => removeUserBannedWord(item.id, token), 'Mot banni supprimé', () => selectUser(selectedUser)) })} onToggleUser={(user) => mutate('user-status', () => setKeycloakUserEnabled(user.externalId, !user.enabled, token), user.enabled ? 'Utilisateur désactivé' : 'Utilisateur activé', loadUsers)} />}
        {activeSection === 'roles' && <RolesSection loading={loading('roles')} errorFor={errorFor} roles={keycloakRoles.map((item) => item.name).filter(Boolean)} rolesLoading={loading('keycloakRoles')} rolesError={errorFor('keycloakRoles')} onRetryRoles={() => selectedRole ? loadRoleData(selectedRole) : loadKeycloakRoles()} role={selectedRole} setRole={setSelectedRole} restrictions={roleRestrictions} bannedWords={roleBannedWords} models={availableModels} selectedModel={roleModel} setSelectedModel={setRoleModel} word={roleWord} setWord={setRoleWord} onAddRestriction={() => mutate('role-restriction', () => addRoleLlmRestriction(selectedRole, roleModel, token), 'Restriction ajoutée', () => loadRoleData(selectedRole))} onRemoveRestriction={(item) => askConfirmation({ title: 'Supprimer la restriction ?', message: 'La restriction sera supprimée pour ce rôle.', onConfirm: () => mutate('delete-role-restriction', () => removeRoleLlmRestriction(item.id, token), 'Restriction supprimée', () => loadRoleData(selectedRole)) })} onAddWord={() => mutate('role-word', () => addRoleBannedWord(selectedRole, roleWord, token), 'Mot banni ajouté', () => { setRoleWord(''); return loadRoleData(selectedRole) })} onRemoveWord={(item) => askConfirmation({ title: 'Supprimer ce mot banni ?', message: 'Ce mot sera supprimé pour le rôle sélectionné.', onConfirm: () => mutate('delete-role-word', () => removeRoleBannedWord(item.id, token), 'Mot banni supprimé', () => loadRoleData(selectedRole)) })} />}
        {activeSection === 'audit' && <AuditSection loading={loading('audit')} error={errorFor('audit')} view={auditView} setView={(view) => { setAuditView(view); setExpandedAuditId(null) }} logs={auditLogs} messages={filteredMessages} users={users} search={auditSearch} setSearch={(value) => { setAuditSearch(value); setAuditPage(0) }} action={auditAction} setAction={(value) => { setAuditAction(value); setAuditPage(0) }} entity={auditEntity} setEntity={(value) => { setAuditEntity(value); setAuditPage(0) }} date={auditDate} setDate={(value) => { setAuditDate(value); setAuditPage(0) }} filteredSearch={filteredSearch} setFilteredSearch={(value) => { setFilteredSearch(value); setFilteredPage(0) }} filteredAction={filteredAction} setFilteredAction={(value) => { setFilteredAction(value); setFilteredPage(0) }} filteredUserId={filteredUserId} setFilteredUserId={(value) => { setFilteredUserId(value); setFilteredPage(0) }} filteredDate={filteredDate} setFilteredDate={(value) => { setFilteredDate(value); setFilteredPage(0) }} expandedId={expandedAuditId} setExpandedId={setExpandedAuditId} page={auditView === 'permissions' ? auditPage : filteredPage} totalPages={auditView === 'permissions' ? auditTotalPages : filteredTotalPages} onPageChange={auditView === 'permissions' ? setAuditPage : setFilteredPage} />}
      </div>
      {patternModal && <PatternModal data={patternModal} busy={busyAction === 'pattern'} onClose={() => setPatternModal(null)} onSave={(data) => mutate('pattern', () => data.mode === 'edit' ? updatePattern(data.name, data, token) : addPattern(data, token), data.mode === 'edit' ? 'Pattern mis à jour' : 'Pattern ajouté', async () => { setPatternModal(null); await loadPatterns() })} />}
      {providerModal && <ProviderModal data={providerModal} busy={busyAction === 'provider'} onClose={() => setProviderModal(null)} onSave={saveProviderFromModal} />}
      {modelModal && <ModelModal data={modelModal} providers={adminProviders} busy={busyAction === 'model'} onClose={() => setModelModal(null)} onSave={saveModelFromModal} />}
      {confirmation && <ConfirmDialog {...confirmation} onCancel={() => setConfirmation(null)} onConfirm={async () => { setConfirmation(null); await confirmation.onConfirm() }} />}
    </AdminShell>
  )
}

function sectionTitle(section) { return { overview: "Vue d'ensemble", security: 'Sécurité', models: 'Modèles', users: 'Utilisateurs', roles: 'Rôles', audit: "Journal d'audit" }[section] || 'Administration' }
function sectionDescription(section) { return { overview: 'Un aperçu compact de la configuration et de la protection DLP de Synapse.', security: 'Gérez les règles globales et les patterns qui protègent les échanges.', models: 'Séparez les fournisseurs des modèles configurés et gardez le catalogue lisible.', users: 'Consultez les comptes et leurs autorisations sans exposer les détails techniques.', roles: 'Gérez les restrictions héritées par rôle avec un suivi clair des règles.', audit: 'Suivez les changements d’autorisation et les messages filtrés, en toute sécurité.' }[section] }
function Metric({ value, isLoading, error }) { return isLoading ? <span className="metric-placeholder">—</span> : error ? <span className="metric-placeholder">!</span> : value }
function buildOverviewData(messages) {
  const now = new Date(); const days = Array.from({ length: 7 }, (_, index) => { const date = new Date(now); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - (6 - index)); return { date, label: date.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', ''), count: 0 } })
  const categories = new Map()
  messages.forEach((message) => { const date = new Date(message?.timestamp); if (Number.isNaN(date.getTime())) return; const day = days.find((item) => item.date.toDateString() === date.toDateString()); if (day) day.count += 1; String(message.detectedTypes || '').split(/[|,;]+/).map((item) => item.trim()).filter(Boolean).forEach((item) => categories.set(item, (categories.get(item) || 0) + 1)) })
  const categoryRows = [...categories.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, count]) => ({ name, count }))
  return { days, max: Math.max(1, ...days.map((day) => day.count)), categories: categoryRows, categoryMax: Math.max(1, ...categoryRows.map((item) => item.count)) }
}

function OverviewSection({ loading, errors, users, activeModels, adminModels, patterns, activePatterns, globalWords, securityMetrics, chartData, overviewMessages, onSectionChange }) {
  return <>
    <div className="admin-stat-grid"><StatCard icon="users" label="Utilisateurs" value={<Metric isLoading={loading('users')} error={errors('users')} value={users.length} />} context="Comptes connus" tone="blue" onClick={() => onSectionChange('users')} /><StatCard icon="spark" label="Modèles actifs" value={<Metric isLoading={loading('models')} error={errors('models')} value={activeModels} />} context={`Sur ${adminModels.length} configurés`} tone="peach" onClick={() => onSectionChange('models')} /><StatCard icon="shield" label="Patterns DLP" value={<Metric isLoading={loading('patterns')} error={errors('patterns')} value={patterns.length} />} context={`${activePatterns} actifs`} tone="green" onClick={() => onSectionChange('security')} /><StatCard icon="key" label="Mots bannis" value={<Metric isLoading={loading('globalWords')} error={errors('globalWords')} value={globalWords.length} />} context="Règles globales" tone="navy" onClick={() => onSectionChange('security')} /></div>
    <section className="admin-card admin-security-banner"><div><div className="admin-card-kicker">SÉCURITÉ AUJOURD'HUI</div><h2>Protection DLP</h2><p>Les chiffres ci-dessous proviennent des événements de sécurité disponibles.</p></div><div className="admin-security-metrics"><MetricBox label="Incidents" value={securityMetrics?.today?.analysedIncidents ?? 0} loading={loading('security')} error={errors('security')} /><MetricBox label="Bloqués" value={securityMetrics?.today?.blocked ?? 0} loading={loading('security')} error={errors('security')} tone="danger" /><MetricBox label="Masqués" value={securityMetrics?.today?.redacted ?? 0} loading={loading('security')} error={errors('security')} tone="warning" /><MetricBox label="Élevés / critiques" value={(securityMetrics?.highSeverityIncidents ?? 0) + (securityMetrics?.criticalIncidents ?? 0)} loading={loading('security')} error={errors('security')} tone="peach" /></div></section>
    <div className="admin-chart-grid"><section className="admin-card"><SectionHeading kicker="TENDANCE" title="Incidents DLP · 7 derniers jours" context={`${overviewMessages.length} événements chargés`} />{loading('overview') ? <Skeleton rows={4} /> : errors('overview') ? <ErrorState message={errors('overview')} /> : <div className="admin-bar-chart" aria-label="Incidents DLP sur les sept derniers jours">{chartData.days.map((day) => <div className="admin-bar-column" key={day.date.toISOString()}><strong>{day.count}</strong><div className="admin-bar-track"><i style={{ height: `${Math.max(4, (day.count / chartData.max) * 100)}%` }} /></div><span>{day.label}</span></div>)}</div>}</section><section className="admin-card"><SectionHeading kicker="DÉTECTION" title="Catégories détectées" />{chartData.categories.length ? <div className="admin-category-chart">{chartData.categories.map((item) => <div className="admin-category-row" key={item.name}><div><span>{item.name}</span><strong>{item.count}</strong></div><i style={{ width: `${(item.count / chartData.categoryMax) * 100}%` }} /></div>)}</div> : <EmptyState icon="activity" title="Aucune catégorie récente" description="Les catégories apparaîtront lorsque des événements DLP seront disponibles." />}</section></div>
  </>
}
function MetricBox({ label, value, loading, error, tone = '' }) { return <div className={`metric-box ${tone}`}><strong><Metric value={value} isLoading={loading} error={error} /></strong><span>{label}</span></div> }
function SectionHeading({ kicker, title, context, action }) { return <div className="admin-section-heading"><div><div className="admin-card-kicker">{kicker}</div><h2>{title}</h2></div><div>{context && <span className="admin-heading-context">{context}</span>}{action}</div></div> }

function SecuritySection({ loading, errorFor, globalWords, wordSearch, setWordSearch, onAddWord, onDeleteWord, patterns, patternSearch, setPatternSearch, onCreatePattern, onEditPattern, onTogglePattern, onDeletePattern, onCopyExpression, onCopyError }) {
  return <div className="admin-stack"><section className="admin-card"><SectionHeading kicker="RÈGLES GLOBALES" title="Mots bannis" context={`${globalWords.length} résultat${globalWords.length !== 1 ? 's' : ''}`} action={<AddWordForm onSubmit={onAddWord} />} /><AdminToolbar><div className="admin-search-field"><Icon name="search" size={16} /><input value={wordSearch} onChange={(event) => setWordSearch(event.target.value)} placeholder="Rechercher un mot ou une expression" aria-label="Rechercher les mots bannis" /></div></AdminToolbar>{loading('globalWords') ? <Skeleton rows={4} /> : errorFor('globalWords') ? <ErrorState message={errorFor('globalWords')} /> : globalWords.length ? <div className="admin-compact-list">{globalWords.map((item, index) => <div className="admin-compact-row" key={item.id || index}><span>{item.word || item}</span>{item.id && <button type="button" className="admin-icon-button danger" aria-label={`Supprimer ${item.word || item}`} onClick={() => onDeleteWord(item.id, item.word || item)}><Icon name="trash" size={15} /></button>}</div>)}</div> : <EmptyState icon="shield" title="Aucun mot banni" description="Les règles globales apparaîtront ici après leur création." />}</section><section className="admin-card"><SectionHeading kicker="DÉTECTION" title="Patterns DLP" context={`${patterns.length} règle${patterns.length !== 1 ? 's' : ''}`} action={<button type="button" className="admin-button primary" onClick={onCreatePattern}><Icon name="plus" size={15} />Ajouter un pattern</button>} /><AdminToolbar><div className="admin-search-field"><Icon name="search" size={16} /><input value={patternSearch} onChange={(event) => setPatternSearch(event.target.value)} placeholder="Rechercher par nom, type ou expression" aria-label="Rechercher les patterns" /></div></AdminToolbar>{loading('patterns') ? <Skeleton rows={5} /> : errorFor('patterns') ? <ErrorState message={errorFor('patterns')} /> : patterns.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Nom</th><th>Type</th><th>Expression</th><th>Gravité</th><th>Action</th><th>Statut</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{patterns.map((pattern) => <tr key={pattern.name}><td><strong>{pattern.name}</strong></td><td>{pattern.type || 'custom'}</td><td><div className="regex-cell"><code title={pattern.pattern}>{pattern.pattern}</code><CopyButton value={pattern.pattern} label="Copier l’expression" onCopied={onCopyExpression} onCopyError={onCopyError} /></div></td><td><StatusBadge status={pattern.severity} label={severityLabel(pattern.severity)} /></td><td>{actionLabel(pattern.action)}</td><td><StatusBadge status={pattern.enabled === false ? 'inactive' : 'active'} label={pattern.enabled === false ? 'Inactif' : 'Actif'} /></td><td><div className="table-actions"><button type="button" className="admin-text-button" onClick={() => onEditPattern(pattern)}><Icon name="edit" size={14} />Modifier</button><button type="button" className="admin-text-button" onClick={() => onTogglePattern(pattern)}>{pattern.enabled === false ? 'Activer' : 'Désactiver'}</button><button type="button" className="admin-text-button danger" onClick={() => onDeletePattern(pattern.name)}><Icon name="trash" size={14} />Supprimer</button></div></td></tr>)}</tbody></table></div> : <EmptyState icon="shield" title="Aucun pattern configuré" description="Créez une règle DLP pour commencer à protéger les échanges." />}</section></div>
}
function AddWordForm({ onSubmit }) { const [value, setValue] = useState(''); return <form className="inline-add-form security-add-word-form" onSubmit={async (event) => { event.preventDefault(); if (!value.trim()) return; await onSubmit(value.trim()); setValue('') }}><input value={value} onChange={(event) => setValue(event.target.value)} placeholder="Ajouter un mot…" aria-label="Nouveau mot banni" /><button className="admin-button primary" type="submit"><Icon name="plus" size={15} />Ajouter</button></form> }
function severityLabel(value) { return { low: 'Faible', medium: 'Moyenne', high: 'Élevée', critical: 'Critique' }[String(value || '').toLowerCase()] || value || '—' }
function actionLabel(value) { return { ALLOW: 'Autoriser', MASK: 'Masquer', BLOCK: 'Bloquer' }[value] || value || '—' }

function ModelsSection({ loading, errorFor, providers, allProviders, models, availableModels, providerSearch, setProviderSearch, modelSearch, setModelSearch, onCreateProvider, onEditProvider, onToggleProvider, onDeleteProvider, onCreateModel, onEditModel, onToggleModel, onDeleteModel, onTestModel, modelTestResults }) {
  return <div className="admin-stack"><section className="admin-card"><SectionHeading kicker="FOURNISSEURS" title="Fournisseurs" context={`${providers.length} configuré${providers.length !== 1 ? 's' : ''}`} action={<button type="button" className="admin-button primary" onClick={onCreateProvider}><Icon name="plus" size={15} />Ajouter</button>} /><AdminToolbar><div className="admin-search-field"><Icon name="search" size={16} /><input value={providerSearch} onChange={(event) => setProviderSearch(event.target.value)} placeholder="Rechercher un fournisseur" aria-label="Rechercher les fournisseurs" /></div></AdminToolbar>{loading('providers') ? <Skeleton rows={3} /> : errorFor('providers') ? <ErrorState message={errorFor('providers')} /> : providers.length ? <div className="admin-provider-list">{providers.map((provider) => <div className="admin-provider-row" key={provider.id}><span className="provider-mark">{String(provider.nom || provider.name || provider.code || '?').slice(0, 1).toUpperCase()}</span><div className="provider-copy"><strong>{provider.nom || provider.name || provider.code}</strong><small>{provider.code} · {provider.apiKeyEnvVar ? (provider.apiKeyConfigured ? 'Clé configurée' : 'Clé manquante') : 'Aucune variable de clé'}</small></div><StatusBadge status={provider.statut === 'ACTIF' ? 'active' : 'inactive'} label={provider.statut === 'ACTIF' ? 'Actif' : 'Inactif'} /><div className="table-actions"><button type="button" className="admin-text-button" onClick={() => onEditProvider(provider)}><Icon name="edit" size={14} />Modifier</button><button type="button" className="admin-text-button" onClick={() => onToggleProvider(provider)}>{provider.statut === 'ACTIF' ? 'Désactiver' : 'Activer'}</button><button type="button" className="admin-text-button danger" onClick={() => onDeleteProvider(provider)}><Icon name="trash" size={14} />Supprimer</button></div></div>)}</div> : <EmptyState icon="spark" title="Aucun fournisseur" description="Ajoutez un fournisseur pour gérer ses modèles." />}</section><section className="admin-card"><SectionHeading kicker="CONFIGURATION" title="Modèles administrés" context={`${models.length} configuré${models.length !== 1 ? 's' : ''}`} action={<button type="button" className="admin-button primary" onClick={onCreateModel}><Icon name="plus" size={15} />Configurer un modèle</button>} /><AdminToolbar><div className="admin-search-field"><Icon name="search" size={16} /><input value={modelSearch} onChange={(event) => setModelSearch(event.target.value)} placeholder="Rechercher par nom, alias ou modèle amont" aria-label="Rechercher les modèles" /></div></AdminToolbar>{loading('models') || loading('catalog') ? <Skeleton rows={4} /> : errorFor('models') || errorFor('catalog') ? <ErrorState message={errorFor('models') || errorFor('catalog')} /> : <ModelRows models={models} availableModels={availableModels} allProviders={allProviders} onEdit={onEditModel} onToggle={onToggleModel} onDelete={onDeleteModel} onTest={onTestModel} results={modelTestResults} />}</section></div>
}
function ModelRows({ models, availableModels, onEdit, onToggle, onDelete, onTest, results }) { if (!models.length && !availableModels.length) return <EmptyState icon="spark" title="Aucun modèle disponible" description="Le catalogue Synapse ne retourne actuellement aucun modèle." />; return <div className="admin-model-list">{models.map((model) => <ModelRow key={model.id} model={model} adminModel={model} onEdit={onEdit} onToggle={onToggle} onDelete={onDelete} onTest={onTest} result={results[model.id]} />)}{availableModels.filter((model) => !models.some((item) => (item.aliasInterne || item.alias) === model.alias)).map((model) => <ModelRow key={`available-${model.alias}`} model={model} adminModel={null} />)}</div> }
function ModelRow({ model, adminModel, onEdit, onToggle, onDelete, onTest, result }) { const alias = adminModel ? (adminModel.aliasInterne || adminModel.alias) : model.alias; const meta = modelCardMeta(alias); const title = adminModel?.nomAffichage || model.displayName || alias; const providerName = adminModel?.providerName || model?.providerName || modelProviderName(alias); return <article className="admin-model-row"><div className={`model-mark ${meta.tone || ''}`}><ModelLogo alias={alias} logoUrl={adminModel?.logoUrl || model?.logoUrl} className="admin-model-logo" fallback={meta.initials} /></div><div className="model-row-copy"><div className="model-row-title"><div><strong>{title}</strong><small>{providerName} · <code>{alias}</code></small></div><StatusBadge status={adminModel ? adminModel.statut : 'available'} label={adminModel ? (adminModel.statut === 'ACTIF' ? 'Actif' : 'Inactif') : 'Disponible'} /></div><p>{adminModel?.description || model.description || meta.description || 'Modèle LLM disponible dans Synapse.'}</p><div className="model-identifiers"><span>Alias : {alias}</span><span>Amont : {adminModel?.nomModeleProvider || 'Non configuré'}</span></div>{result && <div className="model-test-result"><StatusBadge status={['OK', 'CONNECTED'].includes(result.status) ? 'active' : 'inactive'} label={`Test : ${result.status}`} />{result.latencyMs != null && <span>{result.latencyMs} ms</span>}</div>}<div className="table-actions">{adminModel ? <><button type="button" className="admin-text-button" onClick={() => onTest(adminModel)}>Tester</button><button type="button" className="admin-text-button" onClick={() => onToggle(adminModel)}>{adminModel.statut === 'ACTIF' ? 'Désactiver' : 'Activer'}</button><button type="button" className="admin-text-button" onClick={() => onEdit(adminModel)}><Icon name="edit" size={14} />Modifier</button><button type="button" className="admin-text-button danger" onClick={() => onDelete(adminModel)}><Icon name="trash" size={14} />Supprimer</button></> : <span className="available-note">Disponible dans le catalogue</span>}</div></div></article> }

function UsersSection({ loading, errorFor, users, allUsers, search, setSearch, selectedUser, onSelectUser, keycloakRoles, keycloakRolesError, onRetryKeycloakRoles, selectedRoles, setSelectedRoles, onSaveRoles, restrictions, bannedWords, models, selectedModel, setSelectedModel, userWord, setUserWord, onAddRestriction, onRemoveRestriction, onAddWord, onRemoveWord, onToggleUser }) {
  return <div className="admin-users-layout"><section className="admin-card admin-users-list-card"><SectionHeading kicker="COMPTES" title="Utilisateurs" context={`${users.length} résultat${users.length !== 1 ? 's' : ''}`} /><AdminToolbar><div className="admin-search-field"><Icon name="search" size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nom, email ou identifiant" aria-label="Rechercher les utilisateurs" /></div></AdminToolbar>{loading('users') ? <Skeleton rows={5} /> : errorFor('users') ? <ErrorState message={errorFor('users')} /> : users.length ? <div className="admin-user-list" role="listbox" aria-label="Utilisateurs">{users.map((user) => <button key={user.id} type="button" role="option" aria-selected={selectedUser?.id === user.id} className={`admin-user-row ${selectedUser?.id === user.id ? 'selected' : ''}`} onClick={() => onSelectUser(user)}><span className="user-mark">{String(user.nomAffichage || '?').slice(0, 1).toUpperCase()}</span><span className="user-row-copy"><strong>{user.nomAffichage || 'Utilisateur'}</strong><small>{user.email || 'Compte Synapse'}</small></span><StatusBadge status={user.enabled !== false ? 'active' : 'inactive'} label={user.enabled !== false ? 'Actif' : 'Inactif'} /></button>)}</div> : <EmptyState icon="users" title="Aucun utilisateur" description={allUsers.length ? 'Aucun résultat pour cette recherche.' : 'Les comptes apparaîtront ici lorsqu’ils seront disponibles.'} />}</section><UserDetails loading={loading('userDetails')} error={errorFor('userDetails')} user={selectedUser} keycloakRoles={keycloakRoles} keycloakRolesError={keycloakRolesError} onRetryKeycloakRoles={onRetryKeycloakRoles} selectedRoles={selectedRoles} setSelectedRoles={setSelectedRoles} onSaveRoles={onSaveRoles} restrictions={restrictions} bannedWords={bannedWords} models={models} selectedModel={selectedModel} setSelectedModel={setSelectedModel} userWord={userWord} setUserWord={setUserWord} onAddRestriction={onAddRestriction} onRemoveRestriction={onRemoveRestriction} onAddWord={onAddWord} onRemoveWord={onRemoveWord} onToggleUser={onToggleUser} /></div>
}
function UserDetails({ loading, error, user, keycloakRoles, keycloakRolesError, onRetryKeycloakRoles, selectedRoles, setSelectedRoles, onSaveRoles, restrictions, bannedWords, models, selectedModel, setSelectedModel, userWord, setUserWord, onAddRestriction, onRemoveRestriction, onAddWord, onRemoveWord, onToggleUser }) { if (!user) return <section className="admin-card admin-detail-empty"><EmptyState icon="users" title="Sélectionnez un utilisateur" description="Choisissez un compte pour afficher ses accès, restrictions et règles personnalisées." /></section>; const canManage = isUuid(user.externalId); return <section className="admin-card admin-user-detail"><div className="user-profile"><span className="user-mark large">{String(user.nomAffichage || '?').slice(0, 1).toUpperCase()}</span><div><div className="admin-card-kicker">COMPTE</div><h2>{user.nomAffichage || 'Utilisateur'}</h2><p>{user.email || 'Compte Synapse'}</p></div><div className="user-profile-actions"><StatusBadge status={user.enabled !== false ? 'active' : 'inactive'} label={user.enabled !== false ? 'Actif' : 'Inactif'} />{user.keycloakManaged && <button type="button" className="admin-button secondary" onClick={() => onToggleUser(user)}>{user.enabled !== false ? 'Désactiver' : 'Activer'}</button>}</div></div><div className="user-summary"><div><strong>{selectedRoles.length}</strong><span>Rôles</span></div><div><strong>{restrictions.length}</strong><span>Restrictions</span></div><div><strong>{bannedWords.length}</strong><span>Mots bannis</span></div></div>{loading ? <Skeleton rows={3} /> : error ? <ErrorState message={error} /> : <><DetailSection title="Rôles" kicker="ACCÈS"><div className="role-chip-grid">{keycloakRoles.length ? keycloakRoles.map((role) => { const checked = selectedRoles.includes(role.name); return <label key={role.id || role.name} className={`role-check ${checked ? 'selected' : ''}`}><input type="checkbox" checked={checked} onChange={() => setSelectedRoles((current) => checked ? current.filter((item) => item !== role.name) : [...current, role.name])} /><span>{role.name}</span></label> }) : keycloakRolesError ? <div className="role-sync-warning"><span>{keycloakRolesError}</span><button type="button" className="admin-button secondary" onClick={onRetryKeycloakRoles}>Réessayer</button></div> : <span className="muted">Aucun rôle n’est disponible dans Keycloak.</span>}</div>{keycloakRoles.length > 0 && <button type="button" className="admin-button primary" onClick={onSaveRoles} disabled={!user.keycloakManaged}>Enregistrer les rôles</button>}</DetailSection><DetailSection title="Restrictions de modèles" kicker="AUTORISATIONS" count={restrictions.length}><div className="inline-add-form"><select value={selectedModel} onChange={(event) => setSelectedModel(event.target.value)} disabled={!canManage} aria-label="Modèle à restreindre"><option value="">Choisir un modèle…</option>{models.map((model) => <option key={model.alias} value={model.alias}>{model.displayName}</option>)}</select><button type="button" className="admin-button secondary" disabled={!canManage || !selectedModel} title={!canManage ? 'Un UUID Keycloak est requis.' : undefined} onClick={onAddRestriction}>Ajouter</button></div>{!canManage && <p className="helper-text">Les restrictions personnalisées nécessitent l’identifiant Keycloak du compte.</p>}<ChipList items={restrictions} empty="Aucune restriction personnalisée." labelKey="llmModelAlias" onRemove={onRemoveRestriction} /></DetailSection><DetailSection title="Mots bannis spécifiques" kicker="DLP" count={bannedWords.length}><div className="inline-add-form"><input value={userWord} onChange={(event) => setUserWord(event.target.value)} placeholder="Ajouter un mot ou une expression" disabled={!canManage} aria-label="Nouveau mot banni utilisateur" /><button type="button" className="admin-button secondary" disabled={!canManage || !userWord.trim()} onClick={onAddWord}>Ajouter</button></div><ChipList items={bannedWords} empty="Aucun mot banni spécifique." labelKey="word" onRemove={onRemoveWord} /></DetailSection></>}</section> }
function DetailSection({ kicker, title, count, children }) { return <div className="detail-section"><div className="detail-section-heading"><div><div className="admin-card-kicker">{kicker}</div><h3>{title}</h3></div>{count != null && <span className="count-pill">{count}</span>}</div>{children}</div> }
function ChipList({ items, empty, labelKey, onRemove }) { return items.length ? <div className="chip-list">{items.map((item) => <span className="restriction-chip" key={item.id || item[labelKey]}>{item[labelKey]}<button type="button" onClick={() => onRemove(item)} aria-label={`Supprimer ${item[labelKey]}`}><Icon name="close" size={13} /></button></span>)}</div> : <span className="muted">{empty}</span> }

export function RolesSection({ loading, errorFor, roles, rolesLoading, rolesError, onRetryRoles, role, setRole, restrictions, bannedWords, models, selectedModel, setSelectedModel, word, setWord, onAddRestriction, onRemoveRestriction, onAddWord, onRemoveWord }) {
  return <div className="admin-stack"><section className="admin-card"><SectionHeading kicker="AUTORISATIONS HÉRITÉES" title="Règles par rôle" context={roles.length ? `${roles.length} rôle${roles.length !== 1 ? 's' : ''} disponible${roles.length !== 1 ? 's' : ''}` : 'Rôles Keycloak'} />{rolesLoading ? <Skeleton rows={2} /> : rolesError ? <ErrorState message={rolesError} onRetry={onRetryRoles} /> : roles.length ? <><div className="role-selector" role="tablist" aria-label="Sélectionner un rôle">{roles.map((item) => <button key={item} type="button" role="tab" aria-selected={role === item} className={role === item ? 'active' : ''} onClick={() => setRole(item)}>{item}</button>)}</div><div className="role-context"><span className="provider-mark"><Icon name="key" size={17} /></span><div><strong>{role}</strong><small>Restrictions appliquées à ce rôle</small></div></div>{loading ? <Skeleton rows={4} /> : errorFor('roles') ? <ErrorState message={errorFor('roles')} onRetry={() => onRetryRoles()} /> : <div className="role-columns"><DetailSection title="Modèles restreints" kicker="MODÈLES" count={restrictions.length}><div className="inline-add-form"><select value={selectedModel} onChange={(event) => setSelectedModel(event.target.value)} aria-label="Modèle à restreindre"><option value="">Choisir un modèle…</option>{models.map((model) => <option key={model.alias} value={model.alias}>{model.displayName}</option>)}</select><button type="button" className="admin-button secondary" disabled={!selectedModel} onClick={onAddRestriction}>Ajouter</button></div><ChipList items={restrictions} empty="Aucune restriction de modèle." labelKey="llmModelAlias" onRemove={onRemoveRestriction} /></DetailSection><DetailSection title="Mots bannis" kicker="DLP" count={bannedWords.length}><div className="inline-add-form"><input value={word} onChange={(event) => setWord(event.target.value)} placeholder="Mot ou expression" aria-label="Nouveau mot banni pour le rôle" /><button type="button" className="admin-button secondary" disabled={!word.trim()} onClick={onAddWord}>Ajouter</button></div><ChipList items={bannedWords} empty="Aucun mot banni pour ce rôle." labelKey="word" onRemove={onRemoveWord} /></DetailSection></div>}</> : <EmptyState icon="key" title="Aucun rôle disponible" description="Les rôles affichés ici proviennent de Keycloak. Créez ou importez un rôle dans l’environnement de test, puis réessayez." action={<button type="button" className="admin-button secondary" onClick={onRetryRoles}>Réessayer</button>} />}</section></div>
}

const AUDIT_ACTION_OPTIONS = [
  ['', 'Toutes les actions'],
  ['ADD', 'Ajout'],
  ['CREATE', 'Création'],
  ['UPDATE', 'Modification'],
  ['DELETE', 'Suppression'],
  ['STATUS', 'Changement de statut'],
  ['ENABLE', 'Activation'],
  ['DISABLE', 'Désactivation'],
  ['UPDATE_ROLES', 'Modification des rôles'],
]
const FILTERED_ACTION_OPTIONS = [['', 'Toutes les actions'], ['BLOCKED', 'Bloqué'], ['REDACTED', 'Masqué']]
const AUDIT_ENTITY_OPTIONS = [
  ['', 'Toutes les entités'],
  ['GlobalBannedWord', 'Mot banni global'],
  ['UserBannedWord', 'Mot banni utilisateur'],
  ['ROLE_BANNED_WORD', 'Mot banni par rôle'],
  ['UserLlmRestriction', 'Restriction utilisateur'],
  ['ROLE_LLM_RESTRICTION', 'Restriction par rôle'],
  ['DLP_PATTERN', 'Règle DLP'],
  ['LLM_PROVIDER', 'Fournisseur LLM'],
  ['LLM_MODEL', 'Modèle LLM'],
  ['KEYCLOAK_USER', 'Utilisateur Keycloak'],
]

function AuditSection({ loading, error, view, setView, logs, messages, users, search, setSearch, action, setAction, entity, setEntity, date, setDate, filteredSearch, setFilteredSearch, filteredAction, setFilteredAction, filteredUserId, setFilteredUserId, filteredDate, setFilteredDate, expandedId, setExpandedId, page, totalPages, onPageChange }) {
  const rows = view === 'permissions' ? logs : messages
  const actionOptions = view === 'permissions' ? AUDIT_ACTION_OPTIONS : FILTERED_ACTION_OPTIONS
  const userNamesById = useMemo(() => new Map(users.flatMap((user) => {
    const id = user.externalId || user.id
    const name = user.nomAffichage || user.username || user.email
    return id && name ? [[String(id), name]] : []
  })), [users])
  const resolveUserName = (id, fallback) => id ? (userNamesById.get(String(id)) || fallback) : fallback
  return <div className="admin-stack">
    <div className="audit-view-switch" role="tablist" aria-label="Vue du journal"><button type="button" role="tab" aria-selected={view === 'permissions'} className={view === 'permissions' ? 'active' : ''} onClick={() => setView('permissions')}>Autorisations</button><button type="button" role="tab" aria-selected={view === 'filtered'} className={view === 'filtered' ? 'active' : ''} onClick={() => setView('filtered')}>Messages bloqués / masqués</button></div>
    <section className="admin-card">
      <AdminToolbar>
        <div className="admin-search-field"><Icon name="search" size={16} /><input value={view === 'permissions' ? search : filteredSearch} onChange={(event) => view === 'permissions' ? setSearch(event.target.value) : setFilteredSearch(event.target.value)} placeholder="Rechercher dans le journal" aria-label="Rechercher dans le journal" /></div>
        <label className="admin-filter-field"><span>Action</span><select className="admin-input compact" value={view === 'permissions' ? action : filteredAction} onChange={(event) => view === 'permissions' ? setAction(event.target.value) : setFilteredAction(event.target.value)}>{actionOptions.map(([value, label]) => <option key={value || 'all'} value={value}>{label}</option>)}</select></label>
        {view === 'permissions'
          ? <label className="admin-filter-field"><span>Entité</span><select className="admin-input compact" value={entity} onChange={(event) => setEntity(event.target.value)}>{AUDIT_ENTITY_OPTIONS.map(([value, label]) => <option key={value || 'all'} value={value}>{label}</option>)}</select></label>
          : <label className="admin-filter-field"><span>Utilisateur</span><input className="admin-input compact" value={filteredUserId} onChange={(event) => setFilteredUserId(event.target.value)} placeholder="Identifiant" /></label>}
        <label className="admin-filter-field admin-date-filter"><span>Date</span><input className="admin-input compact" type="date" value={view === 'permissions' ? date : filteredDate} onChange={(event) => view === 'permissions' ? setDate(event.target.value) : setFilteredDate(event.target.value)} /></label>
      </AdminToolbar>
      {loading ? <Skeleton rows={6} /> : error ? <ErrorState message={error} /> : rows.length ? <div className="admin-audit-table-wrap"><table className="admin-table audit-table"><thead><tr><th>Date</th><th>Action</th><th>Ressource</th><th>Acteur / cible</th><th>Statut</th><th><span className="sr-only">Détails</span></th></tr></thead><tbody>{rows.map((row) => { const id = row.id || row.timestamp; const expanded = expandedId === id; const isMessage = view === 'filtered'; const isUserTarget = !isMessage && row.entityName === 'KEYCLOAK_USER'; const userId = isMessage ? row.userKeycloakId : row.performedBy; const userName = resolveUserName(userId, isMessage || userId ? 'Utilisateur inconnu' : 'Système'); const resourceDetail = isMessage ? (row.detectedTypes || 'Catégorie non précisée') : isUserTarget ? resolveUserName(row.entityId, 'Utilisateur inconnu') : (row.entityId || '—'); return <><tr key={id} className={expanded ? 'expanded' : ''}><td><time dateTime={row.timestamp}>{formatDate(row.timestamp)}</time></td><td><StatusBadge status={row.action} label={formatAction(row.action)} /></td><td><strong>{isMessage ? (row.reason || 'Événement DLP') : formatEntity(row.entityName)}</strong><small>{resourceDetail}</small></td><td><span title={userId || undefined}>{userName}</span></td><td><StatusBadge status={isMessage ? row.requestStatus || row.action : row.action} label={isMessage ? formatAction(row.requestStatus || row.action) : 'Enregistré'} /></td><td><button type="button" className="admin-icon-button" aria-expanded={expanded} aria-label={expanded ? 'Réduire les détails' : 'Afficher les détails'} onClick={() => setExpandedId(expanded ? null : id)}><Icon name="chevron" size={16} /></button></td></tr>{expanded && <tr className="audit-detail-row" key={`${id}-details`}><td colSpan="6"><div><strong>{isMessage ? 'Message sécurisé' : 'Détails techniques'}</strong><span>{isMessage ? `Détections : ${row.detectionCount ?? 0}` : `${isUserTarget ? 'Utilisateur' : 'Identifiant'} : ${resourceDetail}`}</span>{isMessage && <span className="safe-content">{row.redactedContent ? `Version sécurisée : ${row.redactedContent}` : 'Version sécurisée indisponible pour cet ancien événement.'}</span>}{!isMessage && <small>La donnée originale n’est pas affichée dans l’interface d’administration.</small>}</div></td></tr>}</> })}</tbody></table></div> : <EmptyState icon="activity" title="Aucun événement" description={view === 'permissions' ? 'Les changements d’autorisation apparaîtront ici.' : 'Aucun message filtré ne correspond à ces critères.'} />}
      <Pagination page={page} totalPages={totalPages} onChange={onPageChange} />
    </section>
  </div>
}
function formatDate(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) }
function dateRange(value) { if (!value) return {}; const [year, month, day] = value.split('-').map(Number); if (!year || !month || !day) return {}; return { from: new Date(year, month - 1, day, 0, 0, 0, 0).toISOString(), to: new Date(year, month - 1, day, 23, 59, 59, 999).toISOString() } }

function PatternModal({ data, busy, onClose, onSave }) { const [form, setForm] = useState(data); const update = (key, value) => setForm((current) => ({ ...current, [key]: value })); return <Modal title={data.mode === 'edit' ? 'Modifier le pattern' : 'Ajouter un pattern'} description="Une règle courte et explicite est plus facile à auditer." onClose={onClose}><form className="admin-modal-form" onSubmit={(event) => { event.preventDefault(); if (!form.name.trim() || !form.pattern.trim()) return; onSave({ ...form, name: form.name.trim(), pattern: form.pattern.trim() }) }}><Field label="Nom"><input value={form.name} onChange={(event) => update('name', event.target.value)} required disabled={data.mode === 'edit'} /></Field><Field label="Type"><input value={form.type} onChange={(event) => update('type', event.target.value)} required /></Field><Field label="Expression régulière"><textarea className="code-input" value={form.pattern} onChange={(event) => update('pattern', event.target.value)} required rows="4" /></Field><div className="form-grid"><Field label="Gravité"><select value={form.severity} onChange={(event) => update('severity', event.target.value)}><option value="low">Faible</option><option value="medium">Moyenne</option><option value="high">Élevée</option><option value="critical">Critique</option></select></Field><Field label="Action"><select value={form.action} onChange={(event) => update('action', event.target.value)}><option value="ALLOW">Autoriser</option><option value="MASK">Masquer</option><option value="BLOCK">Bloquer</option></select></Field></div><label className="checkbox-line"><input type="checkbox" checked={form.enabled !== false} onChange={(event) => update('enabled', event.target.checked)} /> Pattern actif</label><div className="admin-modal-actions"><button type="button" className="admin-button secondary" onClick={onClose}>Annuler</button><button type="submit" className="admin-button primary" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button></div></form></Modal> }
function ProviderModal({ data, busy, onClose, onSave }) { const [form, setForm] = useState(data); const update = (key, value) => setForm((current) => ({ ...current, [key]: value })); return <Modal title={data.mode === 'edit' ? 'Modifier le fournisseur' : 'Ajouter un fournisseur'} description="La clé reste dans l’environnement ; Synapse ne conserve que le nom de variable." onClose={onClose}><form className="admin-modal-form" onSubmit={(event) => { event.preventDefault(); onSave({ ...form, name: form.name.trim(), code: form.code.trim() }) }}><Field label="Code fournisseur"><input value={form.code} onChange={(event) => update('code', event.target.value)} required /></Field><Field label="Nom affiché"><input value={form.name} onChange={(event) => update('name', event.target.value)} required /></Field><Field label="Variable de clé API"><input value={form.apiKeyEnvVar} onChange={(event) => update('apiKeyEnvVar', event.target.value.toUpperCase())} pattern="[A-Z][A-Z0-9_]{1,99}" placeholder="OPENAI_API_KEY" /></Field><Field label="Statut"><select value={form.status} onChange={(event) => update('status', event.target.value)}><option value="ACTIF">Actif</option><option value="INACTIF">Inactif</option></select></Field><div className="admin-modal-actions"><button type="button" className="admin-button secondary" onClick={onClose}>Annuler</button><button type="submit" className="admin-button primary" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button></div></form></Modal> }
function ModelModal({ data, providers, busy, onClose, onSave }) {
  const [form, setForm] = useState(data)
  const [logoError, setLogoError] = useState('')
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const localLogo = form.logoUrl?.startsWith('data:')

  const selectLogoFile = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!MODEL_LOGO_TYPES.has(file.type)) {
      setLogoError('Choisissez une image PNG, JPEG, WebP ou GIF.')
      return
    }
    if (file.size > MAX_MODEL_LOGO_BYTES) {
      setLogoError('Le logo local ne doit pas dépasser 512 Ko.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      update('logoUrl', String(reader.result || ''))
      setLogoError('')
    }
    reader.onerror = () => setLogoError('Impossible de lire ce fichier.')
    reader.readAsDataURL(file)
  }

  return <Modal title={data.mode === 'edit' ? 'Modifier le modèle' : 'Configurer un modèle'} description="Configurez un alias déjà disponible dans LiteLLM et personnalisez son affichage." onClose={onClose} size="large"><form className="admin-modal-form" onSubmit={(event) => { event.preventDefault(); onSave(form) }}><Field label="Fournisseur"><select value={form.providerId} onChange={(event) => update('providerId', event.target.value)} required><option value="">Choisir un fournisseur…</option>{providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.nom || provider.name || provider.code}</option>)}</select></Field><Field label="Alias interne"><input value={form.alias} onChange={(event) => update('alias', event.target.value)} disabled={Boolean(data.id)} required placeholder="ex. secure-gpt" /></Field><Field label="Modèle amont"><input value={form.providerModel} onChange={(event) => update('providerModel', event.target.value)} required placeholder="ex. openai/gpt-4o-mini" /><small className="admin-field-help">Identifiant du modèle chez le fournisseur, pas une URL.</small></Field><Field label="Nom affiché"><input value={form.displayName} onChange={(event) => update('displayName', event.target.value)} required /></Field><div className="form-grid"><Field label="Statut"><select value={form.status || 'ACTIF'} onChange={(event) => update('status', event.target.value)}><option value="ACTIF">Actif</option><option value="INACTIF">Inactif</option></select></Field><Field label="URL du logo"><input type="url" value={localLogo ? '' : (form.logoUrl || '')} onChange={(event) => { update('logoUrl', event.target.value); setLogoError('') }} placeholder={localLogo ? 'Logo local sélectionné' : 'https://…'} /></Field></div><Field label="Description"><textarea value={form.description} onChange={(event) => update('description', event.target.value)} rows="3" /></Field><div className="model-logo-picker"><div className="model-logo-preview"><ModelLogo alias={form.alias} logoUrl={form.logoUrl} fallback={modelCardMeta(form.alias || 'model').initials} /></div><div><label className="admin-button secondary model-logo-file-button">Choisir un logo local<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={selectLogoFile} /></label>{form.logoUrl && <button type="button" className="admin-text-button" onClick={() => { update('logoUrl', ''); setLogoError('') }}>Retirer le logo</button>}<small className="admin-field-help">PNG, JPEG, WebP ou GIF · 512 Ko maximum.</small>{logoError && <small className="admin-field-error" role="alert">{logoError}</small>}</div></div><div className="admin-modal-actions"><button type="button" className="admin-button secondary" onClick={onClose}>Annuler</button><button type="submit" className="admin-button primary" disabled={busy || Boolean(logoError)}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button></div></form></Modal>
}
function Field({ label, children }) { return <label className="admin-field"><span>{label}</span>{children}</label> }
