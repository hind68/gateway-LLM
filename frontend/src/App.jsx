import { useCallback, useEffect, useState, useContext } from 'react'
import { AuthContext } from './AuthProvider'
import useConversations from './features/conversations/hooks/useConversations'
import AppLayout from './features/layout/AppLayout'
import useAppMenus from './features/layout/hooks/useAppMenus'
import useChatController from './features/chat/hooks/useChatController'
import useChatUi from './features/chat/hooks/useChatUi'
import useModels from './features/models/hooks/useModels'
import AdminDashboard from './features/admin/AdminDashboard'
import { hasAdminRole } from './utils/authUtils'

function App() {
  const keycloak = useContext(AuthContext)
  const token = keycloak?.token

  const [chatError, setChatError] = useState('')
  const [chatNotice, setChatNotice] = useState('')
  const [showTabs, setShowTabs] = useState(false)
  const [isAdmin, setIsAdmin] = useState(hasAdminRole(token))
  const [showAdminDashboard, setShowAdminDashboard] = useState(false)

  const showError = useCallback((message) => {
    setChatNotice('')
    setChatError(message)
  }, [])

  const showNotice = useCallback((message) => {
    setChatError('')
    setChatNotice(message)
  }, [])

  const clearChatError = useCallback(() => {
    setChatError('')
  }, [])

  const clearFeedback = useCallback(() => {
    setChatError('')
    setChatNotice('')
  }, [])

  const menus = useAppMenus({
    onEscape: () => {
      clearFeedback()
    },
  })

  const models = useModels({
    activeConversation: null,
    onError: showError,
    onLoaded: clearChatError,
  })

  const conversations = useConversations({
    selectedModel: models.selectedModel,
    setSelectedModel: models.setSelectedModel,
    navigation: {
      closeSidePanelOnMobile: menus.closeSidePanelOnMobile,
      closeTransientMenus: menus.closeTransientMenus,
      setActiveView: menus.setActiveView,
      setIsModelMenuOpen: menus.setIsModelMenuOpen,
    },
    feedback: {
      clearChatError,
      showError,
      showNotice,
    },
  })

  const chat = useChatUi({
    activeConversationIdRef: conversations.status.activeConversationIdRef,
    activeModelAlias: models.activeModelAlias,
    isGenerating: conversations.status.isGenerating,
    loadConversations: conversations.actions.loadConversations,
    modelDisplayName: models.modelDisplayName,
    setConversationUiStatus: conversations.status.setConversationUiStatus,
    showError,
  })

  const controller = useChatController({
    chat,
    conversations,
    models,
    navigation: {
      closeSidePanelOnMobile: menus.closeSidePanelOnMobile,
      setIsModelMenuOpen: menus.setIsModelMenuOpen,
    },
    feedback: {
      clearChatError,
      showError,
    },
  })

  useEffect(() => {
    if (!chatError && !chatNotice) return undefined
    const timeout = window.setTimeout(clearFeedback, 5000)
    return () => window.clearTimeout(timeout)
  }, [chatError, chatNotice, clearFeedback])

  const conversationProps = {
    ...conversations,
    actions: {
      ...conversations.actions,
      ...controller,
    },
  }

  if (showAdminDashboard && isAdmin) {
    return <AdminDashboard onError={showError} onNotice={showNotice} onClose={() => setShowAdminDashboard(false)} />
  }

  return (
    <AppLayout
      layout={{
        closeSidebarPanels: menus.closeSidebarPanels,
        closeTransientMenus: menus.closeTransientMenus,
        collapsedPanel: menus.collapsedPanel,
        isAccountMenuOpen: menus.isAccountMenuOpen,
        isHeaderMenuOpen: menus.isHeaderMenuOpen,
        isModelMenuOpen: menus.isModelMenuOpen,
        isModelsView: menus.isModelsView,
        isSearchModalOpen: menus.isSearchModalOpen,
        isSidebarOpen: menus.isSidebarOpen,
        openMenuId: menus.openMenuId,
        searchInputRef: menus.searchInputRef,
        setActiveView: menus.setActiveView,
        setCollapsedPanel: menus.setCollapsedPanel,
        setIsAccountMenuOpen: menus.setIsAccountMenuOpen,
        setIsHeaderMenuOpen: menus.setIsHeaderMenuOpen,
        setIsModelMenuOpen: menus.setIsModelMenuOpen,
        setIsSearchModalOpen: menus.setIsSearchModalOpen,
        setIsSidebarOpen: menus.setIsSidebarOpen,
        setOpenMenuId: menus.setOpenMenuId,
        toggleCollapsedPanel: menus.toggleCollapsedPanel,
        toggleSidebar: menus.toggleSidebar,
      }}
      sidebar={{
        showTabs,
        setShowTabs,
      }}
      chat={chat}
      models={models}
      conversations={conversationProps}
      feedback={{
        chatError,
        chatNotice,
        onClearToast: clearFeedback,
      }}
      admin={{
        isAdmin,
        setShowAdminDashboard
      }}
    />
  )
}

export default App